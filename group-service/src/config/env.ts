import dotenv from 'dotenv';

dotenv.config();

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta variable de entorno requerida: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4002),
  supabaseUrl: getEnv('SUPABASE_URL'),
  supabasePublishableKey: getEnv('SUPABASE_PUBLISHABLE_KEY'),
  supabaseSecretKey: getEnv('SUPABASE_SECRET_KEY'),
};
