import { insertRow, selectRows, updateRows } from './_supabase.js';

function currency(value) {
  return `PHP ${Number(value || 0).toLocaleString('en-PH')}`;
}

function getAdminRecipient() {
  return process.env.BOOKINGS_TO_EMAIL || process.env.LEADS_TO_EMAIL || process.env.PLP_ADMIN_EMAIL || null;
}

function getFromAddress() {
  return process.env.BOOKINGS_FROM_EMAIL || process.env.LEADS_FROM_EMAIL || 'Pueblo La Perla <onboarding@resend.dev>';
}

export async function getBookingContext(reference) {
  const rows = await selectRows('plp_payment_reconciliation', `booking_reference=eq.${encodeURIComponent(reference)}&select=*&limit=1`);
  return rows?.[0] || null;
}

async function createNotificationLog({ bookingId, paymentId, key, recipientType, recipientEmail, subject, payload }) {
  try {
    return await insertRow('plp_notifications', {
      booking_id: bookingId || null,
      payment_id: paymentId || null,
      notification_key: key,
      recipient_type: recipientType,
      recipient_email: recipientEmail || null,
      channel: 'email',
      subject,
      status: 'PENDING',
      provider: 'RESEND',
      payload: payload || {},
    });
  } catch (error) {
    if (String(error.message || '').includes('duplicate key')) {
      return null;
    }
    throw error;
  }
}

async function markNotification(id, payload) {
  if (!id) return null;
  const rows = await updateRows('plp_notifications', `id=eq.${id}`, payload);
  return rows?.[0] || null;
}

async function deliverEmail({ to, subject, text }) {
  if (!to) return { ok: false, skipped: true, error: 'No recipient configured.' };
  if (!process.env.RESEND_API_KEY) return { ok: false, skipped: true, error: 'RESEND_API_KEY is not configured.' };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [to],
      subject,
      text,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, error: data?.message || data?.error || `Resend failed with ${response.status}`, data };
  }
  return { ok: true, providerMessageId: data?.id || null, data };
}

export async function sendTrackedEmail({ bookingId, paymentId, key, recipientType, to, subject, text, payload }) {
  const log = await createNotificationLog({ bookingId, paymentId, key, recipientType, recipientEmail: to, subject, payload: { ...payload, text } });
  if (!log) return { ok: true, duplicate: true, status: 'SKIPPED' };

  const delivery = await deliverEmail({ to, subject, text });
  if (delivery.ok) {
    await markNotification(log.id, {
      status: 'SENT',
      provider_message_id: delivery.providerMessageId,
      sent_at: new Date().toISOString(),
    });
    return { ok: true, duplicate: false, status: 'SENT', providerMessageId: delivery.providerMessageId };
  }

  await markNotification(log.id, {
    status: delivery.skipped ? 'SKIPPED' : 'FAILED',
    error: delivery.error,
  });
  return { ok: false, duplicate: false, status: delivery.skipped ? 'SKIPPED' : 'FAILED', error: delivery.error };
}

function baseBookingLines(row) {
  return [
    `Booking reference: ${row.booking_reference}`,
    `Guest: ${row.guest_name || '-'}`,
    `Accommodation: ${row.accommodation_name || '-'}`,
    `Dates: ${row.check_in || '-'} to ${row.check_out || '-'}`,
    `Total stay: ${currency(row.total_amount_php)}`,
    `Deposit: ${currency(row.deposit_amount_php)}`,
    `Balance: ${currency(row.balance_amount_php)}`,
  ];
}

export async function notifyBookingCreated({ booking, databaseRecord }) {
  const adminTo = getAdminRecipient();
  const bookingId = databaseRecord?.id || booking?.databaseId || null;
  const subjectGuest = `Pueblo La Perla reservation ${booking.reference}`;
  const subjectAdmin = `New PLP reservation ${booking.reference}`;

  const guestText = [
    `Dear ${booking.name},`,
    '',
    'Thank you for your Pueblo La Perla Boracay reservation request.',
    'Your booking reference has been created. Please complete the secure Xendit reservation deposit checkout to continue.',
    '',
    `Booking reference: ${booking.reference}`,
    `Accommodation: ${booking.accommodation}`,
    `Check-in: ${booking.checkIn}`,
    `Check-out: ${booking.checkOut}`,
    `Nights: ${booking.nights}`,
    `Guests: ${booking.guests}`,
    `Total stay: ${currency(booking.amount)}`,
    `Deposit due now: ${currency(booking.deposit)}`,
    `Balance after deposit: ${currency(booking.balance)}`,
    '',
    'Final confirmation is issued only after payment verification and resort availability review.',
    '',
    'Pueblo La Perla Boracay',
  ].join('\n');

  const adminText = [
    'New Pueblo La Perla reservation request received.',
    '',
    `Reference: ${booking.reference}`,
    `Guest: ${booking.name}`,
    `Email: ${booking.email}`,
    `Phone: ${booking.phone}`,
    `Accommodation: ${booking.accommodation}`,
    `Dates: ${booking.checkIn} to ${booking.checkOut}`,
    `Total stay: ${currency(booking.amount)}`,
    `Deposit due now: ${currency(booking.deposit)}`,
    `Balance: ${currency(booking.balance)}`,
    '',
    `Message: ${booking.message || '-'}`,
  ].join('\n');

  const [guest, admin] = await Promise.all([
    sendTrackedEmail({ bookingId, key: `${booking.reference}:booking_created:guest`, recipientType: 'guest', to: booking.email, subject: subjectGuest, text: guestText, payload: booking }),
    sendTrackedEmail({ bookingId, key: `${booking.reference}:booking_created:admin`, recipientType: 'admin', to: adminTo, subject: subjectAdmin, text: adminText, payload: booking }),
  ]);

  return { guest, admin };
}

