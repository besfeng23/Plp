(function () {
  var SITE_EMAIL = 'plpvillas@gmail.com';

  function ensureImagePlacementStylesheet() {
    if (document.querySelector('link[data-plp-image-placement]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/image-placement.css';
    link.setAttribute('data-plp-image-placement', 'true');
    document.head.appendChild(link);
  }

  function getPath() {
    return window.location.pathname.replace(/\/$/, '') || '/';
  }

  function skipUxLayer() {
    var path = getPath();
    return path === '/' || path.indexOf('/api') === 0 || path.indexOf('/photo-library') === 0 || path.indexOf('/admin') === 0 || path.indexOf('/content-ops') === 0 || path.indexOf('/availability-ops') === 0;
  }

  function addTrustItem(parent, label, value) {
    var item = document.createElement('div');
    var small = document.createElement('span');
    var strong = document.createElement('strong');
    small.textContent = label;
    strong.textContent = value;
    item.appendChild(small);
    item.appendChild(strong);
    parent.appendChild(item);
  }

  function ensureTrustStrip() {
    if (skipUxLayer() || document.querySelector('[data-plp-trust-strip]')) return;
    var strip = document.createElement('section');
    var inner = document.createElement('div');
    strip.className = 'plp-trust-strip';
    strip.setAttribute('data-plp-trust-strip', 'true');
    strip.setAttribute('aria-label', 'Reservation trust details');
    inner.className = 'plp-trust-strip__inner';
    addTrustItem(inner, 'Location', 'High Boracay');
    addTrustItem(inner, 'Reservation', 'Reviewed privately');
    addTrustItem(inner, 'Arrival', 'Port transfer support');
    addTrustItem(inner, 'Concierge', SITE_EMAIL);
    strip.appendChild(inner);
    var nav = document.querySelector('nav.nav, header');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(strip, nav.nextSibling);
    else document.body.insertBefore(strip, document.body.firstChild);
  }

  function ensureMobileAction() {
    if (skipUxLayer() || document.querySelector('[data-plp-mobile-action]')) return;
    var bar = document.createElement('nav');
    bar.className = 'plp-mobile-action';
    bar.setAttribute('data-plp-mobile-action', 'true');
    bar.setAttribute('aria-label', 'Quick reservation actions');
    var reserve = document.createElement('a');
    reserve.href = '/booking';
    reserve.textContent = 'Reserve';
    var email = document.createElement('a');
    email.href = 'mailto:' + SITE_EMAIL;
    email.textContent = 'Email';
    var contact = document.createElement('a');
    contact.href = '/contact';
    contact.textContent = 'Concierge';
    bar.appendChild(reserve);
    bar.appendChild(email);
    bar.appendChild(contact);
    document.body.appendChild(bar);
  }

  function ensureBookingAssurance() {
    if (getPath() !== '/booking' || document.querySelector('[data-plp-booking-assurance]')) return;
    var note = document.getElementById('reservationNote') || document.querySelector('.summary .note');
    if (!note || !note.parentNode) return;
    var box = document.createElement('div');
    box.className = 'plp-booking-assurance';
    box.setAttribute('data-plp-booking-assurance', 'true');
    var title = document.createElement('strong');
    title.textContent = 'Before you continue';
    var list = document.createElement('ul');
    ['This creates a private reservation request before final confirmation.', 'Availability is reviewed by the PLP team before the stay is treated as final.', 'For urgent dates or special arrangements, email ' + SITE_EMAIL + '.'].forEach(function (text) {
      var li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    });
    box.appendChild(title);
    box.appendChild(list);
    note.parentNode.insertBefore(box, note.nextSibling);
  }

  function ensureProductionLayer() {
    ensureImagePlacementStylesheet();
    ensureTrustStrip();
    ensureMobileAction();
    ensureBookingAssurance();
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

  function setCaption(selector, text) {
    var el = document.querySelector(selector);
    if (el) el.textContent = text;
  }

  function applyImageCaptions() {
    var path = getPath();
    if (path === '/accommodation' || path === '/accommodations') {
      setCaption('#grand-ocean-villa .visual.main span', 'Grand Ocean Villa exterior and pool');
      setCaption('#grand-ocean-villa .side-gallery .visual:nth-child(1) span', 'Pool deck with ocean view');
      setCaption('#grand-ocean-villa .side-gallery .visual:nth-child(2) span', 'Master bedroom view');
      setCaption('#sunset-suite .visual.main span', 'Sunset balcony lounge');
      setCaption('#sunset-suite .side-gallery .visual:nth-child(1) span', 'Day balcony and sea view');
      setCaption('#sunset-suite .side-gallery .visual:nth-child(2) span', 'Rooftop evening lounge');
      setCaption('#smart-room-premium .visual.main span', 'Bright twin room with sea view');
      setCaption('#smart-room-premium .side-gallery .visual:nth-child(1) span', 'Bedroom corner and balcony outlook');
      setCaption('#smart-room-premium .side-gallery .visual:nth-child(2) span', 'Bathroom vanity and shower');
    }
    if (path === '/experiences') {
      setCaption('#water .visual span', 'Poolside breakfast and water view');
      setCaption('#wellness .visual span', 'Wellness bath ritual');
      setCaption('#private-dining .visual span', 'Private breakfast by the pool');
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
    ensureProductionLayer();
    hydrateBoundElements(content);
    applyHome(content);
    applyAccommodation(content);
    applyExperiences(content);
    applyBooking(content);
    applyImageCaptions();
    window.dispatchEvent(new CustomEvent('plp:content', { detail: content }));
  }

  function loadContent() {
    ensureProductionLayer();
    fetch('/api/plp?action=content', { headers: { Accept: 'application/json' } })
      .then(function (response) { return response.json(); })
      .then(function (data) { applyContent(data.content || {}); })
      .catch(function () { applyImageCaptions(); ensureProductionLayer(); });
  }

  window.plpHydrateContent = applyContent;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      ensureProductionLayer();
      applyImageCaptions();
      loadContent();
      setTimeout(loadContent, 700);
      setTimeout(loadContent, 1800);
    });
  } else {
    ensureProductionLayer();
    applyImageCaptions();
    loadContent();
    setTimeout(loadContent, 700);
    setTimeout(loadContent, 1800);
  }
})();
