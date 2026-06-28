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

  function trackView() {
    track('view_page', { title: document.title });
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
  });
})();
