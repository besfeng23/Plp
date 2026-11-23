// Telegram is out of scope for the current PLP product. The webhook is fail-closed:
// unauthenticated (and all other) requests are rejected and no action is taken.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(404).json({ ok: false, error: 'Not found' });
}
