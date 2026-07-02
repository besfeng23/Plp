import { getPayPalHealth } from './tools/paypalHealth.js';
import { attentionSummary, maintenanceSummary, housekeepingSummary, conciergeSummary } from './tools/ownerCommandCenter.js';

const clean = (v, f = '—') => String(v || f).replace(/[\r\n]+/g, ' ').slice(0, 180);
const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9#]+/g, ' ').replace(/\s+/g, ' ').trim();
const has = (t, ...phrases) => phrases.some((p) => t.includes(p));

async function paypal(req) {
  const h = await getPayPalHealth(req);
  return `PayPal health:\n${h.ok ? '✅' : '⚠️'} ${h.ok ? 'OK' : 'not fully configured'} in ${h.mode} mode.\nClient ID: ${h.hasClientId ? 'yes' : 'no'}\nClient secret: ${h.hasClientSecret ? 'yes' : 'no'}\nSupabase URL: ${h.hasSupabaseUrl ? 'yes' : 'no'}\nSupabase service role: ${h.hasSupabaseServiceRole ? 'yes' : 'no'}\nBase URL source: ${clean(h.baseUrlSource)}`;
}

export async function directDispatch(text, req) {
  const t = norm(text);
  if (t === 'debug text') return `Debug text:\nraw: ${String(text).slice(0, 120)}\nnormalized: ${t}`;
  if (has(t, 'paypal')) return paypal(req);
  if (has(t, 'what needs attention', 'needs attention', 'attention', 'owner alert', 'urgent')) return attentionSummary();
  if (has(t, 'maintenance', 'repair', 'broken', 'leak', 'pool', 'water', 'electric')) return maintenanceSummary();
  if (has(t, 'housekeeping', 'clean', 'dirty', 'turnover')) return housekeepingSummary();
  if (has(t, 'concierge', 'transfer', 'chef', 'breakfast', 'laundry')) return conciergeSummary();
  return null;
}
