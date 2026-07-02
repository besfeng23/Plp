import { getOpenPullRequests, getPullRequest } from './tools/githubStatus.js';
import { getLatestProductionDeployment, getRecentVercelErrors } from './tools/vercelStatus.js';
import { getPayPalHealth } from './tools/paypalHealth.js';
import { getLatestBookings, getPaymentExceptions } from './tools/supabaseBookings.js';
import {
  ownerBrief,
  donorBrief,
  arrivalsToday,
  checkoutsToday,
  maintenanceSummary,
  housekeepingSummary,
  conciergeSummary,
  expensesSummary,
  reviewsSummary,
  channelSummary,
  websiteFunnel,
  attentionSummary,
} from './tools/ownerCommandCenter.js';

const HELP = 'PLP Command Bot\nAsk: owner update, donor update, what needs attention, arrivals today, checkouts today, maintenance, housekeeping, concierge, expenses, reviews, OTA status, website funnel, check production, check paypal, check all PRs, show latest bookings, payment exceptions, or morning update.\nRead-only mode is active.';
const clean = (v, f = '—') => String(v || f).replace(/[\r\n]+/g, ' ').slice(0, 180);
const pesos = (v) => Number(v || 0) ? `PHP ${Number(v || 0).toLocaleString('en-US')}` : '—';
const has = (t, ...phrases) => phrases.some((p) => t.includes(p));

