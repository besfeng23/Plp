function sanitizeTelegramText(text) {
  return String(text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 3900);
}

export async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Telegram bot token is not configured.');
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: sanitizeTelegramText(text), disable_web_page_preview: true }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.description || `Telegram send failed with status ${response.status}`);
  return data;
}