export async function notifyPaymentVerified(reference) {
  const row = await getBookingContext(reference);
  if (!row) return { ok: false, error: 'Booking context not found.' };
  const adminTo = getAdminRecipient();

  const guestText = [
    `Dear ${row.guest_name || 'Guest'},`,
    '',
    'Your Pueblo La Perla reservation deposit has been verified.',
    'The booking is now awaiting final concierge availability confirmation.',
    '',
    ...baseBookingLines(row),
    '',
    'Pueblo La Perla Boracay',
  ].join('\n');

  const adminText = [
    'Verified reservation deposit received.',
    '',
    ...baseBookingLines(row),
    '',
    'Next action: review availability and confirm the booking in Admin Operations.',
  ].join('\n');

  const [guest, admin] = await Promise.all([
    sendTrackedEmail({ key: `${reference}:payment_verified:guest`, recipientType: 'guest', to: row.guest_email, subject: `Deposit verified for ${reference}`, text: guestText, payload: row }),
    sendTrackedEmail({ key: `${reference}:payment_verified:admin`, recipientType: 'admin', to: adminTo, subject: `Deposit verified: ${reference}`, text: adminText, payload: row }),
  ]);

  return { guest, admin };
}

export async function notifyPaymentException({ reference, verificationStatus, verificationNote, webhookId, eventType }) {
  const adminTo = getAdminRecipient();
  const row = reference ? await getBookingContext(reference) : null;
  const subject = `PLP payment exception: ${verificationStatus || 'Review required'}`;
  const text = [
    'A Xendit webhook was received but did not pass clean verification.',
    '',
    `Reference: ${reference || '-'}`,
    `Verification status: ${verificationStatus || '-'}`,
    `Verification note: ${verificationNote || '-'}`,
    `Webhook ID: ${webhookId || '-'}`,
    `Event type: ${eventType || '-'}`,
    '',
    row ? baseBookingLines(row).join('\n') : 'No matching booking context was found.',
    '',
    'Next action: check Admin Operations before confirming anything manually.',
  ].join('\n');

  return sendTrackedEmail({
    key: `${reference || webhookId || Date.now()}:payment_exception:admin`,
    recipientType: 'admin',
    to: adminTo,
    subject,
    text,
    payload: { reference, verificationStatus, verificationNote, webhookId, eventType, row },
  });
}

export async function notifyBookingStatus(reference, nextStatus) {
  const row = await getBookingContext(reference);
  if (!row) return { ok: false, error: 'Booking context not found.' };
  const adminTo = getAdminRecipient();
  const isConfirmed = nextStatus === 'CONFIRMED';
  const isCancelled = nextStatus === 'CANCELLED';
  const subjectGuest = isConfirmed ? `Your Pueblo La Perla booking is confirmed: ${reference}` : isCancelled ? `Pueblo La Perla booking cancelled: ${reference}` : `Pueblo La Perla booking update: ${reference}`;
  const subjectAdmin = `PLP booking ${nextStatus}: ${reference}`;

  const guestText = [
    `Dear ${row.guest_name || 'Guest'},`,
    '',
    isConfirmed
      ? 'Your Pueblo La Perla booking has been confirmed after payment verification and availability review.'
      : isCancelled
        ? 'Your Pueblo La Perla booking has been cancelled. Please contact the team if this was unexpected.'
        : 'Your Pueblo La Perla booking has been moved back into payment/operations review.',
    '',
    ...baseBookingLines(row),
    '',
    'Pueblo La Perla Boracay',
  ].join('\n');

  const adminText = [
    `Booking ${reference} updated to ${nextStatus}.`,
    '',
    ...baseBookingLines(row),
  ].join('\n');

  const [guest, admin] = await Promise.all([
    sendTrackedEmail({ key: `${reference}:status_${nextStatus}:guest`, recipientType: 'guest', to: row.guest_email, subject: subjectGuest, text: guestText, payload: row }),
    sendTrackedEmail({ key: `${reference}:status_${nextStatus}:admin`, recipientType: 'admin', to: adminTo, subject: subjectAdmin, text: adminText, payload: row }),
  ]);

  return { guest, admin };
}
