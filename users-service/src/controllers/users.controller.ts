import type { Request, Response } from 'express';
import type { PermissionCode } from '../constants/permissions';
import { usersService } from '../services/users.service';
import { sendError, sendSuccess } from '../utils/apiResponse';

function routeUserId(req: Request): string {
  const id = req.params['userId'];
  if (Array.isArray(id)) return id[0] ?? '';
  return String(id ?? '');
}

export class UsersController {
  async register(req: Request, res: Response) {
    try {
      const result = await usersService.register(req.body);
      return sendSuccess(res, 201, 'Usuario registrado exitosamente.', result);
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error ? error.message : 'Error en register',
        error instanceof Error ? [error.message] : undefined
      );
    }
  }

  async login(req: Request, res: Response) {
    try {
      const result = await usersService.login(req.body);
      return sendSuccess(res, 200, 'Login exitoso.', result);
    } catch (error) {
      return sendError(
        res,
        401,
        error instanceof Error ? error.message : 'Error en login',
        error instanceof Error ? [error.message] : undefined
      );
    }
  }

  async addUser(req: Request, res: Response) {
    try {
      const result = await usersService.addUser(req.body);
      return sendSuccess(res, 201, 'Usuario agregado exitosamente por el administrador.', result);
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error ? error.message : 'Error en add user',
        error instanceof Error ? [error.message] : undefined
      );
    }
  }

  async listAdminUsers(_req: Request, res: Response) {
    try {
      const list = await usersService.listUsersForAdmin();
      return sendSuccess(res, 200, 'Listado de usuarios', list);
    } catch (error) {
      return sendError(
        res,
        500,
        error instanceof Error ? error.message : 'Error listando usuarios',
        error instanceof Error ? [error.message] : undefined
      );
    }
  }

  async patchUserPermissions(req: Request, res: Response) {
    try {
      const userId = routeUserId(req);
      if (!userId) return sendError(res, 400, 'userId requerido');
      const permissions = (req.body as { permissions?: PermissionCode[] }).permissions ?? [];
      const updated = await usersService.updateUserPermissions(userId, permissions);
      return sendSuccess(res, 200, 'Permisos actualizados', updated);
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error ? error.message : 'Error actualizando permisos',
        error instanceof Error ? [error.message] : undefined
      );
    }
  }

  async deleteAdminUser(req: Request, res: Response) {
    try {
      if (!req.userId) return sendError(res, 401, 'No autenticado');
      const targetUserId = routeUserId(req);
      if (!targetUserId) return sendError(res, 400, 'userId requerido');
      await usersService.deleteUser(req.userId, targetUserId);
      return sendSuccess(res, 200, 'Usuario eliminado', { id: targetUserId });
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error ? error.message : 'Error eliminando usuario',
        error instanceof Error ? [error.message] : undefined
      );
    }
  }

  async patchMe(req: Request, res: Response) {
    try {
      if (!req.userId) return sendError(res, 401, 'No autenticado');
      const updated = await usersService.updateOwnProfile(req.userId, req.body);
      return sendSuccess(res, 200, 'Perfil actualizado', updated);
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error ? error.message : 'Error actualizando perfil',
        error instanceof Error ? [error.message] : undefined
      );
    }
  }

  async deleteMe(req: Request, res: Response) {
    try {
      if (!req.userId) return sendError(res, 401, 'No autenticado');
      await usersService.deleteOwnAccount(req.userId);
      return sendSuccess(res, 200, 'Cuenta eliminada', { ok: true });
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error ? error.message : 'Error eliminando cuenta',
        error instanceof Error ? [error.message] : undefined
      );
    }
  }
}

export const usersController = new UsersController();
