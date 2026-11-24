// Resolve the database URL and keys as a single bundle. Never mix keys from two projects.
export const DEDICATED_PLP_URL = 'https://bhtxblcjyblrjiayumyx.supabase.co';
const PREFIX = 'PLP_NEW_';
const NAMES = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

export function plpSupabaseEnv(env = process.env) {
  const target = env.PLP_DATABASE_TARGET;
  const dedicated = target === 'dedicated' || (!target && NAMES.some(name => Object.hasOwn(env, PREFIX + name)));
  if (target && target !== 'dedicated' && target !== 'legacy') {
    return { ...env, SUPABASE_URL: '', VITE_SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '' };
  }
  if (!dedicated) return env;
  const url = String(env.PLP_NEW_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = env.PLP_NEW_SUPABASE_ANON_KEY;
  const service = env.PLP_NEW_SUPABASE_SERVICE_ROLE_KEY;
  const valid = url === DEDICATED_PLP_URL && typeof anon === 'string' && anon.trim().length > 0 &&
    typeof service === 'string' && service.trim().length > 0;
  return {
    ...env,
    SUPABASE_URL: valid ? url : '',
    VITE_SUPABASE_URL: '',
    SUPABASE_ANON_KEY: valid ? anon : '',
    SUPABASE_SERVICE_ROLE_KEY: valid ? service : '',
  };
}
