(function () {
  var SITE_EMAIL = 'mfr@e-mango.com';

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

  function isReactApp() {
    // The React SPA shell (index.html) mounts into #root and renders its own
    // navbar, footer, mobile action bar, and per-page trust/summary content.
    // The static HTML route files do not have #root. The injected trust strip
    // and mobile action bar are for those static pages only — inside the SPA
    // they duplicate React's own UI and break against its fixed header / hero.
    return !!document.getElementById('root');
  }

  function skipUxLayer() {
    var path = getPath();
    return isReactApp() || path === '/' || path.indexOf('/api') === 0 || path.indexOf('/photo-library') === 0 || path.indexOf('/admin') === 0 || path.indexOf('/content-ops') === 0 || path.indexOf('/availability-ops') === 0;
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
    addTrustItem(inner, 'Booking', 'Room + dates first');
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
    bar.setAttribute('aria-label', 'Quick site navigation');
    var book = document.createElement('a');
    book.href = '/booking';
    book.textContent = 'Book';
    var rooms = document.createElement('a');
    rooms.href = '/accommodation';
    rooms.textContent = 'Rooms';
    var help = document.createElement('a');
    help.href = '/contact';
    help.textContent = 'Help';
    bar.appendChild(book);
    bar.appendChild(rooms);
    bar.appendChild(help);
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
    ['Pick a room and dates first. The summary updates before you send the request.', 'Availability is reviewed by the PLP team before the stay is treated as final.', 'For urgent dates or special arrangements, email ' + SITE_EMAIL + '.'].forEach(function (text) {
      var li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    });
    box.appendChild(title);
    box.appendChild(list);
    note.parentNode.insertBefore(box, note.nextSibling);
  }

  function ensureRoomBookingLinks() {
    var path = getPath();
    if (path !== '/accommodation' && path !== '/accommodations') return;
    var map = [
      ['#grand-ocean-villa .cta-row a.btn.primary', '/booking?room=grandOceanVilla'],
      ['#sunset-suite .cta-row a.btn.primary', '/booking?room=sunsetSuite'],
      ['#smart-room-premium .cta-row a.btn.primary', '/booking?room=smartRoomPremium']
    ];
    map.forEach(function (pair) {
      var el = document.querySelector(pair[0]);
      if (el) el.setAttribute('href', pair[1]);
    });
  }

  function ensureProductionLayer() {
    ensureImagePlacementStylesheet();
    ensureTrustStrip();
    ensureMobileAction();
    ensureBookingAssurance();
    ensureRoomBookingLinks();
  }

  function getValue(object, path) {
    if (!object || !path) return undefined;
    return String(path).split('.').reduce(function (current, part) {
      if (current && Object.prototype.hasOwnProperty.call(current, part)) return current[part];
      return undefined;
    }, object);
  }

  function money(value) {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
    } catch (e) {
      return '$' + Number(value || 0).toLocaleString('en-US');
    }
  }

  function normalText(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
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
    updateFirstMatch('p', 'up to 8 guests', 'The Grand Ocean Villa is positioned for up to ' + (villa.capacity || 8) + ' guests, with ' + (villa.bedrooms || 4) + ' bedrooms, private pool atmosphere, living space, kitchen comfort, and hillside views.');
  }

  function applyContent(content) {
    if (!content) return;
    ensureProductionLayer();
    hydrateBoundElements(content);
    applyAccommodation(content);
    // Experience paragraphs and lists have explicit data-content bindings;
    // replacing the first list item with its paragraph repeated that copy.
    applyBooking(content);
    applyImageCaptions();
    ensureRoomBookingLinks();
    window.dispatchEvent(new CustomEvent('plp:content', { detail: content }));
  }

  var cachedContent;
  function loadContent() {
    ensureProductionLayer();
    applyImageCaptions();
    fetch('/api/plp?action=content', { headers: { Accept: 'application/json' } })
      .then(function (response) { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
      .then(function (data) { cachedContent = data.content || {}; applyContent(cachedContent); })
      .catch(function () { /* The server-rendered page keeps its default content. */ });
  }

  window.plpHydrateContent = applyContent;
  window.addEventListener('plp:navigation', function () {
    if (cachedContent) applyContent(cachedContent);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadContent, { once: true });
  else loadContent();
})();
