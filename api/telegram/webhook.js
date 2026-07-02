import { routePlpAgent } from '../../server/plpTelegram/plpAgent.js';
import { sendTelegramMessage } from '../../server/plpTelegram/sendMessage.js';

function allowedIds() { return new Set(String(process.env.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean)); }
function isAuthorized(id) { const allowed = allowedIds(); return allowed.size === 0 || allowed.has(String(id)); }
function verifySecret(req) { const expected = process.env.TELEGRAM_WEBHOOK_SECRET; if (!expected) return true; return req.headers['x-telegram-bot-api-secret-token'] === expected; }

function parseMiniAppData(raw) {
  try { return JSON.parse(String(raw || '{}')); } catch { return null; }
}

function miniAppText(data) {
  if (!data || typeof data !== 'object') return '';
  if (data.type === 'booking_request') {
    return [
      'Telegram Mini App booking request',
      `Arrival: ${data.arrival || 'not selected'}`,
      `Departure: ${data.departure || 'not selected'}`,
      `Guests: ${data.guests || 'not provided'}`,
      `Notes: ${data.notes || 'none'}`,
    ].join('\n');
  }
  if (data.type === 'concierge_request') {
    return [
      'Telegram Mini App concierge request',
      `Category: ${data.category || 'Concierge'}`,
      `Request: ${data.message || 'no details provided'}`,
    ].join('\n');
  }
  return `Telegram Mini App event: ${JSON.stringify(data).slice(0, 900)}`;
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: true, route: 'telegram_webhook', method: 'POST' });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  if (!verifySecret(req)) return res.status(401).json({ ok: false });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const message = body?.message || body?.edited_message;
  const chatId = message?.chat?.id;
  const userId = message?.from?.id;
  const dataText = miniAppText(parseMiniAppData(message?.web_app_data?.data));
  const text = dataText || (typeof message?.text === 'string' ? message.text.slice(0, 1000) : '');

  if (!chatId || !userId || !text) return res.status(200).json({ ok: true });

  if (/^\/(start|menu|app)/i.test(text)) {
    await sendTelegramMessage(chatId, `Welcome to PLP Boracay. Open the Mini App here: ${process.env.TELEGRAM_MINI_APP_URL || 'https://plp-boracay.vercel.app/tg'}`);
    return res.status(200).json({ ok: true });
  }

  if (!isAuthorized(userId)) return res.status(200).json({ ok: true });

  try {
    const answer = await routePlpAgent(text, { req });
    await sendTelegramMessage(chatId, answer);
    return res.status(200).json({ ok: true });
  } catch (error) {
    try { await sendTelegramMessage(chatId, 'I could not complete that request safely. Please check server configuration.'); } catch {}
    return res.status(200).json({ ok: true });
  }
}
