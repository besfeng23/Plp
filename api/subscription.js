import { refuseUnlessAuthorized } from '../lib/preview-gate.js';
import activateSubscription from './subscription/_activate.js';
import cancelSubscription from './subscription/_cancel.js';
import createSubscription from './subscription/_create.js';
import subscriptionStatus from './subscription/_status.js';

const handlers = new Map([
  ['activate', activateSubscription],
  ['cancel', cancelSubscription],
  ['create', createSubscription],
  ['status', subscriptionStatus],
]);

export default async function handler(req, res) {
  if (await refuseUnlessAuthorized(req, res)) return;
  const run = handlers.get(req.query?.operation);
  if (run) return run(req, res);

  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return res.status(404).json({ ok: false, message: 'Subscription endpoint not found.' });
}
