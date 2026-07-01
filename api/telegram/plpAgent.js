import { getOpenPullRequests, getPullRequest } from '../_tools/githubStatus.js';
import { getLatestProductionDeployment, getRecentVercelErrors } from '../_tools/vercelStatus.js';
import { getPayPalHealth } from '../_tools/paypalHealth.js';
import { getLatestBookings, getPaymentExceptions } from '../_tools/supabaseBookings.js';

const HELP = `PLP Command Bot\nAsk me:\n• check production\n• check paypal\n• check checkout errors\n• check all PRs\n• what PR is merge-ready\n• show latest bookings\n• any payment exceptions\n• give me morning update\n\nRead-only mode: I will not merge, deploy, close, delete, or change bookings.`;

function line(value, fallback = '—') { return String(value || fallback).replace(/[\r\n]+/g, ' ').slice(0, 180); }
function money(value) { const number = Number(value || 0); return number ? `PHP ${number.toLocaleString('en-US')}` : '—'; }
function intentFor(text) {
  const t = String(text || '').toLowerCase();
  const prNumber = t.match(/\bpr\s*#?\s*(\d+)\b|#(\d+)\b/);
  if (/\bhelp\b|start/.test(t)) return { name: 'help' };
  if (prNumber && /pr|pull request|#/.test(t)) return { name: 'github/pr', number: prNumber[1] || prNumber[2] };
  if (/pr|pull request|merge-ready|merge ready/.test(t)) return { name: 'github/prs', mergeReady: /merge-ready|merge ready/.test(t) };
  if (/paypal/.test(t)) return { name: 'paypal/health' };
  if (/checkout.*error|error.*checkout|vercel.*error|logs?/.test(t)) return { name: 'vercel/errors' };
  if (/production|deploy|vercel/.test(t)) return { name: 'vercel/status' };
  if (/booking|reservation|latest/.test(t)) return { name: 'bookings/latest' };
  if (/payment exception|exceptions?|reconciliation|deposit review/.test(t)) return { name: 'payments/exceptions' };
  if (/morning update|any update|status|update on plp/.test(t)) return { name: 'project/status' };
  return { name: 'help' };
}

function formatPr(pr) { const readiness = pr.draft ? 'draft' : pr.mergeable === true ? 'mergeable' : pr.mergeable === false ? 'not mergeable' : 'mergeability pending'; return `#${pr.number} ${line(pr.title)} — ${readiness} — updated ${line(pr.updated_at)}`; }
async function answerPrs(intent) { const prs = await getOpenPullRequests(); const rows = intent.mergeReady ? prs.filter((pr) => !pr.draft && pr.mergeable === true) : prs; if (!rows.length) return intent.mergeReady ? 'Merge-ready PRs:\nNo open PRs are clearly merge-ready from GitHub mergeability data.' : 'Open PRs:\nNo open PRs found.'; return `${intent.mergeReady ? 'Merge-ready PRs' : 'Open PRs'}:\n${rows.map(formatPr).join('\n')}\n\nRead-only: I will not merge PRs from Telegram.`; }
async function answerVercel() { const dep = await getLatestProductionDeployment(); if (!dep) return 'Production status:\nNo production deployments found.'; return `Production status:\n${dep.state === 'READY' ? '✅' : '⚠️'} Latest production deployment is ${line(dep.state)}.\nCommit: ${line(dep.commitSha)}\nMessage: ${line(dep.commitMessage)}\nCreated: ${line(dep.createdAt)}`; }
async function answerPaypal(req) { const h = await getPayPalHealth(req); return `PayPal health:\n${h.ok ? '✅' : '⚠️'} Health is ${h.ok ? 'OK' : 'not fully configured'} in ${h.mode} mode.\nClient ID configured: ${h.hasClientId ? 'yes' : 'no'}\nClient secret configured: ${h.hasClientSecret ? 'yes' : 'no'}\nSupabase URL configured: ${h.hasSupabaseUrl ? 'yes' : 'no'}\nSupabase service role configured: ${h.hasSupabaseServiceRole ? 'yes' : 'no'}\nBase URL source: ${line(h.baseUrlSource)}`; }
async function answerBookings() { const result = await getLatestBookings(5); if (!result.configured) return 'Latest bookings:\n⚠️ Supabase is not configured in this environment.'; if (!result.rows.length) return 'Latest bookings:\nNo booking records found.'; return `Latest bookings:\n${result.rows.map((b) => `${b.reference} — ${line(b.guestName)} — ${line(b.accommodation)} — ${line(b.checkIn)} → ${line(b.checkOut)} — ${line(b.status)} / ${line(b.paymentStatus)} — deposit ${money(b.depositAmount)}`).join('\n')}`; }
async function answerExceptions() { const result = await getPaymentExceptions(5); if (!result.configured) return 'Payment exceptions:\n⚠️ Supabase is not configured in this environment.'; if (!result.rows.length) return 'Payment exceptions:\n✅ No recent payment exceptions found.'; return `Payment exceptions:\n${result.rows.map((row) => `${line(row.booking_reference || row.provider_reference_id)} — ${line(row.verification_status || row.status, 'Review')} — expected ${money(row.expected_amount_php)} ${line(row.expected_currency, 'PHP')} — received ${money(row.amount_php)} ${line(row.currency, '')}`).join('\n')}`; }

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
    if (intent.name === 'project/status') return `PLP status:\n${await answerVercel()}\n\n${await answerPaypal(req)}\n\n${await answerExceptions()}\n\nNext action: review any warnings above before changing production.`;
    return HELP;
  } catch (error) {
    return `I could not complete that read-only check safely. ${line(error.message, 'Please verify the required environment variables.')}`;
  }
}
