"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupsController = exports.GroupsController = void 0;
const groups_service_1 = require("../services/groups.service");
const apiResponse_1 = require("../utils/apiResponse");
function routeId(req) {
    const id = req.params['id'];
    if (Array.isArray(id))
        return id[0] ?? '';
    return String(id ?? '');
}
class GroupsController {
    async health(_req, res) {
        return (0, apiResponse_1.sendSuccess)(res, 200, 'OK', [{ service: 'group-service' }]);
    }
    async list(req, res) {
        try {
            if (!req.userId)
                return (0, apiResponse_1.sendError)(res, 401, 'Usuario no identificado');
            const list = await groups_service_1.groupsService.listForActor(req.userId);
            return (0, apiResponse_1.sendSuccess)(res, 200, 'Listado de grupos', list);
        }
        catch (error) {
            return (0, apiResponse_1.sendError)(res, 500, error instanceof Error ? error.message : 'Error listando grupos');
        }
    }
    async create(req, res) {
        try {
            if (!req.userId)
                return (0, apiResponse_1.sendError)(res, 401, 'Usuario no identificado');
            const body = req.body;
            const autorSesion = (req.userLabel ?? '').trim();
            const input = {
                nivel: String(body.nivel ?? ''),
                autor: autorSesion || String(body.autor ?? ''),
                nombre: String(body.nombre ?? ''),
                descripcion: String(body.descripcion ?? ''),
                miembros: Array.isArray(body.miembros) ? body.miembros.map((m) => String(m)) : [],
            };
            const created = await groups_service_1.groupsService.create(input, req.userId);
            return (0, apiResponse_1.sendSuccess)(res, 201, 'Grupo creado', created);
        }
        catch (error) {
            return (0, apiResponse_1.sendError)(res, 400, error instanceof Error ? error.message : 'Error creando grupo');
        }
    }
    async getById(req, res) {
        try {
            const row = await groups_service_1.groupsService.getById(routeId(req));
            if (!row)
                return (0, apiResponse_1.sendError)(res, 404, 'Grupo no encontrado');
            return (0, apiResponse_1.sendSuccess)(res, 200, 'Grupo', row);
        }
        catch (error) {
            return (0, apiResponse_1.sendError)(res, 500, error instanceof Error ? error.message : 'Error obteniendo grupo');
        }
    }
    async patch(req, res) {
        try {
            const body = req.body;
            const patch = {};
            if ('nivel' in body)
                patch.nivel = String(body.nivel ?? '');
            if ('autor' in body)
                patch.autor = String(body.autor ?? '');
            if ('nombre' in body)
                patch.nombre = String(body.nombre ?? '');
            if ('descripcion' in body)
                patch.descripcion = String(body.descripcion ?? '');
            if ('miembros' in body && Array.isArray(body.miembros)) {
                patch.miembros = body.miembros.map((m) => String(m));
            }
            const updated = await groups_service_1.groupsService.patch(routeId(req), patch);
            if (!updated)
                return (0, apiResponse_1.sendError)(res, 404, 'Grupo no encontrado');
            return (0, apiResponse_1.sendSuccess)(res, 200, 'Grupo actualizado', updated);
        }
        catch (error) {
            return (0, apiResponse_1.sendError)(res, 400, error instanceof Error ? error.message : 'Error actualizando grupo');
        }
    }
    async remove(req, res) {
        try {
            const id = routeId(req);
            const ok = await groups_service_1.groupsService.remove(id);
            if (!ok)
                return (0, apiResponse_1.sendError)(res, 404, 'Grupo no encontrado');
            return (0, apiResponse_1.sendSuccess)(res, 200, 'Grupo eliminado', { id });
        }
        catch (error) {
            return (0, apiResponse_1.sendError)(res, 500, error instanceof Error ? error.message : 'Error eliminando grupo');
        }
    }
    async addMember(req, res) {
        try {
            const handle = String(req.body.handle ?? '');
            const updated = await groups_service_1.groupsService.addMember(routeId(req), handle);
            if (!updated)
                return (0, apiResponse_1.sendError)(res, 404, 'Grupo no encontrado');
            return (0, apiResponse_1.sendSuccess)(res, 200, 'Miembro agregado', updated);
        }
        catch (error) {
            return (0, apiResponse_1.sendError)(res, 400, error instanceof Error ? error.message : 'Error agregando miembro');
        }
    }
    async removeMember(req, res) {
        try {
            const handle = String(req.body.handle ?? '');
            const updated = await groups_service_1.groupsService.removeMember(routeId(req), handle);
            if (!updated)
                return (0, apiResponse_1.sendError)(res, 404, 'Grupo no encontrado');
            return (0, apiResponse_1.sendSuccess)(res, 200, 'Miembro removido', updated);
        }
        catch (error) {
            return (0, apiResponse_1.sendError)(res, 400, error instanceof Error ? error.message : 'Error removiendo miembro');
        }
    }
}
exports.GroupsController = GroupsController;
exports.groupsController = new GroupsController();
