import posthog from 'posthog-js';

const allowedEvents = new Set([
  '$pageview', '$autocapture', '$web_vitals',
  'click_reserve', 'booking_interest', 'click_email', 'click_phone',
  'select_room', 'start_booking', 'submit_booking', 'booking_created',
  'submit_enquiry', 'submit_club_enquiry', 'submit_residential_interest',
]);
const publicPaths = new Set([
  '/', '/accommodation', '/accommodations', '/accommodation/grand-ocean-villa',
  '/accommodation/sunset-suite', '/accommodation/smart-room-premium', '/experiences',
  '/club', '/senior-living', '/gallery', '/getting-here', '/booking', '/contact',
  '/exclusive-offer', '/reservation-policy', '/privacy-policy', '/terms-of-service',
  '/private-villas-boracay', '/boracay-villa-with-private-pool',
  '/boracay-family-villa', '/boracay-wellness-stay', '/high-boracay-location',
]);
const safeProperties = new Set([
  '$pathname', '$current_url', '$referrer', '$referring_domain', '$session_id',
  '$device_type', '$browser', '$browser_version', '$os', '$lib', '$lib_version',
  '$geoip_country_name', '$geoip_country_code', '$event_type',
  'metric_name', 'metric_value', 'metric_delta', 'metric_rating', 'metric_id',
  'navigation_type',
]);
const privateRoute = /^\/(?:admin|owner)(?:\/|$)/i;

function safePath(value) {
  let path = '';
  try {
    if (typeof value === 'string' && value.startsWith('/')) path = new URL(value, window.location.origin).pathname;
    else if (typeof value === 'string') path = new URL(value).pathname;
    else path = window.location.pathname;
  } catch { return null; }
  if (privateRoute.test(path) || !publicPaths.has(path)) return null;
  return path;
}
function safeReferrer(value) {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : undefined;
  } catch { return undefined; }
}
function safeElementsChain(value) {
  if (typeof value !== 'string') return undefined;
  try {
    const chain = JSON.parse(value);
    if (!Array.isArray(chain)) return undefined;
    return JSON.stringify(chain.slice(0, 8).map(item => ({
      tag_name: typeof item?.tag_name === 'string' ? item.tag_name.slice(0, 16) : '',
      nth_child: Number.isInteger(item?.nth_child) ? item.nth_child : undefined,
    })));
  } catch { return undefined; }
}

export function initializePostHog({ token, host }) {
  if (typeof token !== 'string' || !/^phc_[A-Za-z0-9_-]+$/.test(token) ||
      typeof host !== 'string' || !['/ingest', 'https://us.i.posthog.com'].includes(host)) return null;
  return posthog.init(token, {
    api_host: host,
    defaults: '2026-08-30',
    autocapture: {
      url_allowlist: [/^https:\/\/plp-boracay\.vercel\.app\/(?!admin(?:\/|$)|owner(?:\/|$))/i],
      dom_event_allowlist: ['click'],
      element_allowlist: ['a', 'button'],
      css_selector_ignorelist: [
        '.ph-no-autocapture', '[data-ph-no-autocapture]',
        'form', 'input', 'textarea', 'select', '[data-sensitive]',
      ],
    },
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_performance: true,
    disable_session_recording: true,
    session_recording: {
      maskAllInputs: true,
      urlBlocklist: ['/admin', '/admin/*', '/owner', '/owner/*'],
    },
    disable_surveys: true,
    advanced_disable_flags: true,
    disable_external_dependency_loading: true,
    person_profiles: 'never',
    persistence: 'localStorage+cookie',
    ip: false,
    before_send(event) {
      if (!event || !allowedEvents.has(event.event)) return null;
      const original = event.properties || {};
      const path = safePath(original.$pathname || original.$current_url || window.location.pathname);
      if (!path) return null;
      const properties = {};
      for (const [key, value] of Object.entries(original)) {
        if (!safeProperties.has(key)) continue;
        if (key === '$referrer') {
          const safe = safeReferrer(value);
          if (safe) properties[key] = safe;
        } else if (key === '$current_url') {
          properties[key] = window.location.origin + path;
        } else if (key === '$pathname') {
          properties[key] = path;
        } else if (typeof value === 'string') {
          properties[key] = value.slice(0, 180);
        } else if (typeof value === 'number' && Number.isFinite(value)) {
          properties[key] = value;
        }
      }
      properties.$pathname = path;
      properties.$current_url = window.location.origin + path;
      if (event.event === '$autocapture') {
        const chain = safeElementsChain(original.$elements_chain);
        if (chain) properties.$elements_chain = chain;
      }
      return { ...event, properties };
    },
  });
}
