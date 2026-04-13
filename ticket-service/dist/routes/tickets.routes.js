"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketsRoutes = ticketsRoutes;
const validateBody_1 = require("../lib/validateBody");
const requireAuth_1 = require("../hooks/requireAuth");
const tickets_service_1 = require("../services/tickets.service");
const apiResponse_1 = require("../utils/apiResponse");
const ticket_comment_schema_json_1 = __importDefault(require("../schemas/ticket-comment.schema.json"));
const ticket_create_schema_json_1 = __importDefault(require("../schemas/ticket-create.schema.json"));
const ticket_patch_schema_json_1 = __importDefault(require("../schemas/ticket-patch.schema.json"));
const validateCreate = (0, validateBody_1.compileSchema)(ticket_create_schema_json_1.default);
const validatePatch = (0, validateBody_1.compileSchema)(ticket_patch_schema_json_1.default);
const validateComment = (0, validateBody_1.compileSchema)(ticket_comment_schema_json_1.default);
async function ticketsRoutes(app) {
    app.get('/api/tickets/health', async (_req, reply) => {
        return (0, apiResponse_1.sendSuccess)(reply, 200, 'OK', [{ service: 'ticket-service' }]);
    });
    app.get('/api/tickets', { preHandler: requireAuth_1.requireAuth }, async (req, reply) => {
        const q = req.query;
        const groupId = q.groupId?.trim() || undefined;
        try {
            if (!req.userId) {
                return (0, apiResponse_1.sendError)(reply, 401, 'Usuario no identificado');
            }
            const list = await tickets_service_1.ticketsService.listForActor(req.userId, groupId);
            return (0, apiResponse_1.sendSuccess)(reply, 200, 'Listado de tickets', list);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'Error listando tickets';
            return (0, apiResponse_1.sendError)(reply, 500, msg);
        }
    });
    app.post('/api/tickets', { preHandler: requireAuth_1.requireAuth }, async (req, reply) => {
        if (!(0, validateBody_1.validateBodyOrReply)(reply, validateCreate, req.body)) {
            return;
        }
        const b = req.body;
        const input = {
            groupId: String(b.groupId),
            titulo: String(b.titulo),
            descripcion: String(b.descripcion ?? ''),
        };
        if (b.estado !== undefined)
            input.estado = b.estado;
        if (b.asignadoA !== undefined)
            input.asignadoA = String(b.asignadoA);
        if (b.prioridad !== undefined)
            input.prioridad = b.prioridad;
        if (b.fechaLimite !== undefined) {
            input.fechaLimite = b.fechaLimite === null ? null : Number(b.fechaLimite);
        }
        try {
            if (!req.userId) {
                return (0, apiResponse_1.sendError)(reply, 401, 'Usuario no identificado');
            }
            const created = await tickets_service_1.ticketsService.create(input, req.userLabel ?? 'anon', req.userId);
            return (0, apiResponse_1.sendSuccess)(reply, 201, 'Ticket creado', created);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'Error creando ticket';
            return (0, apiResponse_1.sendError)(reply, 500, msg);
        }
    });
    app.get('/api/tickets/:id', { preHandler: requireAuth_1.requireAuth }, async (req, reply) => {
        const { id } = req.params;
        try {
            if (!req.userId) {
                return (0, apiResponse_1.sendError)(reply, 401, 'Usuario no identificado');
            }
            const ticket = await tickets_service_1.ticketsService.getByIdForActor(id, req.userId);
            if (!ticket) {
                return (0, apiResponse_1.sendError)(reply, 404, 'Ticket no encontrado');
            }
            return (0, apiResponse_1.sendSuccess)(reply, 200, 'Ticket', ticket);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'Error obteniendo ticket';
            return (0, apiResponse_1.sendError)(reply, 500, msg);
        }
    });
    app.patch('/api/tickets/:id', { preHandler: requireAuth_1.requireAuth }, async (req, reply) => {
        const { id } = req.params;
        if (!(0, validateBody_1.validateBodyOrReply)(reply, validatePatch, req.body)) {
            return;
        }
        const b = req.body;
        const patch = {};
        if ('groupId' in b)
            patch.groupId = String(b.groupId);
        if ('titulo' in b)
            patch.titulo = String(b.titulo);
        if ('descripcion' in b)
            patch.descripcion = String(b.descripcion);
        if ('estado' in b)
            patch.estado = b.estado;
        if ('asignadoA' in b)
            patch.asignadoA = String(b.asignadoA);
        if ('prioridad' in b)
            patch.prioridad = b.prioridad;
        if ('fechaLimite' in b) {
            patch.fechaLimite = b.fechaLimite === null ? null : Number(b.fechaLimite);
        }
        try {
            if (!req.userId) {
                return (0, apiResponse_1.sendError)(reply, 401, 'Usuario no identificado');
            }
            const updated = await tickets_service_1.ticketsService.update(id, patch, req.userLabel ?? 'anon', req.userId);
            if (!updated) {
                return (0, apiResponse_1.sendError)(reply, 404, 'Ticket no encontrado');
            }
            return (0, apiResponse_1.sendSuccess)(reply, 200, 'Ticket actualizado', updated);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'Error actualizando ticket';
            return (0, apiResponse_1.sendError)(reply, 500, msg);
        }
    });
    app.delete('/api/tickets/:id', { preHandler: requireAuth_1.requireAuth }, async (req, reply) => {
        const { id } = req.params;
        try {
            if (!req.userId) {
                return (0, apiResponse_1.sendError)(reply, 401, 'Usuario no identificado');
            }
            const ok = await tickets_service_1.ticketsService.remove(id, req.userId);
            if (!ok) {
                return (0, apiResponse_1.sendError)(reply, 404, 'Ticket no encontrado');
            }
            return (0, apiResponse_1.sendSuccess)(reply, 200, 'Ticket eliminado', { id });
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'Error eliminando ticket';
            return (0, apiResponse_1.sendError)(reply, 500, msg);
        }
    });
    app.post('/api/tickets/:id/comments', { preHandler: requireAuth_1.requireAuth }, async (req, reply) => {
        const { id } = req.params;
        if (!(0, validateBody_1.validateBodyOrReply)(reply, validateComment, req.body)) {
            return;
        }
        const { text } = req.body;
        try {
            if (!req.userId) {
                return (0, apiResponse_1.sendError)(reply, 401, 'Usuario no identificado');
            }
            const updated = await tickets_service_1.ticketsService.addComment(id, text, req.userLabel ?? 'anon', req.userId);
            if (!updated) {
                return (0, apiResponse_1.sendError)(reply, 404, 'Ticket no encontrado');
            }
            return (0, apiResponse_1.sendSuccess)(reply, 200, 'Comentario agregado', updated);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'Error agregando comentario';
            return (0, apiResponse_1.sendError)(reply, 500, msg);
        }
    });
}
