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
  const meta = data.user.user_metadata as Record<string, unknown> | undefined;
  const usuario = typeof meta?.usuario === 'string' ? meta.usuario.trim() : '';
  req.userLabel = usuario || (data.user.email ?? '').trim() || data.user.id;
  return next();
}
