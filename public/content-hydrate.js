(function () {
  function getPath() {
    return window.location.pathname.replace(/\/$/, '') || '/';
  }

  function money(value) {
    return '₱' + Number(value || 0).toLocaleString('en-PH');
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
    applyHome(content);
    applyAccommodation(content);
    applyExperiences(content);
    applyBooking(content);
    window.dispatchEvent(new CustomEvent('plp:content', { detail: content }));
  }

  function loadContent() {
    fetch('/api/content', { headers: { Accept: 'application/json' } })
      .then(function (response) { return response.json(); })
      .then(function (data) { applyContent(data.content || {}); })
      .catch(function () {});
  }

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
