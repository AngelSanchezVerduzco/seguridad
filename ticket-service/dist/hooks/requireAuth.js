"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const supabase_1 = require("../db/supabase");
const apiResponse_1 = require("../utils/apiResponse");
function extractBearer(authorization) {
    if (!authorization)
        return null;
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token)
        return null;
    return token;
}
async function requireAuth(req, reply) {
    const token = extractBearer(req.headers.authorization);
    if (!token) {
        return (0, apiResponse_1.sendError)(reply, 401, 'No autorizado: token Bearer requerido');
    }
    const { data, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
        return (0, apiResponse_1.sendError)(reply, 401, 'Token inválido o expirado');
    }
    req.userId = data.user.id;
    const meta = data.user.user_metadata;
    const usuario = typeof meta?.usuario === 'string' ? meta.usuario.trim() : '';
    const email = (data.user.email ?? '').trim();
    req.userLabel = usuario || email || data.user.id;
}
