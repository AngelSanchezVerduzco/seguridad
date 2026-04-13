import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../db/supabase';
import { ticketComments, ticketHistory } from '../db/ticketRelatedColumns';

export type TicketStatus = 'Pendiente' | 'En progreso' | 'Revisión' | 'Finalizada';
export type TicketPriority = 'Baja' | 'Media' | 'Alta';

export type TicketComment = {
  id: string;
  text: string;
  createdAt: number;
  author: string;
};

export type TicketHistoryEntry = {
  id: string;
  changedAt: number;
  field: string;
  from: string;
  to: string;
  by: string;
};

export type TicketEntity = {
  id: string;
  groupId: string;
  titulo: string;
  descripcion: string;
  estado: TicketStatus;
  asignadoA: string;
  prioridad: TicketPriority;
  createdAt: number;
  fechaLimite: number | null;
  comentarios: TicketComment[];
  historial: TicketHistoryEntry[];
  updatedAt: number;
};

/** Fila de `public.tickets` (esquema normalizado en Supabase). */
type TicketRow = {
  id: string;
  group_id: string;
  titulo: string;
  descripcion: string;
  estado: string;
  asignado_a_user_id: string | null;
  asignado_a_text: string | null;
  prioridad: string;
  fecha_limite: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const STATUSES: TicketStatus[] = ['Pendiente', 'En progreso', 'Revisión', 'Finalizada'];
const PRIORITIES: TicketPriority[] = ['Baja', 'Media', 'Alta'];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isStatus(v: string): v is TicketStatus {
  return (STATUSES as string[]).includes(v);
}

function isPriority(v: string): v is TicketPriority {
  return (PRIORITIES as string[]).includes(v);
}

function fechaToDb(ms: number | null | undefined): string | null {
  if (ms === undefined || ms === null) return null;
  const n = Number(ms);
  if (!Number.isFinite(n)) return null;
  return new Date(n).toISOString();
}

function fechaFromDb(s: string | null | undefined): number | null {
  if (s == null || s === '') return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

function profileRowIsAdmin(row: { is_admin?: unknown } | null | undefined): boolean {
  if (!row || typeof row !== 'object') return false;
  const v = row['is_admin'];
  return v === true || v === 'true' || v === 't' || v === 1;
}

/** Admin: null (todos los grupos). Usuario normal: ids de grupos donde es autor o miembro. */
async function allowedGroupIdsForActor(actorUserId: string): Promise<string[] | null> {
  const { data: prof, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', actorUserId)
    .maybeSingle();
  if (profErr) {
    console.error('[ticket-service] allowedGroupIds profiles:', profErr.message);
  }
  if (profileRowIsAdmin(prof as { is_admin?: unknown } | null)) return null;

  const { data: authored, error: errA } = await supabaseAdmin
    .from('groups')
    .select('id')
    .eq('autor_user_id', actorUserId);
  if (errA) throw new Error(errA.message);

  const { data: memberships, error: errM } = await supabaseAdmin
    .from('group_members')
    .select('group_id')
    .eq('user_id', actorUserId);
  if (errM) throw new Error(errM.message);

  const set = new Set<string>();
  for (const r of authored ?? []) set.add((r as { id: string }).id);
  for (const r of memberships ?? []) set.add((r as { group_id: string }).group_id);
  return [...set];
}

async function assertGroupAccess(actorUserId: string, groupId: string): Promise<void> {
  const allowed = await allowedGroupIdsForActor(actorUserId);
  if (allowed === null) return;
  if (!groupId || !allowed.includes(groupId)) {
    throw new Error('No tienes acceso a este grupo');
  }
}

/** Si el valor es un UUID, va a `asignado_a_user_id`; si no, a `asignado_a_text`. `text` nunca es null (columna NOT NULL en BD). */
function splitAsignado(asignadoA: string | undefined): { text: string; userId: string | null } {
  const t = (asignadoA ?? '').trim();
  if (!t) return { text: '', userId: null };
  if (UUID_RE.test(t)) return { text: '', userId: t };
  return { text: t, userId: null };
}

function firstString(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

function parseTime(v: unknown): number {
  if (typeof v === 'string') {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : Date.now();
  }
  return Date.now();
}

function mapRowToComment(row: Record<string, unknown>): TicketComment {
  const id = typeof row.id === 'string' ? row.id : randomUUID();
  const text =
    firstString(row, ['body', 'message', 'text', 'contenido', 'content']) ?? '';
  const author =
    firstString(row, ['author_text', 'author', 'autor', 'author_name']) ??
    String(row.author_user_id ?? row.user_id ?? row.created_by ?? '');
  return {
    id,
    text,
    createdAt: parseTime(row.created_at ?? row.creado_en),
    author,
  };
}

function mapRowToHistory(row: Record<string, unknown>): TicketHistoryEntry {
  return {
    id: typeof row.id === 'string' ? row.id : randomUUID(),
    field: firstString(row, ['field', 'campo', 'field_name']) ?? 'ticket',
    from: firstString(row, ['from_value', 'desde', 'old_value', 'from']) ?? '',
    to: firstString(row, ['to_value', 'hasta', 'new_value', 'to']) ?? '',
    by:
      firstString(row, ['by_text', 'changed_by', 'changed_by_text', 'por', 'by']) ??
      String(row.by_user_id ?? row.changed_by_user_id ?? row.user_id ?? ''),
    changedAt: parseTime(row.changed_at ?? row.created_at ?? row.at),
  };
}

async function loadCommentsForTickets(ticketIds: string[]): Promise<Map<string, TicketComment[]>> {
  const map = new Map<string, TicketComment[]>();
  if (ticketIds.length === 0) return map;
  const { data, error } = await supabaseAdmin
    .from(ticketComments.table)
    .select('*')
    .in('ticket_id', ticketIds);
  if (error) {
    console.error('ticket_comments:', error.message);
    return map;
  }
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const tid = String(r.ticket_id ?? '');
    if (!tid) continue;
    const arr = map.get(tid) ?? [];
    arr.push(mapRowToComment(r));
    map.set(tid, arr);
  }
  for (const [k, arr] of map) {
    arr.sort((a, b) => a.createdAt - b.createdAt);
    map.set(k, arr);
  }
  return map;
}

async function loadHistoryForTickets(ticketIds: string[]): Promise<Map<string, TicketHistoryEntry[]>> {
  const map = new Map<string, TicketHistoryEntry[]>();
  if (ticketIds.length === 0) return map;
  const { data, error } = await supabaseAdmin
    .from(ticketHistory.table)
    .select('*')
    .in('ticket_id', ticketIds);
  if (error) {
    throw new Error(`No se pudo cargar historial (${ticketHistory.table}): ${error.message}`);
  }
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const tid = String(r.ticket_id ?? '');
    if (!tid) continue;
    const arr = map.get(tid) ?? [];
    arr.push(mapRowToHistory(r));
    map.set(tid, arr);
  }
  for (const [k, arr] of map) {
    arr.sort((a, b) => b.changedAt - a.changedAt);
    map.set(k, arr);
  }
  return map;
}

function rowToEntityBase(
  row: TicketRow,
  comments: TicketComment[],
  history: TicketHistoryEntry[],
): TicketEntity {
  const estado = isStatus(row.estado) ? row.estado : 'Pendiente';
  const prioridad = isPriority(row.prioridad) ? row.prioridad : 'Media';
  const createdAt = new Date(row.created_at).getTime();
  const updatedAt = new Date(row.updated_at).getTime();
  const text = (row.asignado_a_text ?? '').trim();
  const uid = (row.asignado_a_user_id ?? '').trim();
  const asignadoA = text || uid;
  return {
    id: row.id,
    groupId: row.group_id,
    titulo: row.titulo,
    descripcion: row.descripcion ?? '',
    estado,
    asignadoA,
    prioridad,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    fechaLimite: fechaFromDb(row.fecha_limite),
    comentarios: comments,
    historial: history,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  };
}

async function enrichRows(rows: TicketRow[]): Promise<TicketEntity[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [cMap, hMap] = await Promise.all([loadCommentsForTickets(ids), loadHistoryForTickets(ids)]);
  return rows.map((row) =>
    rowToEntityBase(row, cMap.get(row.id) ?? [], hMap.get(row.id) ?? []),
  );
}

type HistoryInsertRow = {
  ticketId: string;
  field: string;
  from: string;
  to: string;
  by: string;
  actorUserId?: string;
};

async function insertHistoryRows(rows: HistoryInsertRow[]): Promise<void> {
  if (rows.length === 0) return;
  const k = ticketHistory.insertKeys;
  const payload = rows.map((r) => {
    const ins: Record<string, string> = {
      [k.ticketId]: r.ticketId,
      [k.field]: r.field,
      [k.fromValue]: r.from,
      [k.toValue]: r.to,
    };
    if (k.id) ins[k.id] = randomUUID();
    if (k.byText) ins[k.byText] = r.by;
    if (k.byUserId && r.actorUserId) ins[k.byUserId] = r.actorUserId;
    if (k.changedAt) ins[k.changedAt] = new Date().toISOString();
    return ins;
  });
  const { error } = await supabaseAdmin.from(ticketHistory.table).insert(payload);
  if (error) throw new Error(`Historial: ${error.message}`);
}

function pushChange(
  acc: { field: string; from: string; to: string }[],
  field: string,
  from: unknown,
  to: unknown,
): void {
  const a = String(from ?? '');
  const b = String(to ?? '');
  if (a === b) return;
  acc.push({ field, from: a, to: b });
}

export type CreateTicketInput = {
  groupId: string;
  titulo: string;
  descripcion: string;
  estado?: TicketStatus;
  asignadoA?: string;
  prioridad?: TicketPriority;
  fechaLimite?: number | null;
};

export type PatchTicketInput = Partial<{
  groupId: string;
  titulo: string;
  descripcion: string;
  estado: TicketStatus;
  asignadoA: string;
  prioridad: TicketPriority;
  fechaLimite: number | null;
}>;

export const ticketsService = {
  async listForActor(actorUserId: string, groupId?: string): Promise<TicketEntity[]> {
    const allowed = await allowedGroupIdsForActor(actorUserId);
    let q = supabaseAdmin.from('tickets').select('*').order('updated_at', { ascending: false });
    if (allowed !== null) {
      if (allowed.length === 0) return [];
      q = q.in('group_id', allowed);
    }
    if (groupId) {
      if (allowed !== null && !allowed.includes(groupId)) return [];
      q = q.eq('group_id', groupId);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return enrichRows((data ?? []) as TicketRow[]);
  },

  async getById(id: string): Promise<TicketEntity | null> {
    const { data, error } = await supabaseAdmin.from('tickets').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const rows = await enrichRows([data as TicketRow]);
    return rows[0] ?? null;
  },

  async getByIdForActor(id: string, actorUserId: string): Promise<TicketEntity | null> {
    const t = await this.getById(id);
    if (!t) return null;
    try {
      await assertGroupAccess(actorUserId, t.groupId);
    } catch {
      return null;
    }
    return t;
  },

  async create(input: CreateTicketInput, by: string, createdByUserId: string): Promise<TicketEntity> {
    await assertGroupAccess(createdByUserId, input.groupId);
    const estado = input.estado ?? 'Pendiente';
    const prioridad = input.prioridad ?? 'Media';
    const { text, userId } = splitAsignado(input.asignadoA);

    const row = {
      group_id: input.groupId,
      titulo: input.titulo,
      descripcion: input.descripcion ?? '',
      estado,
      prioridad,
      fecha_limite: fechaToDb(input.fechaLimite),
      asignado_a_text: text,
      asignado_a_user_id: userId,
      created_by: createdByUserId,
    };

    const { data, error } = await supabaseAdmin.from('tickets').insert(row).select('*').single();
    if (error) throw new Error(error.message);
    const ticket = data as TicketRow;

    await insertHistoryRows([
      { ticketId: ticket.id, field: 'Ticket', from: '', to: 'Creado', by, actorUserId: createdByUserId },
    ]);

    const done = await this.getById(ticket.id);
    if (!done) throw new Error('No se pudo recargar el ticket creado');
    return done;
  },

  async update(id: string, patch: PatchTicketInput, by: string, actorUserId: string): Promise<TicketEntity | null> {
    const current = await this.getById(id);
    if (!current) return null;
    await assertGroupAccess(actorUserId, current.groupId);

    const now = Date.now();
    const updated: TicketEntity = {
      ...current,
      ...patch,
      groupId: patch.groupId !== undefined ? patch.groupId : current.groupId,
      titulo: patch.titulo !== undefined ? patch.titulo : current.titulo,
      descripcion: patch.descripcion !== undefined ? patch.descripcion : current.descripcion,
      estado: patch.estado !== undefined ? patch.estado : current.estado,
      asignadoA: patch.asignadoA !== undefined ? patch.asignadoA : current.asignadoA,
      prioridad: patch.prioridad !== undefined ? patch.prioridad : current.prioridad,
      fechaLimite: patch.fechaLimite !== undefined ? patch.fechaLimite : current.fechaLimite,
      updatedAt: now,
    };

    const changes: { field: string; from: string; to: string }[] = [];
    pushChange(changes, 'Grupo', current.groupId, updated.groupId);
    pushChange(changes, 'Título', current.titulo, updated.titulo);
    pushChange(changes, 'Descripción', current.descripcion, updated.descripcion);
    pushChange(changes, 'Estado', current.estado, updated.estado);
    pushChange(changes, 'Asignado a', current.asignadoA, updated.asignadoA);
    pushChange(changes, 'Prioridad', current.prioridad, updated.prioridad);
    pushChange(
      changes,
      'Fecha límite',
      current.fechaLimite ? new Date(current.fechaLimite).toISOString() : '',
      updated.fechaLimite ? new Date(updated.fechaLimite).toISOString() : '',
    );

    await assertGroupAccess(actorUserId, updated.groupId);

    const { text, userId } = splitAsignado(updated.asignadoA);

    const dbPatch = {
      group_id: updated.groupId,
      titulo: updated.titulo,
      descripcion: updated.descripcion,
      estado: updated.estado,
      prioridad: updated.prioridad,
      fecha_limite: fechaToDb(updated.fechaLimite),
      asignado_a_text: text,
      asignado_a_user_id: userId,
      updated_at: new Date(now).toISOString(),
    };

    const { data, error } = await supabaseAdmin.from('tickets').update(dbPatch).eq('id', id).select('*').single();
    if (error) throw new Error(error.message);

    if (changes.length) {
      await insertHistoryRows(
        changes.map((c) => ({ ticketId: id, ...c, by, actorUserId: actorUserId })),
      );
    }

    return this.getById((data as TicketRow).id);
  },

  async remove(id: string, actorUserId: string): Promise<boolean> {
    const cur = await this.getById(id);
    if (!cur) return false;
    await assertGroupAccess(actorUserId, cur.groupId);
    const { data, error } = await supabaseAdmin.from('tickets').delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    return Array.isArray(data) && data.length > 0;
  },

  async addComment(id: string, text: string, by: string, actorUserId: string): Promise<TicketEntity | null> {
    const current = await this.getById(id);
    if (!current) return null;
    await assertGroupAccess(actorUserId, current.groupId);

    const trimmed = text.trim();
    if (!trimmed) return current;

    const k = ticketComments.insertKeys;
    const ins: Record<string, string> = {
      [k.ticketId]: id,
      [k.body]: trimmed,
    };
    if (k.author) ins[k.author] = by;
    if (k.userId) ins[k.userId] = actorUserId;

    const { error: cErr } = await supabaseAdmin.from(ticketComments.table).insert(ins);
    if (cErr) throw new Error(cErr.message);

    await insertHistoryRows([
      {
        ticketId: id,
        field: 'Comentario',
        from: '',
        to: trimmed.slice(0, 120),
        by,
        actorUserId,
      },
    ]);

    const { error: uErr } = await supabaseAdmin
      .from('tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
    if (uErr) throw new Error(uErr.message);

    return this.getById(id);
  },
};
