import { formatPeso, formatUsd, PLP_DEPOSIT_RATE, PLP_ROOMS, quoteStay } from '../lib/pricing.js';
import { nightsBetween, occupiedNights, shiftMonth, todayAtResort } from '../lib/booking-dates.js';

import { requestedGuests } from '../lib/guest-journey.js';

const element = id => document.getElementById(id);
const track = name => window.plpTrack?.(name);
const fullDate = new Intl.DateTimeFormat('en-PH', { dateStyle: 'full', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthName = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
let today = todayAtResort();
let firstMonth = today.slice(0, 7);
const requestedRoom = (new URLSearchParams(location.search).get('room') || '').toLowerCase();

let selected = PLP_ROOMS.find(room =>
  [room.key, room.name, room.slug].some(value => value.toLowerCase() === requestedRoom)
) || PLP_ROOMS[0];
let month = firstMonth;
let checkIn = '';
let checkOut = '';
let rangeState = 'empty';
let calendarVersion = 0;
let rangeVersion = 0;
let submitting = false;
let savedRequest = false;
let pendingBooking = null;
const calendarMonths = new Map();

function canCheckOut(date) {
  if (date <= checkIn) return false;
  for (const night of occupiedNights(checkIn, date)) {
    const availability = calendarMonths.get(night.slice(0, 7));
    if (!availability || availability.has(night)) return false;
  }
  return true;
}

function renderCalendar(focusDate) {
  const start = new Date(month + '-01T00:00:00Z');
  const end = shiftMonth(month, 1) + '-01';
  const availability = calendarMonths.get(month);
  const choosingCheckout = Boolean(checkIn && !checkOut);
  element('monthTitle').textContent = monthName.format(start);
  element('prevMonth').disabled = month === firstMonth || submitting;
  element('nextMonth').disabled = month === '9999-11' || submitting;
  const days = document.createDocumentFragment();

  for (let i = 0; i < start.getUTCDay(); i += 1) {
    const spacer = document.createElement('span');
    spacer.setAttribute('aria-hidden', 'true');
    days.append(spacer);
  }

  let focusTarget;
  for (const date of occupiedNights(month + '-01', end)) {
    const blocked = availability?.has(date);
    const checkoutOnly = Boolean(blocked && choosingCheckout && canCheckOut(date));
    const outsideRange = choosingCheckout && date > checkIn && !canCheckOut(date);
    const isStart = date === checkIn;
    const isEnd = date === checkOut;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'day';
    button.dataset.date = date;
    button.classList.toggle('blocked', Boolean(blocked));
    button.classList.toggle('checkout-only', checkoutOnly);
    button.classList.toggle('selected', isStart || isEnd);
    button.classList.toggle('start', isStart);
    button.classList.toggle('end', isEnd);
    button.classList.toggle('range', Boolean(checkOut && date > checkIn && date < checkOut));
    button.disabled = submitting || !availability || date < today || (blocked && !checkoutOnly) || outsideRange;

    let hint = '';
    if (date < today) hint = 'Past date';
    else if (!availability) hint = 'Availability pending';
    else if (checkoutOnly) hint = 'Checkout only';
    else if (blocked) hint = 'Unavailable';
    else if (outsideRange) hint = 'Stay crosses an unavailable or unchecked night';
    else if (isStart) hint = 'Selected check-in';
    else if (isEnd) hint = 'Selected checkout';
    button.setAttribute('aria-label', [fullDate.format(new Date(date)), hint].filter(Boolean).join(', '));
    button.setAttribute('aria-pressed', String(isStart || isEnd));

    const number = document.createElement('span');
    number.className = 'day-number';
    number.textContent = String(Number(date.slice(-2)));
    button.append(number);
    if (!button.disabled && !checkoutOnly) {
      const rate = document.createElement('span');
      rate.className = 'day-rate';
      rate.textContent = formatPeso(selected.rate);
      button.append(rate);
    }
    if (date === focusDate) focusTarget = button;
    days.append(button);
  }

  element('days').replaceChildren(days);
  focusTarget?.focus({ preventScroll: true });
}

async function loadMonth() {
  const version = ++calendarVersion;
  const requestedMonth = month;
  const room = selected.key;
  const status = element('calendarStatus');
  status.textContent = 'Checking this month…';
  element('retryCalendar').hidden = true;
  calendarMonths.delete(month);
  renderCalendar();

  try {
    const query = new URLSearchParams({ room, month: requestedMonth });
    const response = await fetch('/api/check-availability?' + query, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (version !== calendarVersion) return;
    if (response.status === 404) {
      status.textContent = 'This accommodation is unavailable. Choose another room or contact concierge.';
    } else if (response.ok && data.room === room && data.month === requestedMonth && Array.isArray(data.unavailableNights)) {
      calendarMonths.set(requestedMonth, new Set(data.unavailableNights));
      status.textContent = checkIn && !checkOut ? 'Choose your checkout date.' : 'Choose your check-in date.';
    } else {
      throw new Error('Calendar unavailable');
    }
  } catch {
    if (version !== calendarVersion) return;
    status.textContent = 'Availability could not be loaded. Retry or contact concierge.';
    element('retryCalendar').hidden = false;
  }

  renderCalendar();
}

function showRangeStatus(message, tone = '', retry = false) {
  element('availabilityStatus').textContent = message;
  element('availability').className = tone ? 'availability ' + tone : 'availability';
  element('availability').hidden = !message;
  element('retryRange').hidden = !retry;
}

function updateSummary() {
  const nights = nightsBetween(checkIn, checkOut);
  element('continueBtn').disabled = rangeState !== 'available' || submitting;
  element('estimateCard').hidden = !nights;
  if (!nights) {
    element('summaryLine').textContent = checkIn
      ? 'Check-in ' + shortDate.format(new Date(checkIn)) + ' · choose checkout'
      : 'Select dates to continue';
    return;
  }

  const { amount, deposit, balance } = quoteStay(selected, nights);
  element('summaryLine').textContent = [
    selected.name,
    shortDate.format(new Date(checkIn)) + ' to ' + shortDate.format(new Date(checkOut)),
    nights + (nights === 1 ? ' night' : ' nights'),
    formatUsd(amount),
  ].join(' · ');
  element('estStay').textContent = formatUsd(amount);
  element('estDeposit').textContent = formatUsd(deposit);
  element('estBalance').textContent = formatUsd(balance);
}

function resetRange(focusDate) {
  checkIn = '';
  checkOut = '';
  rangeVersion += 1;
  rangeState = 'empty';
  savedRequest = false;
  pendingBooking = null;
  element('submitBtn').textContent = 'Send reservation request';
  element('submitBtn').disabled = false;
  element('guestForm').hidden = true;
  showRangeStatus('');
  updateSummary();
  renderCalendar(focusDate);
}

function refreshResortDay() {
  const currentDay = todayAtResort();
  if (currentDay === today) return;
  today = currentDay;
  firstMonth = today.slice(0, 7);
  const needsCurrentMonth = month < firstMonth;
  if (needsCurrentMonth) month = firstMonth;
  if (checkIn && checkIn < today) {
    resetRange();
    showRangeStatus('The selected check-in date has passed. Choose a new date in Boracay.', 'bad');
  }
  if (needsCurrentMonth) void loadMonth();
  else renderCalendar();
}

async function verifyRange() {
  const version = ++rangeVersion;
  rangeState = 'checking';
  updateSummary();
  showRangeStatus('Checking these dates…');
  try {
    const response = await fetch('/api/check-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accommodation: selected.name, checkIn, checkOut }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (version !== rangeVersion) return;
    if (response.ok && data.available === true) {
      rangeState = 'available';
      showRangeStatus('These dates are currently open for request. The resort team will confirm the stay.', 'good');
    } else if (response.status === 409 && data.available === false) {
      resetRange();
      calendarMonths.clear();
      void loadMonth();
      showRangeStatus('These dates are no longer available. Choose another stay.', 'bad');
    } else {
      throw new Error('Availability unavailable');
    }
  } catch {
    if (version !== rangeVersion) return;
    rangeState = 'unverified';
    showRangeStatus('We could not verify these dates. Check again or contact concierge.', '', true);
  }
  updateSummary();
}

function pickDate(date) {
  rangeVersion += 1;
  rangeState = 'empty';
  savedRequest = false;
  pendingBooking = null;
  element('submitBtn').textContent = 'Send reservation request';
  element('submitBtn').disabled = false;
  element('guestForm').hidden = true;
  showRangeStatus('');
  if (!checkIn || checkOut || date <= checkIn) {
    checkIn = date;
    checkOut = '';
    element('calendarStatus').textContent = 'Choose your checkout date.';
  } else {
    checkOut = date;
    element('calendarStatus').textContent = 'Dates selected.';
    void verifyRange();
  }

  renderCalendar(date);
  updateSummary();
}

function setSubmitting(value) {
  submitting = value;
  for (const id of ['submitBtn', 'roomSelect', 'guests', 'modifyDates', 'retryCalendar']) {
    element(id).disabled = value;
  }
  element('submitBtn').disabled = value;
  updateSummary();
  renderCalendar();
}

async function submitReservation(event) {
  event.preventDefault();
  refreshResortDay();
  if (rangeState !== 'available' || submitting) return;
  const status = element('status');
  setSubmitting(true);
  status.className = 'status';
  status.textContent = pendingBooking ? 'Resuming your saved deposit checkout…' : 'Preparing your reservation request…';
  if (!pendingBooking) track('submit_booking');
  const { amount, deposit } = quoteStay(selected, nightsBetween(checkIn, checkOut));
  const payload = {
    name: element('name').value,
    email: element('email').value,
    phone: element('phone').value,
    accommodation: selected.name,
    checkIn,
    checkOut,
    guests: Number(element('guests').value),
    message: element('message').value,
    quote: { amount, deposit },
  };
  let booking = pendingBooking;
  try {
    if (!booking) {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || result.booking?.persisted !== true) {
        if (response.status === 409 && /available/i.test(result.error || '')) {
          resetRange();
          calendarMonths.clear();
          void loadMonth();
          showRangeStatus('These dates are no longer available. Choose another stay.', 'bad');
          element('calendar').focus();
          return;
        }
        throw new Error(result.error || 'Your request could not be saved. Please try again or contact concierge.');
      }
      booking = result.booking;
      pendingBooking = booking;
      savedRequest = true;
      element('submitBtn').textContent = 'Retry secure deposit checkout';
      track('booking_created');
    }

    const checkoutResponse = await fetch('/api/paypal/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking }),
    });
    const checkout = await checkoutResponse.json();
    if (!checkoutResponse.ok || !checkout.checkoutUrl) throw new Error('Deposit checkout unavailable');
    try {
      localStorage.setItem('plp_pending_payment', JSON.stringify({ booking: { reference: booking.reference } }));
    } catch {
      // The provider return URL also carries the booking reference.
    }
    location.href = checkout.checkoutUrl;
  } catch (error) {
    status.className = 'status error';
    status.textContent = booking
      ? 'Your reservation request was saved' + (booking.reference ? ' (reference ' + booking.reference + ')' : '') + ', but deposit checkout did not open. No payment was taken and the stay is not confirmed. You may retry checkout with the same request, or contact concierge.'
      : error.message;
  } finally {
    setSubmitting(false);
  }
}

for (const room of PLP_ROOMS) {
  element('roomSelect').add(new Option(room.name, room.key));
}
element('roomSelect').value = selected.key;
function showRoomMeta() {
  element('roomMeta').textContent = formatUsd(selected.rate) + ' per night · up to ' + selected.capacity + ' guests';
}
showRoomMeta();
element('guests').max = selected.capacity;
const initialGuests = requestedGuests(new URLSearchParams(location.search).get('guests'), selected.capacity);
if (initialGuests !== null) element('guests').value = initialGuests;
element('depositRate').textContent = '(' + Math.round(PLP_DEPOSIT_RATE * 100) + '%)';
element('roomSelect').addEventListener('change', () => {
  selected = PLP_ROOMS.find(room => room.key === element('roomSelect').value);
  showRoomMeta();
  const guests = element('guests');
  guests.max = selected.capacity;
  if (Number(guests.value) > selected.capacity) guests.value = selected.capacity;
  calendarMonths.clear();
  resetRange();
  void loadMonth();
  track('select_room');
});

element('days').addEventListener('click', event => {
  const day = event.target.closest('button[data-date]');
  if (!day || day.disabled) return;
  refreshResortDay();
  if (day.dataset.date >= today && day.dataset.date.startsWith(month)) pickDate(day.dataset.date);
});
element('modifyDates').addEventListener('click', () => {
  resetRange();
  element('calendarStatus').textContent = calendarMonths.has(month) ? 'Choose your check-in date.' : element('calendarStatus').textContent;
});
for (const [id, offset] of [['prevMonth', -1], ['nextMonth', 1]]) {
  element(id).addEventListener('click', () => {
    month = shiftMonth(month, offset);
    void loadMonth();
  });
}
element('retryCalendar').addEventListener('click', loadMonth);
element('retryRange').addEventListener('click', verifyRange);
element('continueBtn').addEventListener('click', () => {
  refreshResortDay();
  if (rangeState !== 'available') return;
  const guestForm = element('guestForm');
  guestForm.hidden = false;
  guestForm.focus();
  track('start_booking');
});
element('bookingForm').addEventListener('submit', submitReservation);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshResortDay();
});
updateSummary();
void loadMonth();
