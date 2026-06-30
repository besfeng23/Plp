(function () {
  var viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    var viewportContent = viewport.getAttribute('content') || '';
    if (viewportContent.indexOf('viewport-fit=cover') === -1) {
      viewport.setAttribute('content', viewportContent + (viewportContent ? ', ' : '') + 'viewport-fit=cover');
    }
  }

  var key = 'plp_session_id';

  function sessionId() {
    try {
      var id = window.sessionStorage.getItem(key);
      if (id) return id;
      id = 'plp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      window.sessionStorage.setItem(key, id);
      return id;
    } catch (error) {
      return 'plp_session';
    }
  }

  function safePayload(payload) {
    var output = {};
    payload = payload || {};
    Object.keys(payload).forEach(function (name) {
      if (['name', 'email', 'phone', 'message', 'specialRequests'].indexOf(name) >= 0) return;
      var value = payload[name];
      if (typeof value === 'string') output[name] = value.slice(0, 240);
      else if (typeof value === 'number' || typeof value === 'boolean') output[name] = value;
      else if (value == null) output[name] = null;
    });
    return output;
  }

  function track(eventName, payload) {
    try {
      window.fetch('/api/plp?action=analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: eventName,
          payload: safePayload(payload),
          path: window.location.pathname,
          sessionId: sessionId()
        }),
        keepalive: true
      }).catch(function () {});
    } catch (error) {}
  }

  window.plpTrack = track;

  function money(value) {
    return '₱' + Number(value || 0).toLocaleString('en-PH');
  }

  function syncBookingVisiblePayPalPrices() {
    if (window.location.pathname !== '/booking') return;

    var roomRates = {
      grandOceanVilla: 30,
      sunsetSuite: 20,
      smartRoomPremium: 10
    };
    var roomNames = {
      grandOceanVilla: 'Grand Ocean Villa',
      sunsetSuite: 'Sunset Suite',
      smartRoomPremium: 'Smart Room Premium'
    };
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var syncing = false;

    function selectedKey() {
      var select = document.getElementById('roomSelect');
      return select && roomRates[select.value] ? select.value : 'grandOceanVilla';
    }

    function asDate(value) {
      return value ? new Date(value + 'T00:00:00') : null;
    }

    function pretty(value) {
      var date = asDate(value);
      if (!date || Number.isNaN(date.getTime())) return '—';
      return months[date.getMonth()] + ' ' + date.getDate();
    }

    function nightsCount() {
      var checkIn = document.getElementById('checkIn');
      var checkOut = document.getElementById('checkOut');
      var start = asDate(checkIn && checkIn.value);
      var end = asDate(checkOut && checkOut.value);
      if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
      var diff = end.getTime() - start.getTime();
      return diff > 0 ? Math.round(diff / 86400000) : 0;
    }

    function paypalDue(roomKey, nights) {
      return Math.round((roomRates[roomKey] || 0) * Math.max(Number(nights) || 1, 1) * 0.3);
    }

    function syncSelect() {
      var select = document.getElementById('roomSelect');
      if (!select) return;
      Array.prototype.forEach.call(select.options || [], function (option) {
        if (!roomRates[option.value]) return;
        option.textContent = roomNames[option.value] + ' · ' + money(paypalDue(option.value, 1)) + ' PayPal due';
      });
    }

    function syncCalendarRates() {
      var due = money(paypalDue(selectedKey(), 1));
      document.querySelectorAll('.day-rate').forEach(function (node) {
        if (node.textContent !== due) node.textContent = due;
      });
    }

    function syncSummary() {
      var summary = document.getElementById('summaryLine');
      var checkIn = document.getElementById('checkIn');
      var checkOut = document.getElementById('checkOut');
      var nights = nightsCount();
      if (!summary || !nights) return;
      var key = selectedKey();
      var html = roomNames[key] + ' <span>·</span> ' + pretty(checkIn && checkIn.value) + ' to ' + pretty(checkOut && checkOut.value) + ' <span>·</span> ' + nights + ' night' + (nights > 1 ? 's' : '') + ' <span>·</span> ' + money(paypalDue(key, nights)) + ' PayPal due';
      if (summary.innerHTML !== html) summary.innerHTML = html;
    }

    function sync() {
      if (syncing) return;
      syncing = true;
      syncSelect();
      syncCalendarRates();
      syncSummary();
      syncing = false;
    }

    sync();
    document.addEventListener('change', function (event) {
      if (event.target && ['roomSelect', 'checkIn', 'checkOut', 'guests'].indexOf(event.target.id) >= 0) setTimeout(sync, 0);
    });
    document.addEventListener('click', function () { setTimeout(sync, 0); });

    if (typeof MutationObserver !== 'undefined' && document.body) {
      var observer = new MutationObserver(function () { setTimeout(sync, 0); });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  function trackView() {
    track('view_page', { title: document.title });
    if (window.location.pathname === '/booking') track('view_booking', { title: document.title });
    syncBookingVisiblePayPalPrices();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', trackView);
  else trackView();

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('a,button') : null;
    if (!target) return;
    var label = (target.getAttribute('aria-label') || target.textContent || '').trim().slice(0, 80);
    var href = target.getAttribute('href') || '';
    var search = (label + ' ' + href).toLowerCase();
    if (search.indexOf('reserve') >= 0 || search.indexOf('/booking') >= 0) track('click_reserve', { label: label, href: href });
    if (search.indexOf('mailto:') >= 0 || search.indexOf('email') >= 0) track('click_email', { label: label, href: href });
    if (search.indexOf('concierge') >= 0) track('click_concierge', { label: label, href: href });
    if (window.location.pathname === '/booking' && search.indexOf('continue') >= 0) track('start_booking', { label: label });
  });

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || form.id !== 'bookingForm') return;
    var accommodation = document.getElementById('roomSelect');
    var checkIn = document.getElementById('checkIn');
    var checkOut = document.getElementById('checkOut');
    var guests = document.getElementById('guests');
    track('submit_booking', {
      accommodation: accommodation && accommodation.value,
      hasDates: Boolean(checkIn && checkIn.value && checkOut && checkOut.value),
      guests: guests ? Number(guests.value || 0) : null
    });
  });
})();
