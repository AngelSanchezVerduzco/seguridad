import type { FastifyInstance } from 'fastify';
import { compileSchema, validateBodyOrReply } from '../lib/validateBody';
import { requireAuth } from '../hooks/requireAuth';
import {
  ticketsService,
  type CreateTicketInput,
  type PatchTicketInput,
  type TicketPriority,
  type TicketStatus,
} from '../services/tickets.service';
import { sendError, sendSuccess } from '../utils/apiResponse';

import commentSchema from '../schemas/ticket-comment.schema.json';
import createSchema from '../schemas/ticket-create.schema.json';
import patchSchema from '../schemas/ticket-patch.schema.json';

const validateCreate = compileSchema(createSchema);
const validatePatch = compileSchema(patchSchema);
const validateComment = compileSchema(commentSchema);

export async function ticketsRoutes(app: FastifyInstance) {
  app.get('/api/tickets/health', async (_req, reply) => {
    return sendSuccess(reply, 200, 'OK', [{ service: 'ticket-service' }]);
  });

  app.get(
    '/api/tickets',
    { preHandler: requireAuth },
    async (req, reply) => {
      const q = req.query as { groupId?: string };
      const groupId = q.groupId?.trim() || undefined;
      try {
        if (!req.userId) {
          return sendError(reply, 401, 'Usuario no identificado');
        }
        const list = await ticketsService.listForActor(req.userId, groupId);
        return sendSuccess(reply, 200, 'Listado de tickets', list);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error listando tickets';
        return sendError(reply, 500, msg);
      }
    },
  );

  app.post(
    '/api/tickets',
    { preHandler: requireAuth },
    async (req, reply) => {
      if (!validateBodyOrReply<Record<string, unknown>>(reply, validateCreate, req.body)) {
        return;
      }
      const b = req.body as Record<string, unknown>;
      const input: CreateTicketInput = {
        groupId: String(b.groupId),
        titulo: String(b.titulo),
        descripcion: String(b.descripcion ?? ''),
      };
      if (b.estado !== undefined) input.estado = b.estado as TicketStatus;
      if (b.asignadoA !== undefined) input.asignadoA = String(b.asignadoA);
      if (b.prioridad !== undefined) input.prioridad = b.prioridad as TicketPriority;
      if (b.fechaLimite !== undefined) {
        input.fechaLimite = b.fechaLimite === null ? null : Number(b.fechaLimite);
      }
      try {
        if (!req.userId) {
          return sendError(reply, 401, 'Usuario no identificado');
        }
        const created = await ticketsService.create(input, req.userLabel ?? 'anon', req.userId);
        return sendSuccess(reply, 201, 'Ticket creado', created);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error creando ticket';
        return sendError(reply, 500, msg);
      }
    },
  );

  app.get(
    '/api/tickets/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        if (!req.userId) {
          return sendError(reply, 401, 'Usuario no identificado');
        }
        const ticket = await ticketsService.getByIdForActor(id, req.userId);
        if (!ticket) {
          return sendError(reply, 404, 'Ticket no encontrado');
        }
        return sendSuccess(reply, 200, 'Ticket', ticket);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error obteniendo ticket';
        return sendError(reply, 500, msg);
      }
    },
  );

  app.patch(
    '/api/tickets/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!validateBodyOrReply<Record<string, unknown>>(reply, validatePatch, req.body)) {
        return;
      }
      const b = req.body as Record<string, unknown>;
      const patch: PatchTicketInput = {};
      if ('groupId' in b) patch.groupId = String(b.groupId);
      if ('titulo' in b) patch.titulo = String(b.titulo);
      if ('descripcion' in b) patch.descripcion = String(b.descripcion);
      if ('estado' in b) patch.estado = b.estado as TicketStatus;
      if ('asignadoA' in b) patch.asignadoA = String(b.asignadoA);
      if ('prioridad' in b) patch.prioridad = b.prioridad as TicketPriority;
      if ('fechaLimite' in b) {
        patch.fechaLimite = b.fechaLimite === null ? null : Number(b.fechaLimite);
      }
      try {
        if (!req.userId) {
          return sendError(reply, 401, 'Usuario no identificado');
        }
        const updated = await ticketsService.update(id, patch, req.userLabel ?? 'anon', req.userId);
        if (!updated) {
          return sendError(reply, 404, 'Ticket no encontrado');
        }
        return sendSuccess(reply, 200, 'Ticket actualizado', updated);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error actualizando ticket';
        return sendError(reply, 500, msg);
      }
    },
  );

  app.delete(
    '/api/tickets/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        if (!req.userId) {
          return sendError(reply, 401, 'Usuario no identificado');
        }
        const ok = await ticketsService.remove(id, req.userId);
        if (!ok) {
          return sendError(reply, 404, 'Ticket no encontrado');
        }
        return sendSuccess(reply, 200, 'Ticket eliminado', { id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error eliminando ticket';
        return sendError(reply, 500, msg);
      }
    },
  );

  app.post(
    '/api/tickets/:id/comments',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!validateBodyOrReply<{ text: string }>(reply, validateComment, req.body)) {
        return;
      }
      const { text } = req.body as { text: string };
      try {
        if (!req.userId) {
          return sendError(reply, 401, 'Usuario no identificado');
        }
        const updated = await ticketsService.addComment(id, text, req.userLabel ?? 'anon', req.userId);
        if (!updated) {
          return sendError(reply, 404, 'Ticket no encontrado');
        }
        return sendSuccess(reply, 200, 'Comentario agregado', updated);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error agregando comentario';
        return sendError(reply, 500, msg);
      }
    },
  );
}
