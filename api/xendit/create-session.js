// Backward-compatible alias.
//
// Despite the "xendit" path, Pueblo La Perla's secure deposit checkout is
// powered by PayPal. The canonical implementation now lives in
// api/paypal/create-session.js. This route is retained only because the public
// booking form still POSTs to /api/xendit/create-session; it delegates to the
// canonical handler so behaviour, protections, and responses stay identical.
import handler from '../paypal/create-session.js';

export default handler;
