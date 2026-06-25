const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseConfigError() {
  if (isSupabaseConfigured()) return null;
  return 'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.';
}

function apiUrl(path) {
  if (!SUPABASE_URL) throw new Error(getSupabaseConfigError());
  return `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`;
}

async function supabaseRequest(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
  if (!isSupabaseConfigured()) throw new Error(getSupabaseConfigError());

  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = typeof data === 'object' && data ? data.message || data.details || JSON.stringify(data) : text;
    throw new Error(detail || `Supabase request failed: ${response.status}`);
  }
  return data;
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value));
}

export async function selectRows(tableOrView, query = '') {
  const suffix = query ? `?${query}` : '';
  return supabaseRequest(`${tableOrView}${suffix}`, { method: 'GET', prefer: '' });
}

export async function insertRow(table, payload) {
  const rows = await supabaseRequest(table, { method: 'POST', body: payload });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function updateRows(table, filterQuery, payload) {
  const rows = await supabaseRequest(`${table}?${filterQuery}`, { method: 'PATCH', body: payload });
  return Array.isArray(rows) ? rows : [];
}

export async function findAccommodationByName(name) {
  const rows = await selectRows('plp_accommodations', `name=eq.${encodeFilterValue(name)}&select=id,name,nightly_rate_php,capacity,bedrooms,is_active&limit=1`);
  return rows?.[0] || null;
}

export async function upsertGuest({ name, email, phone }) {
  const normalized = String(email || '').trim().toLowerCase();
  const existing = await selectRows('plp_guests', `normalized_email=eq.${encodeFilterValue(normalized)}&select=id,full_name,email,phone&limit=1`);
  if (existing?.[0]) {
    const updated = await updateRows('plp_guests', `id=eq.${existing[0].id}`, {
      full_name: String(name || '').slice(0, 120),
      phone: String(phone || '').slice(0, 60),
    });
    return updated?.[0] || existing[0];
  }

  return insertRow('plp_guests', {
    full_name: String(name || '').slice(0, 120),
    email: String(email || '').slice(0, 180),
    phone: String(phone || '').slice(0, 60),
  });
}

export async function createBookingRecord(booking) {
  const accommodation = await findAccommodationByName(booking.accommodation);
  const guest = await upsertGuest({ name: booking.name, email: booking.email, phone: booking.phone });

  return insertRow('plp_bookings', {
    booking_reference: booking.reference,
    guest_id: guest.id,
    accommodation_id: accommodation?.id || null,
    accommodation_name: booking.accommodation,
    check_in: booking.checkIn,
    check_out: booking.checkOut,
    guest_count: Number(booking.guests),
    nights: Number(booking.nights),
    rate_per_night_php: Number(booking.rate || accommodation?.nightly_rate_php || 0),
    total_amount_php: Number(booking.amount || 0),
    deposit_amount_php: Number(booking.deposit || booking.paymentDue || 0),
    balance_amount_php: Number(booking.balance || 0),
    status: 'PENDING_PAYMENT',
    payment_status: 'PENDING',
    special_requests: String(booking.message || '').slice(0, 1200),
    source: 'website',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
}

export async function findBookingByReference(reference) {
  const rows = await selectRows('plp_bookings', `booking_reference=eq.${encodeFilterValue(reference)}&select=*&limit=1`);
  return rows?.[0] || null;
}

export async function createPaymentRecord({ bookingReference, session, amount, checkoutUrl, rawResponse }) {
  const booking = await findBookingByReference(bookingReference);
  if (!booking) throw new Error(`Booking ${bookingReference} was not found`);

  const providerSessionId = session?.paymentSessionId || rawResponse?.payment_session_id || rawResponse?.id || null;
  const providerReferenceId = session?.referenceId || rawResponse?.reference_id || bookingReference;

  const existing = await selectRows('plp_payments', `provider=eq.XENDIT&provider_reference_id=eq.${encodeFilterValue(providerReferenceId)}&select=id&limit=1`);
  if (existing?.[0]) {
    const updated = await updateRows('plp_payments', `id=eq.${existing[0].id}`, {
      provider_session_id: providerSessionId,
      checkout_url: checkoutUrl || session?.checkoutUrl || null,
      amount_php: Number(amount || booking.deposit_amount_php || 0),
      currency: 'PHP',
      status: 'PENDING',
      raw_response: rawResponse || session || {},
      expires_at: session?.expiresAt || rawResponse?.expires_at || null,
    });
    return updated?.[0];
  }

  const payment = await insertRow('plp_payments', {
    booking_id: booking.id,
    provider: 'XENDIT',
    provider_session_id: providerSessionId,
    provider_reference_id: providerReferenceId,
    checkout_url: checkoutUrl || session?.checkoutUrl || null,
    amount_php: Number(amount || booking.deposit_amount_php || 0),
    currency: 'PHP',
    status: 'PENDING',
    raw_response: rawResponse || session || {},
    expires_at: session?.expiresAt || rawResponse?.expires_at || null,
  });

  await updateRows('plp_bookings', `id=eq.${booking.id}`, {
    status: 'PAYMENT_PROCESSING',
    payment_status: 'PROCESSING',
  });

  return payment;
}

function mapXenditPaymentStatus(status, eventType) {
  const normalized = String(status || eventType || '').toUpperCase();
  if (normalized.includes('SUCCEED') || normalized.includes('CAPTURE') || normalized === 'PAID') return 'SUCCEEDED';
  if (normalized.includes('AUTHOR')) return 'AUTHORIZED';
  if (normalized.includes('FAIL')) return 'FAILED';
  if (normalized.includes('EXPIR')) return 'EXPIRED';
  if (normalized.includes('REFUND')) return 'REFUNDED';
  if (normalized.includes('PROCESS')) return 'PROCESSING';
  return 'PENDING';
}

function mapBookingStatus(paymentStatus) {
  if (paymentStatus === 'SUCCEEDED' || paymentStatus === 'CAPTURED') return 'PAID_DEPOSIT';
  if (paymentStatus === 'FAILED') return 'FAILED';
  if (paymentStatus === 'EXPIRED') return 'EXPIRED';
  if (paymentStatus === 'REFUNDED') return 'REFUNDED';
  return 'PAYMENT_PROCESSING';
}

export async function recordXenditWebhook({ webhookId, eventType, reference, providerPaymentId, amount, currency, status, payload }) {
  const booking = reference ? await findBookingByReference(reference) : null;
  const paymentRows = reference
    ? await selectRows('plp_payments', `provider=eq.XENDIT&provider_reference_id=eq.${encodeFilterValue(reference)}&select=id,booking_id&limit=1`)
    : [];
  const payment = paymentRows?.[0] || null;
  const paymentStatus = mapXenditPaymentStatus(status, eventType);

  if (webhookId) {
    const existing = await selectRows('plp_payment_events', `provider=eq.XENDIT&provider_event_id=eq.${encodeFilterValue(webhookId)}&select=id&limit=1`);
    if (existing?.[0]) {
      return { duplicate: true, booking, payment, paymentStatus };
    }
  }

  await insertRow('plp_payment_events', {
    payment_id: payment?.id || null,
    booking_id: booking?.id || payment?.booking_id || null,
    provider: 'XENDIT',
    provider_event_id: webhookId || null,
    event_type: eventType || 'unknown',
    provider_reference_id: reference || null,
    provider_payment_id: providerPaymentId || null,
    amount_php: amount ? Number(amount) : null,
    currency: currency || null,
    status: status || null,
    payload: payload || {},
    processed_at: new Date().toISOString(),
  });

  if (payment?.id) {
    await updateRows('plp_payments', `id=eq.${payment.id}`, {
      provider_payment_id: providerPaymentId || null,
      amount_php: amount ? Number(amount) : undefined,
      currency: currency || 'PHP',
      status: paymentStatus,
      paid_at: paymentStatus === 'SUCCEEDED' ? new Date().toISOString() : null,
      raw_response: payload || {},
    });
  }

  if (booking?.id) {
    await updateRows('plp_bookings', `id=eq.${booking.id}`, {
      status: mapBookingStatus(paymentStatus),
      payment_status: paymentStatus,
    });
  }

  return { duplicate: false, booking, payment, paymentStatus };
}

export async function listPaymentReconciliation(limit = 100) {
  return selectRows('plp_payment_reconciliation', `select=*&order=payment_created_at.desc.nullslast&limit=${Number(limit) || 100}`);
}
