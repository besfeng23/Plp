import { recordPayPalCapture } from './_db.js';
import { capturePayPalOrder, getBaseUrl } from './_paypal.js';

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  return res.end();
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function buildBookingQuery(bookingRef) {
  return bookingRef ? `bookingId=${encodeURIComponent(bookingRef)}&` : '';
}

export default async function handler(req, res) {
  const baseUrl = getBaseUrl(req);
  const orderToken = firstQueryValue(req.query?.token);
  const bookingRef = firstQueryValue(req.query?.bookingRef);
  const bookingQuery = buildBookingQuery(bookingRef);

  if (!orderToken) {
    return redirect(res, `${baseUrl}/booking/cancel?${bookingQuery}provider=paypal&reason=missing-paypal-token`);
  }

  if (!bookingRef) {
    return redirect(res, `${baseUrl}/booking/cancel?provider=paypal&reason=missing-booking-reference`);
  }

  try {
    const capture = await capturePayPalOrder(orderToken);
    const databaseResult = await recordPayPalCapture({
      bookingReference: bookingRef,
      orderId: capture.orderId,
      captureId: capture.captureId,
      amount: capture.amount,
      currency: capture.currency,
      status: capture.status,
      payload: capture.raw,
    });

    const captureId = capture.captureId || capture.orderId;
    const verified = capture.status === 'COMPLETED' && databaseResult.verificationStatus === 'VERIFIED';

    if (verified) {
      return redirect(res, `${baseUrl}/booking/success?${bookingQuery}provider=paypal&paypalOrderId=${encodeURIComponent(capture.orderId)}&captureId=${encodeURIComponent(captureId)}`);
    }

    const reason = databaseResult.verificationStatus || capture.status || 'capture-not-verified';
    return redirect(res, `${baseUrl}/booking/cancel?${bookingQuery}provider=paypal&reason=${encodeURIComponent(reason)}`);
  } catch (error) {
    return redirect(res, `${baseUrl}/booking/cancel?${bookingQuery}provider=paypal&reason=${encodeURIComponent(error.message || 'paypal-capture-failed')}`);
  }
}
