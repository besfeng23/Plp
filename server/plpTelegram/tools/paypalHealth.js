import { getPayPalHealthConfig } from '../../../api/paypal/_paypal.js';

export async function getPayPalHealth(req) {
  const config = getPayPalHealthConfig(req);
  return {
    ok: config.ok,
    mode: config.mode,
    hasClientId: config.hasClientId,
    hasClientSecret: config.hasClientSecret,
    hasSupabaseUrl: config.hasSupabaseUrl,
    hasSupabaseServiceRole: config.hasSupabaseServiceRole,
    baseUrlSource: config.baseUrlSource,
  };
}
