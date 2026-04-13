"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketsService = void 0;
const node_crypto_1 = require("node:crypto");
const supabase_1 = require("../db/supabase");
const ticketRelatedColumns_1 = require("../db/ticketRelatedColumns");
const STATUSES = ['Pendiente', 'En progreso', 'Revisión', 'Finalizada'];
const PRIORITIES = ['Baja', 'Media', 'Alta'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isStatus(v) {
    return STATUSES.includes(v);
}
function isPriority(v) {
    return PRIORITIES.includes(v);
}
function fechaToDb(ms) {
    if (ms === undefined || ms === null)
        return null;
    const n = Number(ms);
    if (!Number.isFinite(n))
        return null;
    return new Date(n).toISOString();
}
function fechaFromDb(s) {
    if (s == null || s === '')
        return null;
    const t = new Date(s).getTime();
    return Number.isFinite(t) ? t : null;
}
function profileRowIsAdmin(row) {
    if (!row || typeof row !== 'object')
        return false;
    const v = row['is_admin'];
    return v === true || v === 'true' || v === 't' || v === 1;
}
/** Admin: null (todos los grupos). Usuario normal: ids de grupos donde es autor o miembro. */
async function allowedGroupIdsForActor(actorUserId) {
    const { data: prof, error: profErr } = await supabase_1.supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', actorUserId)
        .maybeSingle();
    if (profErr) {
        console.error('[ticket-service] allowedGroupIds profiles:', profErr.message);
    }
    if (profileRowIsAdmin(prof))
        return null;
    const { data: authored, error: errA } = await supabase_1.supabaseAdmin
        .from('groups')
        .select('id')
        .eq('autor_user_id', actorUserId);
    if (errA)
        throw new Error(errA.message);
    const { data: memberships, error: errM } = await supabase_1.supabaseAdmin
        .from('group_members')
        .select('group_id')
        .eq('user_id', actorUserId);
    if (errM)
        throw new Error(errM.message);
    const set = new Set();
    for (const r of authored ?? [])
        set.add(r.id);
    for (const r of memberships ?? [])
        set.add(r.group_id);
    return [...set];
}
async function assertGroupAccess(actorUserId, groupId) {
    const allowed = await allowedGroupIdsForActor(actorUserId);
    if (allowed === null)
        return;
    if (!groupId || !allowed.includes(groupId)) {
        throw new Error('No tienes acceso a este grupo');
    }
}
/** Si el valor es un UUID, va a `asignado_a_user_id`; si no, a `asignado_a_text`. `text` nunca es null (columna NOT NULL en BD). */
function splitAsignado(asignadoA) {
    const t = (asignadoA ?? '').trim();
    if (!t)
        return { text: '', userId: null };
    if (UUID_RE.test(t))
        return { text: '', userId: t };
    return { text: t, userId: null };
}
function firstString(row, keys) {
    for (const k of keys) {
        const v = row[k];
        if (typeof v === 'string' && v.length > 0)
            return v;
    }
    return undefined;
}
function parseTime(v) {
    if (typeof v === 'string') {
        const t = new Date(v).getTime();
        return Number.isFinite(t) ? t : Date.now();
    }
    return Date.now();
}
function mapRowToComment(row) {
    const id = typeof row.id === 'string' ? row.id : (0, node_crypto_1.randomUUID)();
    const text = firstString(row, ['body', 'message', 'text', 'contenido', 'content']) ?? '';
    const author = firstString(row, ['author_text', 'author', 'autor', 'author_name']) ??
        String(row.author_user_id ?? row.user_id ?? row.created_by ?? '');
    return {
        id,
        text,
        createdAt: parseTime(row.created_at ?? row.creado_en),
        author,
    };
}
function mapRowToHistory(row) {
    return {
        id: typeof row.id === 'string' ? row.id : (0, node_crypto_1.randomUUID)(),
        field: firstString(row, ['field', 'campo', 'field_name']) ?? 'ticket',
        from: firstString(row, ['from_value', 'desde', 'old_value', 'from']) ?? '',
        to: firstString(row, ['to_value', 'hasta', 'new_value', 'to']) ?? '',
        by: firstString(row, ['by_text', 'changed_by', 'changed_by_text', 'por', 'by']) ??
            String(row.by_user_id ?? row.changed_by_user_id ?? row.user_id ?? ''),
        changedAt: parseTime(row.changed_at ?? row.created_at ?? row.at),
    };
}
async function loadCommentsForTickets(ticketIds) {
    const map = new Map();
    if (ticketIds.length === 0)
        return map;
    const { data, error } = await supabase_1.supabaseAdmin
        .from(ticketRelatedColumns_1.ticketComments.table)
        .select('*')
        .in('ticket_id', ticketIds);
    if (error) {
        console.error('ticket_comments:', error.message);
        return map;
    }
    for (const row of data ?? []) {
        const r = row;
        const tid = String(r.ticket_id ?? '');
        if (!tid)
            continue;
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
async function loadHistoryForTickets(ticketIds) {
    const map = new Map();
    if (ticketIds.length === 0)
        return map;
    const { data, error } = await supabase_1.supabaseAdmin
        .from(ticketRelatedColumns_1.ticketHistory.table)
        .select('*')
        .in('ticket_id', ticketIds);
    if (error) {
        throw new Error(`No se pudo cargar historial (${ticketRelatedColumns_1.ticketHistory.table}): ${error.message}`);
    }
    for (const row of data ?? []) {
        const r = row;
        const tid = String(r.ticket_id ?? '');
        if (!tid)
            continue;
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
function rowToEntityBase(row, comments, history) {
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
async function enrichRows(rows) {
    if (rows.length === 0)
        return [];
    const ids = rows.map((r) => r.id);
    const [cMap, hMap] = await Promise.all([loadCommentsForTickets(ids), loadHistoryForTickets(ids)]);
    return rows.map((row) => rowToEntityBase(row, cMap.get(row.id) ?? [], hMap.get(row.id) ?? []));
}
async function insertHistoryRows(rows) {
    if (rows.length === 0)
        return;
    const k = ticketRelatedColumns_1.ticketHistory.insertKeys;
    const payload = rows.map((r) => {
        const ins = {
            [k.ticketId]: r.ticketId,
            [k.field]: r.field,
            [k.fromValue]: r.from,
            [k.toValue]: r.to,
        };
        if (k.id)
            ins[k.id] = (0, node_crypto_1.randomUUID)();
        if (k.byText)
            ins[k.byText] = r.by;
        if (k.byUserId && r.actorUserId)
            ins[k.byUserId] = r.actorUserId;
        if (k.changedAt)
            ins[k.changedAt] = new Date().toISOString();
        return ins;
    });
    const { error } = await supabase_1.supabaseAdmin.from(ticketRelatedColumns_1.ticketHistory.table).insert(payload);
    if (error)
        throw new Error(`Historial: ${error.message}`);
}
function pushChange(acc, field, from, to) {
    const a = String(from ?? '');
    const b = String(to ?? '');
    if (a === b)
        return;
    acc.push({ field, from: a, to: b });
}
exports.ticketsService = {
    async listForActor(actorUserId, groupId) {
        const allowed = await allowedGroupIdsForActor(actorUserId);
        let q = supabase_1.supabaseAdmin.from('tickets').select('*').order('updated_at', { ascending: false });
        if (allowed !== null) {
            if (allowed.length === 0)
                return [];
            q = q.in('group_id', allowed);
        }
        if (groupId) {
            if (allowed !== null && !allowed.includes(groupId))
                return [];
            q = q.eq('group_id', groupId);
        }
        const { data, error } = await q;
        if (error)
            throw new Error(error.message);
        return enrichRows((data ?? []));
    },
    async getById(id) {
        const { data, error } = await supabase_1.supabaseAdmin.from('tickets').select('*').eq('id', id).maybeSingle();
        if (error)
            throw new Error(error.message);
        if (!data)
            return null;
        const rows = await enrichRows([data]);
        return rows[0] ?? null;
    },
    async getByIdForActor(id, actorUserId) {
        const t = await this.getById(id);
        if (!t)
            return null;
        try {
            await assertGroupAccess(actorUserId, t.groupId);
        }
        catch {
            return null;
        }
        return t;
    },
    async create(input, by, createdByUserId) {
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
        const { data, error } = await supabase_1.supabaseAdmin.from('tickets').insert(row).select('*').single();
        if (error)
            throw new Error(error.message);
        const ticket = data;
        await insertHistoryRows([
            { ticketId: ticket.id, field: 'Ticket', from: '', to: 'Creado', by, actorUserId: createdByUserId },
        ]);
        const done = await this.getById(ticket.id);
        if (!done)
            throw new Error('No se pudo recargar el ticket creado');
        return done;
    },
    async update(id, patch, by, actorUserId) {
        const current = await this.getById(id);
        if (!current)
            return null;
        await assertGroupAccess(actorUserId, current.groupId);
        const now = Date.now();
        const updated = {
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
        const changes = [];
        pushChange(changes, 'Grupo', current.groupId, updated.groupId);
        pushChange(changes, 'Título', current.titulo, updated.titulo);
        pushChange(changes, 'Descripción', current.descripcion, updated.descripcion);
        pushChange(changes, 'Estado', current.estado, updated.estado);
        pushChange(changes, 'Asignado a', current.asignadoA, updated.asignadoA);
        pushChange(changes, 'Prioridad', current.prioridad, updated.prioridad);
        pushChange(changes, 'Fecha límite', current.fechaLimite ? new Date(current.fechaLimite).toISOString() : '', updated.fechaLimite ? new Date(updated.fechaLimite).toISOString() : '');
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
        const { data, error } = await supabase_1.supabaseAdmin.from('tickets').update(dbPatch).eq('id', id).select('*').single();
        if (error)
            throw new Error(error.message);
        if (changes.length) {
            await insertHistoryRows(changes.map((c) => ({ ticketId: id, ...c, by, actorUserId: actorUserId })));
        }
        return this.getById(data.id);
    },
    async remove(id, actorUserId) {
        const cur = await this.getById(id);
        if (!cur)
            return false;
        await assertGroupAccess(actorUserId, cur.groupId);
        const { data, error } = await supabase_1.supabaseAdmin.from('tickets').delete().eq('id', id).select('id');
        if (error)
            throw new Error(error.message);
        return Array.isArray(data) && data.length > 0;
    },
    async addComment(id, text, by, actorUserId) {
        const current = await this.getById(id);
        if (!current)
            return null;
        await assertGroupAccess(actorUserId, current.groupId);
        const trimmed = text.trim();
        if (!trimmed)
            return current;
        const k = ticketRelatedColumns_1.ticketComments.insertKeys;
        const ins = {
            [k.ticketId]: id,
            [k.body]: trimmed,
        };
        if (k.author)
            ins[k.author] = by;
        if (k.userId)
            ins[k.userId] = actorUserId;
        const { error: cErr } = await supabase_1.supabaseAdmin.from(ticketRelatedColumns_1.ticketComments.table).insert(ins);
        if (cErr)
            throw new Error(cErr.message);
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
        const { error: uErr } = await supabase_1.supabaseAdmin
            .from('tickets')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', id);
        if (uErr)
            throw new Error(uErr.message);
        return this.getById(id);
    },
};
