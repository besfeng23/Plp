// Edge-safe, domain-separated signing key for sessions authenticated by the owner code.
// Changes to the configured code or owner invalidate these sessions. No hash is sent to clients.
export function godSessionSecret(secret, env = process.env) {
  const hash = String(env.PLP_OWNER_GOD_CODE_HASH || '').trim().toLowerCase();
  const emails = String(env.PLP_OWNER_EMAILS || env.PLP_OWNER_EMAIL || '').trim().toLowerCase().split(/[,;\s]+/).filter(Boolean);
  if (typeof secret !== 'string' || secret.length < 48 || !/^[a-f0-9]{64}$/.test(hash) || new Set(emails).size !== 1) return '';
  return JSON.stringify(['plp-god-session-v1', secret, hash, emails[0]]);
}
