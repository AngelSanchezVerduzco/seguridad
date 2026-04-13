import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../db/supabase';

type GroupRow = {
  id: string;
  nivel: string;
  autor_user_id: string | null;
  autor_text: string | null;
  nombre: string;
  descripcion: string;
  created_at: string;
};

type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role_in_group: string;
};

type ProfileMini = {
  id: string;
  email: string | null;
  usuario: string | null;
};

export type GroupEntityDto = {
  id: string;
  nivel: string;
  autor: string;
  nombre: string;
  integrantes: number;
  tickets: number;
  descripcion: string;
  miembros: string[];
  createdAt: number;
};

export type CreateGroupInput = {
  nivel: string;
  autor: string;
  nombre: string;
  descripcion: string;
  miembros?: string[];
};

export type PatchGroupInput = Partial<CreateGroupInput>;

function toLowerTrim(value: string): string {
  return value.toLowerCase().trim();
}

function normalizeHandles(handles: string[] | undefined): string[] {
  const list = Array.isArray(handles) ? handles : [];
  const acc: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const v = String(raw ?? '').trim();
    if (!v) continue;
    const key = toLowerTrim(v);
    if (seen.has(key)) continue;
    seen.add(key);
    acc.push(v);
  }
  return acc;
}

async function fetchProfilesByHandles(handles: string[]): Promise<ProfileMini[]> {
  if (handles.length === 0) return [];
  const lower = handles.map((h) => toLowerTrim(h));

  const [emailRes, userRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,email,usuario').in('email', lower),
    supabaseAdmin.from('profiles').select('id,email,usuario').in('usuario', handles),
  ]);

  if (emailRes.error) throw new Error(`Error consultando profiles por email: ${emailRes.error.message}`);
  if (userRes.error) throw new Error(`Error consultando profiles por usuario: ${userRes.error.message}`);

  const map = new Map<string, ProfileMini>();
  for (const p of [...(emailRes.data ?? []), ...(userRes.data ?? [])] as ProfileMini[]) {
    map.set(p.id, p);
  }
  return [...map.values()];
}

function pickHandleForProfile(p: ProfileMini): string {
  const email = (p.email ?? '').trim();
  if (email) return email;
  const user = (p.usuario ?? '').trim();
  if (user) return user;
  return p.id;
}

function profileRowIsAdmin(row: { is_admin?: unknown } | null | undefined): boolean {
  if (!row || typeof row !== 'object') return false;
  const v = row['is_admin'];
  return v === true || v === 'true' || v === 't' || v === 1;
}

function sortGroupRowsByCreatedDesc(rows: GroupRow[]): GroupRow[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return tb - ta;
  });
}

async function resolveHandles(handles: string[]): Promise<{ userIds: string[]; missing: string[] }> {
  const normalized = normalizeHandles(handles);
  if (normalized.length === 0) return { userIds: [], missing: [] };
  const profiles = await fetchProfilesByHandles(normalized);
  const byEmail = new Map<string, string>();
  const byUser = new Map<string, string>();

  for (const p of profiles) {
    const email = (p.email ?? '').trim().toLowerCase();
    const user = (p.usuario ?? '').trim();
    if (email) byEmail.set(email, p.id);
    if (user) byUser.set(user, p.id);
  }

  const userIds: string[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const h of normalized) {
    const key = toLowerTrim(h);
    const uid = byEmail.get(key) ?? byUser.get(h);
    if (!uid) {
      missing.push(h);
      continue;
    }
    if (seen.has(uid)) continue;
    seen.add(uid);
    userIds.push(uid);
  }
  return { userIds, missing };
}

