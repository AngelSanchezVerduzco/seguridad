import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export const supabasePublic = createClient(env.supabaseUrl, env.supabasePublishableKey);
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
