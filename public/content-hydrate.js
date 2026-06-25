(function () {
  function getPath() {
    return window.location.pathname.replace(/\/$/, '') || '/';
  }

  function getValue(object, path) {
    if (!object || !path) return undefined;
    return String(path).split('.').reduce(function (current, part) {
      if (current && Object.prototype.hasOwnProperty.call(current, part)) return current[part];
      return undefined;
    }, object);
  }

  function money(value) {
    return '₱' + Number(value || 0).toLocaleString('en-PH');
  }

  function normalText(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function setText(selector, value) {
    if (!value) return;
    var el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function updateFirstMatch(tag, contains, value) {
    if (!value) return;
    var nodes = document.querySelectorAll(tag);
    for (var i = 0; i < nodes.length; i += 1) {
      if ((nodes[i].textContent || '').toLowerCase().indexOf(contains.toLowerCase()) >= 0) {
        nodes[i].textContent = value;
        return;
      }
    }
  }

  function hydrateBoundElements(content) {
    document.querySelectorAll('[data-content-key]').forEach(function (el) {
      var value = getValue(content, el.getAttribute('data-content-key'));
      if (value == null) return;
      el.textContent = normalText(value);
    });

    document.querySelectorAll('[data-content-money]').forEach(function (el) {
      var value = getValue(content, el.getAttribute('data-content-money'));
      if (value == null) return;
      el.textContent = money(value);
    });

    document.querySelectorAll('[data-content-template]').forEach(function (el) {
      var key = el.getAttribute('data-content-key') || el.getAttribute('data-content-money');
      var value = getValue(content, key);
      if (value == null) return;
      var renderedValue = el.hasAttribute('data-content-money') ? money(value) : normalText(value);
      el.textContent = el.getAttribute('data-content-template').replace(/\{\{value\}\}/g, renderedValue);
    });

    document.querySelectorAll('[data-content-list]').forEach(function (el) {
      var value = getValue(content, el.getAttribute('data-content-list'));
      if (value == null) return;
      var items = Array.isArray(value) ? value : String(value).split('|').map(function (item) { return item.trim(); }).filter(Boolean);
      if (!items.length) return;
      el.innerHTML = items.map(function (item) { return '<li>' + String(item).replace(/[<>]/g, '') + '</li>'; }).join('');
    });
  }

  function applyHome(content) {
    var home = content.homepage || {};
    var path = getPath();
    if (path !== '/') return;
    setText('h1', home.heroTitle);
    updateFirstMatch('p', 'private hillside retreat', home.heroSubtitle);
    updateFirstMatch('button', 'reserve your stay', home.primaryCta);
  }

  function applyBooking(content) {
    if (typeof window.plpApplyBookingContent === 'function') {
      window.plpApplyBookingContent(content);
    }
  }

  function applyAccommodation(content) {
    var path = getPath();
    if (path !== '/accommodation' && path !== '/accommodations') return;
    var acc = content.accommodation || {};
    var villa = acc.grandOceanVilla || {};
    var suite = acc.sunsetSuite || {};
    var room = acc.smartRoomPremium || {};
    updateFirstMatch('strong', '₱40,000', money(villa.rate));
    updateFirstMatch('strong', '₱18,000', money(suite.rate));
    updateFirstMatch('strong', '₱8,000', money(room.rate));
    updateFirstMatch('p', 'up to 8 guests', 'The Grand Ocean Villa is positioned for up to ' + (villa.capacity || 8) + ' guests, with ' + (villa.bedrooms || 4) + ' bedrooms, private pool atmosphere, living space, kitchen comfort, and hillside views.');
  }

  function applyExperiences(content) {
    var path = getPath();
    if (path !== '/experiences') return;
    var exp = content.experiences || {};
    updateFirstMatch('li', 'paraw sailing', exp.water);
    updateFirstMatch('li', 'quiet recovery', exp.wellness);
    updateFirstMatch('li', 'sunset dinner', exp.privateDining);
  }

  function applyContent(content) {
    if (!content) return;
    hydrateBoundElements(content);
    applyHome(content);
    applyAccommodation(content);
    applyExperiences(content);
    applyBooking(content);
    window.dispatchEvent(new CustomEvent('plp:content', { detail: content }));
  }

  function loadContent() {
    fetch('/api/plp?action=content', { headers: { Accept: 'application/json' } })
      .then(function (response) { return response.json(); })
      .then(function (data) { applyContent(data.content || {}); })
      .catch(function () {});
  }

  window.plpHydrateContent = applyContent;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      loadContent();
      setTimeout(loadContent, 700);
      setTimeout(loadContent, 1800);
    });
  } else {
    loadContent();
    setTimeout(loadContent, 700);
    setTimeout(loadContent, 1800);
  }
})();
