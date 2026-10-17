(() => {
  const doc = document.documentElement;
  const path = window.location.pathname || '/';
  const isExcluded = path === '/subscribe' ||
    path.startsWith('/subscribe/') ||
    path.startsWith('/api/') ||
    path.startsWith('/admin') ||
    path.startsWith('/tg') ||
    path.startsWith('/telegram');
  if (isExcluded) {
    doc.classList.remove('plp-subscription-checking');
    return;
  }

  doc.classList.add('plp-subscription-checking');

  const returnPath = () => {
    const value = window.location.pathname + window.location.search + window.location.hash;
    return value.length > 600 ? '/' : value;
  };

  const goToSubscribe = (error) => {
    const target = new URL('/subscribe', window.location.origin);
    target.searchParams.set('next', returnPath());
    if (error) target.searchParams.set('error', error);
    window.location.replace(target.toString());
  };

  const checkStatus = async (initial = false) => {
    try {
      const response = await fetch('/api/subscription/status', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.active === true) {
        doc.classList.remove('plp-subscription-checking');
        window.dispatchEvent(new CustomEvent('plp:subscription-verified', { detail: data }));
        return;
      }
      goToSubscribe(response.status === 503 ? 'verification_unavailable' : '');
    } catch {
      goToSubscribe('verification_unavailable');
    }
  };

  checkStatus(true);
  // Keep an open SPA from remaining unlocked indefinitely if a subscription
  // is cancelled or PayPal suspends it. Page reloads check status as well.
  window.setInterval(() => {
    if (document.visibilityState === 'visible') checkStatus(false);
  }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkStatus(false);
  });
})();
