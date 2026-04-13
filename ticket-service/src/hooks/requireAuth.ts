import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabaseAdmin } from '../db/supabase';
import { sendError } from '../utils/apiResponse';

function extractBearer(authorization?: string): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = extractBearer(req.headers.authorization);
  if (!token) {
    return sendError(reply, 401, 'No autorizado: token Bearer requerido');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return sendError(reply, 401, 'Token inválido o expirado');
  }

  req.userId = data.user.id;
  const meta = data.user.user_metadata as Record<string, unknown> | undefined;
  const usuario = typeof meta?.usuario === 'string' ? meta.usuario.trim() : '';
  const email = (data.user.email ?? '').trim();
  req.userLabel = usuario || email || data.user.id;
}
