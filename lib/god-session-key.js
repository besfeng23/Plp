// Edge-safe, domain-separated signing key for sessions authenticated by the owner code.
// Changes to the configured code or owner invalidate these sessions. No hash is sent to clients.
import { ownerEmails } from './site-config.js';

export function godSessionSecret(secret, env = process.env) {
  const hash = String(env.PLP_OWNER_GOD_CODE_HASH || '').trim().toLowerCase();
  const emails = ownerEmails(env);
  const designated = String(env.PLP_OWNER_EMAIL || '').trim().toLowerCase();
  const email = designated || (emails.length === 1 ? emails[0] : '');
  if (typeof secret !== 'string' || secret.length < 48 || !/^[a-f0-9]{64}$/.test(hash) || !email || !emails.includes(email)) return '';
  return JSON.stringify(['plp-god-session-v1', secret, hash, email]);
}
