import posthog from 'posthog-js';

const allowedEvents = new Set(['$pageview', 'click_reserve', 'click_email', 'click_phone', 'select_room', 'start_booking', 'submit_booking']);
const allowedProperties = [
  '$current_url', '$pathname', 'distinct_id', '$device_id', '$session_id',
  '$browser', '$browser_version', '$os', '$device_type', '$screen_height', '$screen_width',
  '$viewport_height', '$viewport_width', '$lib', '$lib_version', 'token',
];

export function initializePostHog({ token, host }) {
  return posthog.init(token, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_flags: true,
    disable_external_dependency_loading: true,
    person_profiles: 'never',
    persistence: 'memory',
    ip: false,
    before_send(event) {
      if (!event || !allowedEvents.has(event.event)) return null;
      const properties = Object.fromEntries(Object.entries(event.properties).filter(([key]) => allowedProperties.includes(key)));
      return { ...event, properties };
    },
  });
}
