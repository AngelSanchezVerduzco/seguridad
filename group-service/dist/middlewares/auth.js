"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const supabase_1 = require("../db/supabase");
const apiResponse_1 = require("../utils/apiResponse");
function extractBearerToken(authorization) {
    if (!authorization)
        return null;
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token)
        return null;
    return token;
}
async function requireAuth(req, res, next) {
    const token = extractBearerToken(req.header('Authorization'));
    if (!token) {
        return (0, apiResponse_1.sendError)(res, 401, 'No autorizado: token Bearer requerido');
    }
    const { data, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
        return (0, apiResponse_1.sendError)(res, 401, 'Token inválido o expirado');
    }
    req.userId = data.user.id;
    req.accessToken = token;
    const meta = data.user.user_metadata;
    const usuario = typeof meta?.usuario === 'string' ? meta.usuario.trim() : '';
    req.userLabel = usuario || (data.user.email ?? '').trim() || data.user.id;
    return next();
}
