(() => {
  const consentKey = 'plp_analytics_consent_v2';
  const events = new Set(['click_reserve', 'booking_interest', 'click_email', 'click_phone', 'select_room', 'start_booking', 'submit_booking', 'booking_created', 'submit_enquiry', 'submit_club_enquiry', 'submit_residential_interest']);
  const pages = new Set([
    '/', '/accommodation', '/accommodations', '/accommodation/grand-ocean-villa',
    '/accommodation/sunset-suite', '/accommodation/smart-room-premium', '/experiences',
    '/club', '/senior-living', '/gallery', '/getting-here', '/booking', '/contact', '/exclusive-offer',
    '/reservation-policy', '/privacy-policy', '/terms-of-service',
    '/private-villas-boracay', '/boracay-villa-with-private-pool', '/boracay-family-villa',
    '/boracay-wellness-stay', '/high-boracay-location',
  ]);
  const noAds = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  let config;
  let consent;
  let consentVersion = 0;
  let consentStorage;
  let lastPath;
  let analyticsPanel;
  let googleTag;
  let postHog;
  let pendingPostHog;
  try {
    consentStorage = window.localStorage;
    consent = consentStorage.getItem(consentKey);
  } catch { /* Browser storage is optional. */ }

  function publicPath() {
    const path = location.pathname.replace(/\/$/, '') || '/';
    return pages.has(path) ? path : null;
  }

  function enableGoogle(path) {
    const id = config?.googleId;
    if (!id) return;
    window['ga-disable-' + id] = false;
    if (googleTag) return;

    window.dataLayer = window.dataLayer || [];
    googleTag = function () { window.dataLayer.push(arguments); };
    googleTag('consent', 'default', { ...noAds, analytics_storage: 'denied' });
    googleTag('consent', 'update', { ...noAds, analytics_storage: 'granted' });
    googleTag('js', new Date());
    googleTag('config', id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: 'none',
      page_location: location.origin + path,
      page_referrer: '',
    });

    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.append(tag);
  }

  function getPostHog() {
    if (!config?.posthog) return Promise.resolve(null);
    if (!pendingPostHog) {
      pendingPostHog = import('/plp-posthog.js')
        .then(module => {
          if (consent !== 'allow') {
            pendingPostHog = undefined;
            return null;
          }
          postHog = module.initializePostHog(config.posthog);
          postHog?.opt_in_capturing({ captureEventName: false });
          return postHog;
        })
        .catch(() => null);
    }
    return pendingPostHog;
  }

  function send(event, path = publicPath()) {
    if (consent !== 'allow' || !config || !path) return;
    const version = consentVersion;
    enableGoogle(path);
    googleTag?.('event', event, {
      send_to: config.googleId,
      page_location: location.origin + path,
      page_referrer: '',
    });
    // First-party counts receive only an event category and an approved page
    // pathname. No form fields, URL query, referrer, IP-derived session ID or
    // person identifier is included. Optional tracking requires consent.
    const category = event === 'page_view' ? 'view_page' : event;
    void fetch('/api/plp?action=analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      keepalive: true,
      body: JSON.stringify({ event: category, path, privacyConsent: true }),
    }).catch(() => {});
    void getPostHog().then(client => {
      if (client && consent === 'allow' && version === consentVersion) {
        const properties = { $current_url: location.origin + path, $pathname: path };
        client.capture(event === 'page_view' ? '$pageview' : event, properties);
        if (event === 'click_reserve') client.capture('booking_interest', properties);
      }
    });
  }

  function recordPage() {
    const path = publicPath();
    if (path && path !== lastPath) {
      lastPath = path;
      send('page_view', path);
    }
  }

  function applyConsent(value) {
    if (value !== consent) consentVersion += 1;
    consent = value;
    if (!analyticsPanel) return;
    analyticsPanel.hidden = value === 'allow' || value === 'decline';
    if (value === 'allow') {
      if (googleTag) googleTag('consent', 'update', { ...noAds, analytics_storage: 'granted' });
      postHog?.opt_in_capturing({ captureEventName: false });
      lastPath = null;
      recordPage();
      return;
    }

    if (config.googleId) {
      window['ga-disable-' + config.googleId] = true;
      const propertyCookie = '_ga_' + config.googleId.slice(2);
      for (const cookie of ['_ga', propertyCookie]) {
        document.cookie = cookie + '=; Max-Age=0; Path=/; SameSite=Lax';
      }
    }
    postHog?.opt_out_capturing();
  }

  function setConsent(value) {
    try { consentStorage?.setItem(consentKey, value); } catch { /* Keep the choice for this page. */ }
    applyConsent(value);
  }

  function addSettings() {
    if (analyticsPanel) return;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/analytics-consent.css';
    document.head.append(css);

    analyticsPanel = document.createElement('section');
    analyticsPanel.className = 'plp-analytics-consent';
    analyticsPanel.setAttribute('aria-label', 'Optional analytics');
    analyticsPanel.innerHTML = '<p>Allow optional analytics to help improve this site.</p><div><button type="button" data-choice="decline">Decline</button><button type="button" data-choice="allow">Allow analytics</button></div>';
    analyticsPanel.hidden = consent === 'allow' || consent === 'decline';
    analyticsPanel.addEventListener('click', event => {
      const choice = event.target.dataset.choice;
      if (choice) setConsent(choice);
    });
    document.body.append(analyticsPanel);

    const settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'plp-analytics-settings';
    settings.textContent = 'Analytics settings';
    settings.addEventListener('click', () => {
      analyticsPanel.hidden = false;
      analyticsPanel.querySelector('button').focus();
    });
    (document.querySelector('.policy-card') || document.querySelector('footer') || document.body).append(settings);
  }

  window.plpTrack = event => {
    if (events.has(event)) send(event);
  };
  window.addEventListener('storage', event => {
    if (!consentStorage || event.storageArea !== consentStorage || (event.key !== consentKey && event.key !== null)) return;
    applyConsent(event.newValue);
  });
  window.addEventListener('plp:navigation', recordPage);
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href], [data-plp-track]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (link.dataset.plpTrack) window.plpTrack(link.dataset.plpTrack);
    else if (href.startsWith('mailto:')) window.plpTrack('click_email');
    else if (href.startsWith('tel:')) window.plpTrack('click_phone');
    else if (href === '/booking' || href.startsWith('/booking?room=')) window.plpTrack('click_reserve');
  }, true);

  if (!publicPath()) return;
  fetch('/api/plp?action=analytics-config', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(options => {
      if (!publicPath()) return;
      config = options || {};
      addSettings();
      lastPath = null;
      recordPage();
    })
    .catch(() => {
      // First-party anonymous analytics still require an affirmative choice,
      // but the page remains usable even if external config is unreachable.
      if (!publicPath()) return;
      config = {};
      addSettings();
      lastPath = null;
      recordPage();
    });
})();
