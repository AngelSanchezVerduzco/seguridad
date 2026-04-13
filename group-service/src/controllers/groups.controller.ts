import type { Request, Response } from 'express';
import { groupsService, type CreateGroupInput, type PatchGroupInput } from '../services/groups.service';
import { sendError, sendSuccess } from '../utils/apiResponse';

function routeId(req: Request): string {
  const id = req.params['id'];
  if (Array.isArray(id)) return id[0] ?? '';
  return String(id ?? '');
}

export class GroupsController {
  async health(_req: Request, res: Response) {
    return sendSuccess(res, 200, 'OK', [{ service: 'group-service' }]);
  }

  async list(req: Request, res: Response) {
    try {
      if (!req.userId) return sendError(res, 401, 'Usuario no identificado');
      const list = await groupsService.listForActor(req.userId);
      return sendSuccess(res, 200, 'Listado de grupos', list);
    } catch (error) {
      return sendError(res, 500, error instanceof Error ? error.message : 'Error listando grupos');
    }
  }

  async create(req: Request, res: Response) {
    try {
      if (!req.userId) return sendError(res, 401, 'Usuario no identificado');
      const body = req.body as Record<string, unknown>;
      const autorSesion = (req.userLabel ?? '').trim();
      const input: CreateGroupInput = {
        nivel: String(body.nivel ?? ''),
        autor: autorSesion || String(body.autor ?? ''),
        nombre: String(body.nombre ?? ''),
        descripcion: String(body.descripcion ?? ''),
        miembros: Array.isArray(body.miembros) ? body.miembros.map((m) => String(m)) : [],
      };
      const created = await groupsService.create(input, req.userId);
      return sendSuccess(res, 201, 'Grupo creado', created);
    } catch (error) {
      return sendError(res, 400, error instanceof Error ? error.message : 'Error creando grupo');
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const row = await groupsService.getById(routeId(req));
      if (!row) return sendError(res, 404, 'Grupo no encontrado');
      return sendSuccess(res, 200, 'Grupo', row);
    } catch (error) {
      return sendError(res, 500, error instanceof Error ? error.message : 'Error obteniendo grupo');
    }
  }

  async patch(req: Request, res: Response) {
    try {
      const body = req.body as Record<string, unknown>;
      const patch: PatchGroupInput = {};
      if ('nivel' in body) patch.nivel = String(body.nivel ?? '');
      if ('autor' in body) patch.autor = String(body.autor ?? '');
      if ('nombre' in body) patch.nombre = String(body.nombre ?? '');
      if ('descripcion' in body) patch.descripcion = String(body.descripcion ?? '');
      if ('miembros' in body && Array.isArray(body.miembros)) {
        patch.miembros = body.miembros.map((m) => String(m));
      }
      const updated = await groupsService.patch(routeId(req), patch);
      if (!updated) return sendError(res, 404, 'Grupo no encontrado');
      return sendSuccess(res, 200, 'Grupo actualizado', updated);
    } catch (error) {
      return sendError(res, 400, error instanceof Error ? error.message : 'Error actualizando grupo');
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const id = routeId(req);
      const ok = await groupsService.remove(id);
      if (!ok) return sendError(res, 404, 'Grupo no encontrado');
      return sendSuccess(res, 200, 'Grupo eliminado', { id });
    } catch (error) {
      return sendError(res, 500, error instanceof Error ? error.message : 'Error eliminando grupo');
    }
  }

  async addMember(req: Request, res: Response) {
    try {
      const handle = String((req.body as { handle?: string }).handle ?? '');
      const updated = await groupsService.addMember(routeId(req), handle);
      if (!updated) return sendError(res, 404, 'Grupo no encontrado');
      return sendSuccess(res, 200, 'Miembro agregado', updated);
    } catch (error) {
      return sendError(res, 400, error instanceof Error ? error.message : 'Error agregando miembro');
    }
  }

  async removeMember(req: Request, res: Response) {
    try {
      const handle = String((req.body as { handle?: string }).handle ?? '');
      const updated = await groupsService.removeMember(routeId(req), handle);
      if (!updated) return sendError(res, 404, 'Grupo no encontrado');
      return sendSuccess(res, 200, 'Miembro removido', updated);
    } catch (error) {
      return sendError(res, 400, error instanceof Error ? error.message : 'Error removiendo miembro');
    }
  }
}

export const groupsController = new GroupsController();