async function mapGroupsToDto(rows: GroupRow[]): Promise<GroupEntityDto[]> {
  if (rows.length === 0) return [];

  const groupIds = rows.map((r) => r.id);
  const authorIds = rows.map((r) => r.autor_user_id).filter((v): v is string => !!v);

  const [membersRes, authorsRes, ticketsRes] = await Promise.all([
    supabaseAdmin.from('group_members').select('group_id,user_id,role_in_group').in('group_id', groupIds),
    authorIds.length
      ? supabaseAdmin.from('profiles').select('id,email,usuario').in('id', authorIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from('tickets').select('group_id').in('group_id', groupIds),
  ]);

  if (membersRes.error) throw new Error(`Error consultando group_members: ${membersRes.error.message}`);
  if ((authorsRes as { error: { message: string } | null }).error) {
    throw new Error(`Error consultando autores: ${(authorsRes as { error: { message: string } }).error.message}`);
  }
  if (ticketsRes.error) throw new Error(`Error consultando tickets: ${ticketsRes.error.message}`);

  const members = membersRes.data as GroupMemberRow[];
  const authorProfiles = (authorsRes as { data: ProfileMini[] }).data ?? [];
  const authorById = new Map(authorProfiles.map((p) => [p.id, pickHandleForProfile(p)]));

  const memberUserIds = [...new Set(members.map((m) => m.user_id))];
  const membersProfilesRes = memberUserIds.length
    ? await supabaseAdmin.from('profiles').select('id,email,usuario').in('id', memberUserIds)
    : { data: [] as ProfileMini[], error: null };
  if (membersProfilesRes.error) {
    throw new Error(`Error consultando perfiles de miembros: ${membersProfilesRes.error.message}`);
  }
  const memberProfileById = new Map((membersProfilesRes.data as ProfileMini[]).map((p) => [p.id, p]));

  const miembrosByGroup = new Map<string, string[]>();
  for (const row of members) {
    const profile = memberProfileById.get(row.user_id);
    const handle = profile ? pickHandleForProfile(profile) : row.user_id;
    const list = miembrosByGroup.get(row.group_id) ?? [];
    list.push(handle);
    miembrosByGroup.set(row.group_id, list);
  }

  const ticketsByGroup = new Map<string, number>();
  for (const t of (ticketsRes.data ?? []) as Array<{ group_id: string }>) {
    const c = ticketsByGroup.get(t.group_id) ?? 0;
    ticketsByGroup.set(t.group_id, c + 1);
  }

  return rows.map((g) => {
    const createdAt = new Date(g.created_at).getTime();
    const miembros = miembrosByGroup.get(g.id) ?? [];
    const autor =
      (g.autor_text ?? '').trim() ||
      (g.autor_user_id ? authorById.get(g.autor_user_id) ?? g.autor_user_id : '');
    return {
      id: g.id,
      nivel: g.nivel ?? '',
      autor,
      nombre: g.nombre ?? '',
      integrantes: miembros.length,
      tickets: ticketsByGroup.get(g.id) ?? 0,
      descripcion: g.descripcion ?? '',
      miembros,
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    };
  });
}

async function setMembersForGroup(groupId: string, handles: string[]): Promise<void> {
  const { userIds, missing } = await resolveHandles(handles);
  if (missing.length) {
    throw new Error(`Miembros no encontrados en profiles: ${missing.join(', ')}`);
  }

  const { error: deleteErr } = await supabaseAdmin.from('group_members').delete().eq('group_id', groupId);
  if (deleteErr) throw new Error(`Error limpiando miembros: ${deleteErr.message}`);

  if (userIds.length === 0) return;

  const payload = userIds.map((uid) => ({
    group_id: groupId,
    user_id: uid,
    role_in_group: 'member',
  }));
  const { error: insertErr } = await supabaseAdmin.from('group_members').insert(payload);
  if (insertErr) throw new Error(`Error insertando miembros: ${insertErr.message}`);
}

export const groupsService = {
  /**
   * Admin (profiles.is_admin): todos los grupos.
   * Usuario normal: grupos donde es autor o miembro de group_members.
   */
  async listForActor(actorUserId: string): Promise<GroupEntityDto[]> {
    const { data: prof, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', actorUserId)
      .maybeSingle();

    if (profErr) {
      console.error('[group-service] listForActor: profiles:', profErr.message);
    }

    const isAdmin = profileRowIsAdmin(prof as { is_admin?: unknown } | null);

    let rows: GroupRow[] = [];

    if (isAdmin) {
      const { data, error } = await supabaseAdmin.from('groups').select('*').order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      rows = (data ?? []) as GroupRow[];
    } else {
      const { data: authored, error: errA } = await supabaseAdmin
        .from('groups')
        .select('*')
        .eq('autor_user_id', actorUserId);
      if (errA) throw new Error(errA.message);

      const { data: memberships, error: errM } = await supabaseAdmin
        .from('group_members')
        .select('group_id')
        .eq('user_id', actorUserId);
      if (errM) throw new Error(errM.message);

      const memberIds = [...new Set((memberships ?? []).map((m: { group_id: string }) => m.group_id))];
      const { data: memberGroups, error: errG } =
        memberIds.length > 0
          ? await supabaseAdmin.from('groups').select('*').in('id', memberIds)
          : { data: [] as GroupRow[], error: null };
      if (errG) throw new Error(errG.message);

      const byId = new Map<string, GroupRow>();
      for (const r of [...(authored ?? []), ...(memberGroups ?? [])] as GroupRow[]) {
        byId.set(r.id, r);
      }
      rows = sortGroupRowsByCreatedDesc([...byId.values()]);
    }

    return mapGroupsToDto(rows);
  },

  async getById(id: string): Promise<GroupEntityDto | null> {
    const { data, error } = await supabaseAdmin.from('groups').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const arr = await mapGroupsToDto([data as GroupRow]);
    return arr[0] ?? null;
  },

  async create(input: CreateGroupInput, actorUserId: string): Promise<GroupEntityDto> {
    const { data, error } = await supabaseAdmin
      .from('groups')
      .insert({
        nivel: input.nivel,
        autor_text: input.autor,
        autor_user_id: actorUserId,
        nombre: input.nombre,
        descripcion: input.descripcion,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'No se pudo crear grupo');

    if (input.miembros && input.miembros.length) {
      await setMembersForGroup((data as GroupRow).id, input.miembros);
    }

    const created = await this.getById((data as GroupRow).id);
    if (!created) throw new Error('No se pudo cargar grupo creado');
    return created;
  },

  async patch(id: string, patch: PatchGroupInput): Promise<GroupEntityDto | null> {
    const current = await this.getById(id);
    if (!current) return null;

    const toUpdate: Record<string, unknown> = {};
    if (patch.nivel !== undefined) toUpdate.nivel = patch.nivel;
    if (patch.autor !== undefined) toUpdate.autor_text = patch.autor;
    if (patch.nombre !== undefined) toUpdate.nombre = patch.nombre;
    if (patch.descripcion !== undefined) toUpdate.descripcion = patch.descripcion;

    if (Object.keys(toUpdate).length > 0) {
      const { error } = await supabaseAdmin.from('groups').update(toUpdate).eq('id', id);
      if (error) throw new Error(error.message);
    }

    if (patch.miembros !== undefined) {
      await setMembersForGroup(id, patch.miembros);
    }

    return this.getById(id);
  },

  async remove(id: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin.from('groups').delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    return Array.isArray(data) && data.length > 0;
  },

  async addMember(groupId: string, handle: string): Promise<GroupEntityDto | null> {
    const current = await this.getById(groupId);
    if (!current) return null;
    const value = String(handle ?? '').trim();
    if (!value) return current;

    const { userIds, missing } = await resolveHandles([value]);
    if (missing.length) {
      throw new Error(`Miembro no encontrado en profiles: ${missing[0]}`);
    }
    const userId = userIds[0];

    const { data: exists, error: existsErr } = await supabaseAdmin
      .from('group_members')
      .select('group_id,user_id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existsErr) throw new Error(`Error validando miembro: ${existsErr.message}`);

    if (!exists) {
      const { error: insertErr } = await supabaseAdmin.from('group_members').insert({
        group_id: groupId,
        user_id: userId,
        role_in_group: 'member',
      });
      if (insertErr) throw new Error(`Error agregando miembro: ${insertErr.message}`);
    }

    return this.getById(groupId);
  },

  async removeMember(groupId: string, handle: string): Promise<GroupEntityDto | null> {
    const current = await this.getById(groupId);
    if (!current) return null;
    const value = String(handle ?? '').trim();
    if (!value) return current;

    const { userIds } = await resolveHandles([value]);
    if (userIds.length === 0) return current;

    const { error } = await supabaseAdmin
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userIds[0]);
    if (error) throw new Error(`Error removiendo miembro: ${error.message}`);

    return this.getById(groupId);
  },
};

export const groupServiceDebug = { normalizeHandles, randomUUID };
