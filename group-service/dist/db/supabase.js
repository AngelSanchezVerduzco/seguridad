"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = exports.supabasePublic = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("../config/env");
exports.supabasePublic = (0, supabase_js_1.createClient)(env_1.env.supabaseUrl, env_1.env.supabasePublishableKey);
exports.supabaseAdmin = (0, supabase_js_1.createClient)(env_1.env.supabaseUrl, env_1.env.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});
