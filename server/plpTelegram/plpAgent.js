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

function intentFor(text) {
  const t = String(text || '').toLowerCase();
  const pr = t.match(/\bpr\s*#?\s*(\d+)\b|#(\d+)\b/);
  if (/\bhelp\b|start/.test(t)) return { name: 'help' };
  if (/donor|investor|impact report|funds/.test(t)) return { name: 'owner/donor' };
  if (/what needs attention|attention|owner alert|urgent|problem|issue today/.test(t)) return { name: 'owner/attention' };
  if (/owner update|owner brief|morning update|evening update|daily update|how is plp|status|update on plp/.test(t)) return { name: 'owner/brief' };
  if (/arrival/.test(t)) return { name: 'ops/arrivals' };
  if (/checkout/.test(t) && !/error/.test(t)) return { name: 'ops/checkouts' };
  if (/maintenance|broken|repair|ac\b|water|pool|leak|electric/.test(t)) return { name: 'ops/maintenance' };
  if (/housekeeping|clean|dirty|room ready|turnover/.test(t)) return { name: 'ops/housekeeping' };
  if (/concierge|guest request|transfer|chef|breakfast|drinks|laundry/.test(t)) return { name: 'ops/concierge' };
  if (/expense|spend|spent|profit|p&l|cost/.test(t)) return { name: 'finance/expenses' };
  if (/review|rating|reputation|complaint|feedback/.test(t)) return { name: 'reputation/reviews' };
  if (/ota|airbnb|agoda|expedia|booking\.com|channel/.test(t)) return { name: 'channels/status' };
  if (/website funnel|funnel|conversion|booking page|reserve click|analytics/.test(t)) return { name: 'website/funnel' };
  if (pr && /pr|pull request|#/.test(t)) return { name: 'github/pr', number: pr[1] || pr[2] };
  if (/pr|pull request|merge-ready|merge ready/.test(t)) return { name: 'github/prs', mergeReady: /merge-ready|merge ready/.test(t) };
  if (/paypal/.test(t)) return { name: 'paypal/health' };
  if (/checkout.*error|error.*checkout|vercel.*error|logs?/.test(t)) return { name: 'vercel/errors' };
  if (/production|deploy|vercel/.test(t)) return { name: 'vercel/status' };
  if (/payment exception|exceptions?|reconciliation|deposit review/.test(t)) return { name: 'payments/exceptions' };
  if (/booking|reservation|latest/.test(t)) return { name: 'bookings/latest' };
  return { name: 'help' };
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
