"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function getEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Falta variable de entorno requerida: ${name}`);
    }
    return value;
}
exports.env = {
    port: Number(process.env.PORT ?? 4002),
    supabaseUrl: getEnv('SUPABASE_URL'),
    supabasePublishableKey: getEnv('SUPABASE_PUBLISHABLE_KEY'),
    supabaseSecretKey: getEnv('SUPABASE_SECRET_KEY'),
};
