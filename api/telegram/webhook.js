import { routePlpAgent } from './plpAgent.js';
import { sendTelegramMessage } from '../../server/plpTelegram/sendMessage.js';

function allowedIds() { return new Set(String(process.env.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean)); }
function isAuthorized(id) { const allowed = allowedIds(); return allowed.size > 0 && allowed.has(String(id)); }
function verifySecret(req) { const expected = process.env.TELEGRAM_WEBHOOK_SECRET; if (!expected) return true; return req.headers['x-telegram-bot-api-secret-token'] === expected; }

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  if (!verifySecret(req)) return res.status(401).json({ ok: false });
  const message = req.body?.message || req.body?.edited_message;
  const chatId = message?.chat?.id;
  const userId = message?.from?.id;
  const text = typeof message?.text === 'string' ? message.text.slice(0, 1000) : '';
  if (!chatId || !userId || !text) return res.status(200).json({ ok: true });
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
