import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../db/supabase';
import { sendError } from '../utils/apiResponse';

function extractBearerToken(authorization?: string): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.header('Authorization'));
  if (!token) {
    return sendError(res, 401, 'No autorizado: token Bearer requerido');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return sendError(res, 401, 'Token inválido o expirado');
  }

  req.userId = data.user.id;
  req.accessToken = token;
  return next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return sendError(res, 401, 'No autenticado');
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', req.userId)
    .maybeSingle();

  if (error) {
    return sendError(res, 500, 'Error consultando perfil de usuario');
  }
  const row = data as { is_admin?: unknown } | null;
  const isAdmin =
    row?.is_admin === true || row?.is_admin === 'true' || row?.is_admin === 't' || row?.is_admin === 1;
  if (!isAdmin) {
    return sendError(res, 403, 'Acceso denegado: requiere rol admin');
  }
  return next();
}
