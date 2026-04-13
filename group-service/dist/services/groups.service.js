"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupServiceDebug = exports.groupsService = void 0;
const node_crypto_1 = require("node:crypto");
const supabase_1 = require("../db/supabase");
function toLowerTrim(value) {
    return value.toLowerCase().trim();
}
function normalizeHandles(handles) {
    const list = Array.isArray(handles) ? handles : [];
    const acc = [];
    const seen = new Set();
    for (const raw of list) {
        const v = String(raw ?? '').trim();
        if (!v)
            continue;
        const key = toLowerTrim(v);
        if (seen.has(key))
            continue;
        seen.add(key);
        acc.push(v);
    }
    return acc;
}
async function fetchProfilesByHandles(handles) {
    if (handles.length === 0)
        return [];
    const lower = handles.map((h) => toLowerTrim(h));
    const [emailRes, userRes] = await Promise.all([
        supabase_1.supabaseAdmin.from('profiles').select('id,email,usuario').in('email', lower),
        supabase_1.supabaseAdmin.from('profiles').select('id,email,usuario').in('usuario', handles),
    ]);
    if (emailRes.error)
        throw new Error(`Error consultando profiles por email: ${emailRes.error.message}`);
    if (userRes.error)
        throw new Error(`Error consultando profiles por usuario: ${userRes.error.message}`);
    const map = new Map();
    for (const p of [...(emailRes.data ?? []), ...(userRes.data ?? [])]) {
        map.set(p.id, p);
    }
    return [...map.values()];
}
function pickHandleForProfile(p) {
    const email = (p.email ?? '').trim();
    if (email)
        return email;
    const user = (p.usuario ?? '').trim();
    if (user)
        return user;
    return p.id;
}
function profileRowIsAdmin(row) {
    if (!row || typeof row !== 'object')
        return false;
    const v = row['is_admin'];
    return v === true || v === 'true' || v === 't' || v === 1;
}
function sortGroupRowsByCreatedDesc(rows) {
    return [...rows].sort((a, b) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        return tb - ta;
    });
}
async function resolveHandles(handles) {
    const normalized = normalizeHandles(handles);
    if (normalized.length === 0)
        return { userIds: [], missing: [] };
    const profiles = await fetchProfilesByHandles(normalized);
    const byEmail = new Map();
    const byUser = new Map();
    for (const p of profiles) {
        const email = (p.email ?? '').trim().toLowerCase();
        const user = (p.usuario ?? '').trim();
        if (email)
            byEmail.set(email, p.id);
        if (user)
            byUser.set(user, p.id);
    }
    const userIds = [];
    const missing = [];
    const seen = new Set();
    for (const h of normalized) {
        const key = toLowerTrim(h);
        const uid = byEmail.get(key) ?? byUser.get(h);
        if (!uid) {
            missing.push(h);
            continue;
        }
        if (seen.has(uid))
            continue;
        seen.add(uid);
        userIds.push(uid);
    }
    return { userIds, missing };
}
async function mapGroupsToDto(rows) {
    if (rows.length === 0)
        return [];
    const groupIds = rows.map((r) => r.id);
    const authorIds = rows.map((r) => r.autor_user_id).filter((v) => !!v);
    const [membersRes, authorsRes, ticketsRes] = await Promise.all([
        supabase_1.supabaseAdmin.from('group_members').select('group_id,user_id,role_in_group').in('group_id', groupIds),
        authorIds.length
            ? supabase_1.supabaseAdmin.from('profiles').select('id,email,usuario').in('id', authorIds)
            : Promise.resolve({ data: [], error: null }),
        supabase_1.supabaseAdmin.from('tickets').select('group_id').in('group_id', groupIds),
    ]);
    if (membersRes.error)
        throw new Error(`Error consultando group_members: ${membersRes.error.message}`);
    if (authorsRes.error) {
        throw new Error(`Error consultando autores: ${authorsRes.error.message}`);
    }
    if (ticketsRes.error)
        throw new Error(`Error consultando tickets: ${ticketsRes.error.message}`);
    const members = membersRes.data;
    const authorProfiles = authorsRes.data ?? [];
    const authorById = new Map(authorProfiles.map((p) => [p.id, pickHandleForProfile(p)]));
    const memberUserIds = [...new Set(members.map((m) => m.user_id))];
    const membersProfilesRes = memberUserIds.length
        ? await supabase_1.supabaseAdmin.from('profiles').select('id,email,usuario').in('id', memberUserIds)
        : { data: [], error: null };
    if (membersProfilesRes.error) {
        throw new Error(`Error consultando perfiles de miembros: ${membersProfilesRes.error.message}`);
    }
    const memberProfileById = new Map(membersProfilesRes.data.map((p) => [p.id, p]));
    const miembrosByGroup = new Map();
    for (const row of members) {
        const profile = memberProfileById.get(row.user_id);
        const handle = profile ? pickHandleForProfile(profile) : row.user_id;
        const list = miembrosByGroup.get(row.group_id) ?? [];
        list.push(handle);
        miembrosByGroup.set(row.group_id, list);
    }
    const ticketsByGroup = new Map();
    for (const t of (ticketsRes.data ?? [])) {
        const c = ticketsByGroup.get(t.group_id) ?? 0;
        ticketsByGroup.set(t.group_id, c + 1);
    }
    return rows.map((g) => {
        const createdAt = new Date(g.created_at).getTime();
        const miembros = miembrosByGroup.get(g.id) ?? [];
        const autor = (g.autor_text ?? '').trim() ||
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
async function setMembersForGroup(groupId, handles) {
    const { userIds, missing } = await resolveHandles(handles);
    if (missing.length) {
        throw new Error(`Miembros no encontrados en profiles: ${missing.join(', ')}`);
    }
    const { error: deleteErr } = await supabase_1.supabaseAdmin.from('group_members').delete().eq('group_id', groupId);
    if (deleteErr)
        throw new Error(`Error limpiando miembros: ${deleteErr.message}`);
    if (userIds.length === 0)
        return;
    const payload = userIds.map((uid) => ({
        group_id: groupId,
        user_id: uid,
        role_in_group: 'member',
    }));
    const { error: insertErr } = await supabase_1.supabaseAdmin.from('group_members').insert(payload);
    if (insertErr)
        throw new Error(`Error insertando miembros: ${insertErr.message}`);
}
exports.groupsService = {
    /**
     * Admin (profiles.is_admin): todos los grupos.
     * Usuario normal: grupos donde es autor o miembro de group_members.
     */
    async listForActor(actorUserId) {
        const { data: prof, error: profErr } = await supabase_1.supabaseAdmin
            .from('profiles')
            .select('is_admin')
            .eq('id', actorUserId)
            .maybeSingle();
        if (profErr) {
            console.error('[group-service] listForActor: profiles:', profErr.message);
        }
        const isAdmin = profileRowIsAdmin(prof);
        let rows = [];
        if (isAdmin) {
            const { data, error } = await supabase_1.supabaseAdmin.from('groups').select('*').order('created_at', { ascending: false });
            if (error)
                throw new Error(error.message);
            rows = (data ?? []);
        }
        else {
            const { data: authored, error: errA } = await supabase_1.supabaseAdmin
                .from('groups')
                .select('*')
                .eq('autor_user_id', actorUserId);
            if (errA)
                throw new Error(errA.message);
            const { data: memberships, error: errM } = await supabase_1.supabaseAdmin
                .from('group_members')
                .select('group_id')
                .eq('user_id', actorUserId);
            if (errM)
                throw new Error(errM.message);
            const memberIds = [...new Set((memberships ?? []).map((m) => m.group_id))];
            const { data: memberGroups, error: errG } = memberIds.length > 0
                ? await supabase_1.supabaseAdmin.from('groups').select('*').in('id', memberIds)
                : { data: [], error: null };
            if (errG)
                throw new Error(errG.message);
            const byId = new Map();
            for (const r of [...(authored ?? []), ...(memberGroups ?? [])]) {
                byId.set(r.id, r);
            }
            rows = sortGroupRowsByCreatedDesc([...byId.values()]);
        }
        return mapGroupsToDto(rows);
    },
    async getById(id) {
        const { data, error } = await supabase_1.supabaseAdmin.from('groups').select('*').eq('id', id).maybeSingle();
        if (error)
            throw new Error(error.message);
        if (!data)
            return null;
        const arr = await mapGroupsToDto([data]);
        return arr[0] ?? null;
    },
    async create(input, actorUserId) {
        const { data, error } = await supabase_1.supabaseAdmin
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
        if (error || !data)
            throw new Error(error?.message ?? 'No se pudo crear grupo');
        if (input.miembros && input.miembros.length) {
            await setMembersForGroup(data.id, input.miembros);
        }
        const created = await this.getById(data.id);
        if (!created)
            throw new Error('No se pudo cargar grupo creado');
        return created;
    },
    async patch(id, patch) {
        const current = await this.getById(id);
        if (!current)
            return null;
        const toUpdate = {};
        if (patch.nivel !== undefined)
            toUpdate.nivel = patch.nivel;
        if (patch.autor !== undefined)
            toUpdate.autor_text = patch.autor;
        if (patch.nombre !== undefined)
            toUpdate.nombre = patch.nombre;
        if (patch.descripcion !== undefined)
            toUpdate.descripcion = patch.descripcion;
        if (Object.keys(toUpdate).length > 0) {
            const { error } = await supabase_1.supabaseAdmin.from('groups').update(toUpdate).eq('id', id);
            if (error)
                throw new Error(error.message);
        }
        if (patch.miembros !== undefined) {
            await setMembersForGroup(id, patch.miembros);
        }
        return this.getById(id);
    },
    async remove(id) {
        const { data, error } = await supabase_1.supabaseAdmin.from('groups').delete().eq('id', id).select('id');
        if (error)
            throw new Error(error.message);
        return Array.isArray(data) && data.length > 0;
    },
    async addMember(groupId, handle) {
        const current = await this.getById(groupId);
        if (!current)
            return null;
        const value = String(handle ?? '').trim();
        if (!value)
            return current;
        const { userIds, missing } = await resolveHandles([value]);
        if (missing.length) {
            throw new Error(`Miembro no encontrado en profiles: ${missing[0]}`);
        }
        const userId = userIds[0];
        const { data: exists, error: existsErr } = await supabase_1.supabaseAdmin
            .from('group_members')
            .select('group_id,user_id')
            .eq('group_id', groupId)
            .eq('user_id', userId)
            .maybeSingle();
        if (existsErr)
            throw new Error(`Error validando miembro: ${existsErr.message}`);
        if (!exists) {
            const { error: insertErr } = await supabase_1.supabaseAdmin.from('group_members').insert({
                group_id: groupId,
                user_id: userId,
                role_in_group: 'member',
            });
            if (insertErr)
                throw new Error(`Error agregando miembro: ${insertErr.message}`);
        }
        return this.getById(groupId);
    },
    async removeMember(groupId, handle) {
        const current = await this.getById(groupId);
        if (!current)
            return null;
        const value = String(handle ?? '').trim();
        if (!value)
            return current;
        const { userIds } = await resolveHandles([value]);
        if (userIds.length === 0)
            return current;
        const { error } = await supabase_1.supabaseAdmin
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', userIds[0]);
        if (error)
            throw new Error(`Error removiendo miembro: ${error.message}`);
        return this.getById(groupId);
    },
};
exports.groupServiceDebug = { normalizeHandles, randomUUID: node_crypto_1.randomUUID };
