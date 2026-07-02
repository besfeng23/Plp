// Telegram bot webhook for Pueblo La Perla.
//
// Secrets are read from environment variables only — never hardcode the bot
// token or the webhook secret. Configure these in Vercel:
//   TELEGRAM_BOT_TOKEN       = bot token from @BotFather
//   TELEGRAM_WEBHOOK_SECRET  = the secret_token passed to Telegram setWebhook
//
// Telegram sends every update as a POST and echoes the configured secret in the
// `X-Telegram-Bot-Api-Secret-Token` header; requests whose header does not match
// TELEGRAM_WEBHOOK_SECRET are rejected. GET returns a safe config-presence probe
// (booleans only, never values) so setup can be verified without exposing secrets.

const TELEGRAM_API = 'https://api.telegram.org';

function safeConfig() {
  return {
    ok: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
    hasBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    hasWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
  };
}

async function sendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // Never let a reply failure turn the webhook into a non-200 (Telegram retries).
  }
}

export default async function handler(req, res) {
  // Safe config probe — booleans only, never secret values.
  if (req.method === 'GET') {
    return res.status(200).json(safeConfig());
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(503).json({ ok: false, error: 'Telegram webhook secret is not configured' });
  }

  // Telegram sends the configured secret back on every update.
  const providedSecret = req.headers['x-telegram-bot-api-secret-token'];
  if (providedSecret !== webhookSecret) {
    return res.status(401).json({ ok: false, error: 'Invalid webhook secret' });
  }

  let update;
  try {
    update = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
  }

  const message = update.message || update.edited_message || update.channel_post || null;
  const chatId = message?.chat?.id ?? null;
  const hasText = typeof message?.text === 'string' && message.text.length > 0;

  // Safe diagnostics only: no message content, no names, no secrets.
  try {
    console.log('PLP telegram webhook update', {
      updateId: update.update_id ?? null,
      chatType: message?.chat?.type ?? null,
      hasText,
    });
  } catch {
    // Diagnostics must never affect the response.
  }

  // Round-trip confirmation so the bot visibly replies during testing.
  if (chatId) {
    await sendMessage(chatId, 'Pueblo La Perla webhook is live ✅');
  }

  return res.status(200).json({ ok: true, received: true });
}