// Collapse any incoming Telegram text to a single comparable form so natural
// language, slash commands, and snake_case/kebab-case all match the same intent.
// Examples: "/Arrivals_Today" -> "arrivals today", "Check-ins  today" -> "check ins today".
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function intentFor(text) {
  const t = normalize(text);
  // Whole-word PR detection. Using includes('pr') here is unsafe because words
  // like "production"/"approve" contain "pr" and would hijack real queries.
  const prNum = t.match(/\bpr\s*#?\s*(\d+)\b|#(\d+)\b/);
  const mentionsPr = /\bprs?\b|\bpull requests?\b/.test(t) || /#\d+/.test(t);

  if (t === 'help' || t === 'start' || t === 'menu' || t === 'commands') return { name: 'help' };

  // Owner alerts / urgent — before maintenance so "issues today" is an alert,
  // while a bare "issues"/"repairs" stays a maintenance query.
  if (has(t, 'what needs attention', 'needs attention', 'attention', 'owner alert', 'urgent', 'problem today', 'problems today', 'issues today', 'issue today', 'problems')) return { name: 'owner/attention' };
  if (has(t, 'owner update', 'owner brief', 'owner report', 'owner summary', 'morning update', 'morning brief', 'morning briefing', 'evening update', 'daily update', 'daily brief', 'daily briefing', 'status update', 'update on plp', 'how is plp')) return { name: 'owner/brief' };
  if (has(t, 'donor', 'investor', 'impact report', 'funds')) return { name: 'owner/donor' };

  if (has(t, 'arrivals today', 'arrival today', 'today arrivals', 'arrivals', 'arrival', 'arriving today', 'guests arriving today', 'guests arriving', 'checkins today', 'check ins today', 'check in today', 'guest check ins', 'guest checkins')) return { name: 'ops/arrivals' };
  if (has(t, 'checkouts today', 'checkout today', 'today checkouts', 'checkouts', 'departures today', 'departure today', 'departures', 'leaving today', 'guests leaving today', 'guests leaving') && !has(t, 'checkout error')) return { name: 'ops/checkouts' };

  // Payment problems worded as "issues" must not be swallowed by maintenance.
  if (has(t, 'maintenance', 'broken', 'repair', 'water', 'pool', 'leak', 'electric', 'ac problem', 'issue', 'issues') && !has(t, 'payment')) return { name: 'ops/maintenance' };
  if (has(t, 'housekeeping', 'clean', 'cleaning', 'rooms to clean', 'dirty', 'room ready', 'turnover')) return { name: 'ops/housekeeping' };
  if (has(t, 'concierge', 'concierge today', 'guest request', 'guest requests', 'requests', 'transfer', 'chef', 'breakfast', 'drinks', 'laundry')) return { name: 'ops/concierge' };
  if (has(t, 'expense', 'expenses', 'spend', 'spent', 'profit', 'p l', 'cost')) return { name: 'finance/expenses' };
  if (has(t, 'reviews', 'review', 'rating', 'reputation', 'complaint', 'feedback')) return { name: 'reputation/reviews' };
  if (has(t, 'ota', 'airbnb', 'agoda', 'expedia', 'booking com', 'channel')) return { name: 'channels/status' };
  if (has(t, 'website funnel', 'funnel', 'website leads', 'inquiries', 'conversion', 'booking page', 'reserve click', 'analytics')) return { name: 'website/funnel' };

  if (prNum && mentionsPr) return { name: 'github/pr', number: prNum[1] || prNum[2] };
  if (mentionsPr || has(t, 'merge ready')) return { name: 'github/prs', mergeReady: has(t, 'merge ready') };

  if (has(t, 'paypal')) return { name: 'paypal/health' };
  if (has(t, 'checkout error', 'checkout errors', 'vercel error', 'vercel errors', 'logs')) return { name: 'vercel/errors' };
  if (has(t, 'production', 'deploy', 'deployment', 'vercel', 'health check', 'system status')) return { name: 'vercel/status' };

  // Before generic bookings so "unpaid bookings" / "failed payments" land here.
  if (has(t, 'payment exception', 'payment exceptions', 'payment problem', 'payments problem', 'payment issue', 'payment issues', 'unpaid', 'failed payment', 'failed payments', 'reconciliation', 'deposit review', 'exceptions')) return { name: 'payments/exceptions' };
  if (has(t, 'latest bookings', 'recent bookings', 'show latest bookings', 'bookings', 'booking', 'reservation', 'latest')) return { name: 'bookings/latest' };

  return { name: 'help', fallback: true };
}

// Canonical snake_case intent id for each internal router name. Used by
// normalizeCommand() (and its tests) to expose a stable, report-oriented key.
const INTENT_KEYS = {
  'owner/attention': 'what_needs_attention',
  'owner/brief': 'owner_update',
  'owner/donor': 'donor_update',
  'ops/arrivals': 'arrivals_today',
  'ops/checkouts': 'checkouts_today',
  'ops/maintenance': 'maintenance',
  'ops/housekeeping': 'housekeeping',
  'ops/concierge': 'concierge',
  'finance/expenses': 'expenses',
  'reputation/reviews': 'reviews',
  'channels/status': 'ota_status',
  'website/funnel': 'website_funnel',
  'github/prs': 'check_all_prs',
  'github/pr': 'check_all_prs',
  'paypal/health': 'check_paypal',
  'vercel/errors': 'check_production',
  'vercel/status': 'check_production',
  'payments/exceptions': 'payment_exceptions',
  'bookings/latest': 'latest_bookings',
};

// Normalizes free Telegram text to a canonical command id, or null when the
// message is unknown / a bare help/start request (which should show the menu).
// normalizeCommand('Arrivals today') === 'arrivals_today'; normalizeCommand('hello') === null.
export function normalizeCommand(text) {
  const intent = intentFor(text);
  if (intent.name === 'help') return null;
  return INTENT_KEYS[intent.name] || null;
}

function formatPr(pr) {
  const readiness = pr.draft ? 'draft' : pr.mergeable === true ? 'mergeable' : pr.mergeable === false ? 'not mergeable' : 'mergeability pending';
  return `#${pr.number} ${clean(pr.title)} — ${readiness} — updated ${clean(pr.updated_at)}`;
}
async function answerPrs(intent) {
  const prs = await getOpenPullRequests();
  const rows = intent.mergeReady ? prs.filter((pr) => !pr.draft && pr.mergeable === true) : prs;
  if (!rows.length) return intent.mergeReady ? 'Merge-ready PRs:\nNone found.' : 'Open PRs:\nNo open PRs found.';
  return `${intent.mergeReady ? 'Merge-ready PRs' : 'Open PRs'}:\n${rows.map(formatPr).join('\n')}\n\nRead-only: no Telegram PR changes are enabled.`;
}
async function answerVercel() {
  const dep = await getLatestProductionDeployment();
  if (!dep) return 'Production status:\nNo production deployments found.';
  return `Production status:\n${dep.state === 'READY' ? '✅' : '⚠️'} Latest production deployment is ${clean(dep.state)}.\nCommit: ${clean(dep.commitSha)}\nMessage: ${clean(dep.commitMessage)}\nCreated: ${clean(dep.createdAt)}`;
}
async function answerPaypal(req) {
  const h = await getPayPalHealth(req);
  return `PayPal health:\n${h.ok ? '✅' : '⚠️'} ${h.ok ? 'OK' : 'not fully configured'} in ${h.mode} mode.\nClient ID: ${h.hasClientId ? 'yes' : 'no'}\nClient secret: ${h.hasClientSecret ? 'yes' : 'no'}\nSupabase URL: ${h.hasSupabaseUrl ? 'yes' : 'no'}\nSupabase service role: ${h.hasSupabaseServiceRole ? 'yes' : 'no'}\nBase URL source: ${clean(h.baseUrlSource)}`;
}
async function answerBookings() {
  const result = await getLatestBookings(5);
  if (!result.configured) return 'Latest bookings:\nSupabase is not configured in this environment.';
  if (!result.rows.length) return result.warning ? `Latest bookings:\n${result.warning}` : 'Latest bookings:\nNo booking records found.';
  return `Latest bookings:\n${result.rows.map((b) => `${b.reference} — ${clean(b.guestName)} — ${clean(b.accommodation)} — ${clean(b.checkIn)} to ${clean(b.checkOut)} — ${clean(b.status)} / ${clean(b.paymentStatus)} — deposit ${pesos(b.depositAmount)}`).join('\n')}`;
}
async function answerExceptions() {
  const result = await getPaymentExceptions(5);
  if (!result.configured) return 'Payment exceptions:\nSupabase is not configured in this environment.';
  if (!result.rows.length) return result.warning ? `Payment exceptions:\n${result.warning}` : 'Payment exceptions:\nNo recent payment exceptions found.';
  return `Payment exceptions:\n${result.rows.map((row) => `${clean(row.booking_reference || row.provider_reference_id)} — ${clean(row.verification_status || row.status, 'Review')} — expected ${pesos(row.expected_amount_php)} — received ${pesos(row.amount_php)}`).join('\n')}`;
}
export async function routePlpAgent(text, { req } = {}) {
  const intent = intentFor(text);
  // Debug only. Never log tokens, secrets, or env values.
  console.log('[telegram]', {
    rawText: String(text || '').slice(0, 200),
    normalizedText: normalize(text),
    intent: intent.name,
    fallback: Boolean(intent.fallback),
  });
  try {
    if (intent.name === 'help') return HELP;
    if (intent.name === 'owner/brief') return `${await ownerBrief()}\n\n${await answerPaypal(req)}\n\n${await answerVercel()}\n\n${await attentionSummary()}`;
    if (intent.name === 'owner/donor') return donorBrief();
    if (intent.name === 'owner/attention') return attentionSummary();
    if (intent.name === 'ops/arrivals') return arrivalsToday();
    if (intent.name === 'ops/checkouts') return checkoutsToday();
    if (intent.name === 'ops/maintenance') return maintenanceSummary();
    if (intent.name === 'ops/housekeeping') return housekeepingSummary();
    if (intent.name === 'ops/concierge') return conciergeSummary();
    if (intent.name === 'finance/expenses') return expensesSummary();
    if (intent.name === 'reputation/reviews') return reviewsSummary();
    if (intent.name === 'channels/status') return channelSummary();
    if (intent.name === 'website/funnel') return websiteFunnel();
    if (intent.name === 'github/prs') return answerPrs(intent);
    if (intent.name === 'github/pr') return `PR #${intent.number}:\n${formatPr(await getPullRequest(intent.number))}\nRead-only: no Telegram PR actions are enabled.`;
    if (intent.name === 'vercel/status') return answerVercel();
    if (intent.name === 'vercel/errors') { const data = await getRecentVercelErrors(); return `${await answerVercel()}\n\nCheckout/runtime errors:\n${data.note}`; }
    if (intent.name === 'paypal/health') return answerPaypal(req);
    if (intent.name === 'bookings/latest') return answerBookings();
    if (intent.name === 'payments/exceptions') return answerExceptions();
    return HELP;
  } catch (error) {
    return `I could not complete that read-only check safely. ${clean(error.message, 'Please verify configuration.')}`;
  }
}
