import { getOpenPullRequests, getPullRequest } from './tools/githubStatus.js';
import { getLatestProductionDeployment, getRecentVercelErrors } from './tools/vercelStatus.js';
import { getPayPalHealth } from './tools/paypalHealth.js';
import { getLatestBookings, getPaymentExceptions } from './tools/supabaseBookings.js';

const HELP = 'PLP Command Bot\nAsk: check production, check paypal, check checkout errors, check all PRs, show latest bookings, payment exceptions, or morning update.\nRead-only mode is active.';
const clean = (v, f = '—') => String(v || f).replace(/[\r\n]+/g, ' ').slice(0, 180);
const pesos = (v) => Number(v || 0) ? `PHP ${Number(v || 0).toLocaleString('en-US')}` : '—';

function intentFor(text) {
  const t = String(text || '').toLowerCase();
  const pr = t.match(/\bpr\s*#?\s*(\d+)\b|#(\d+)\b/);
  if (/\bhelp\b|start/.test(t)) return { name: 'help' };
  if (pr && /pr|pull request|#/.test(t)) return { name: 'github/pr', number: pr[1] || pr[2] };
  if (/pr|pull request|merge-ready|merge ready/.test(t)) return { name: 'github/prs', mergeReady: /merge-ready|merge ready/.test(t) };
  if (/paypal/.test(t)) return { name: 'paypal/health' };
  if (/checkout.*error|error.*checkout|vercel.*error|logs?/.test(t)) return { name: 'vercel/errors' };
  if (/production|deploy|vercel/.test(t)) return { name: 'vercel/status' };
  if (/payment exception|exceptions?|reconciliation|deposit review/.test(t)) return { name: 'payments/exceptions' };
  if (/booking|reservation|latest/.test(t)) return { name: 'bookings/latest' };
  if (/morning update|any update|status|update on plp/.test(t)) return { name: 'project/status' };
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
  if (!result.rows.length) return 'Latest bookings:\nNo booking records found.';
  return `Latest bookings:\n${result.rows.map((b) => `${b.reference} — ${clean(b.guestName)} — ${clean(b.accommodation)} — ${clean(b.checkIn)} to ${clean(b.checkOut)} — ${clean(b.status)} / ${clean(b.paymentStatus)} — deposit ${pesos(b.depositAmount)}`).join('\n')}`;
}
async function answerExceptions() {
  const result = await getPaymentExceptions(5);
  if (!result.configured) return 'Payment exceptions:\nSupabase is not configured in this environment.';
  if (!result.rows.length) return 'Payment exceptions:\nNo recent payment exceptions found.';
  return `Payment exceptions:\n${result.rows.map((row) => `${clean(row.booking_reference || row.provider_reference_id)} — ${clean(row.verification_status || row.status, 'Review')} — expected ${pesos(row.expected_amount_php)} — received ${pesos(row.amount_php)}`).join('\n')}`;
}
export async function routePlpAgent(text, { req } = {}) {
  const intent = intentFor(text);
  try {
    if (intent.name === 'help') return HELP;
    if (intent.name === 'github/prs') return answerPrs(intent);
    if (intent.name === 'github/pr') return `PR #${intent.number}:\n${formatPr(await getPullRequest(intent.number))}\nRead-only: no Telegram PR actions are enabled.`;
    if (intent.name === 'vercel/status') return answerVercel();
    if (intent.name === 'vercel/errors') { const data = await getRecentVercelErrors(); return `${await answerVercel()}\n\nCheckout/runtime errors:\n${data.note}`; }
    if (intent.name === 'paypal/health') return answerPaypal(req);
    if (intent.name === 'bookings/latest') return answerBookings();
    if (intent.name === 'payments/exceptions') return answerExceptions();
    if (intent.name === 'project/status') return `PLP status:\n${await answerVercel()}\n\n${await answerPaypal(req)}\n\n${await answerExceptions()}`;
    return HELP;
  } catch (error) {
    return `I could not complete that read-only check safely. ${clean(error.message, 'Please verify configuration.')}`;
  }
}
