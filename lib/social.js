// Official PLP social profiles, rendered from lib/site-config.js only.
// A profile without a confirmed https URL on its own platform is never linked.
import { SITE } from './site-config.js';

export const SOCIAL_LABELS = Object.freeze({ facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' });
const HOSTS = { facebook: /^https:\/\/www\.facebook\.com\/[A-Za-z0-9.]+\/?$/, instagram: /^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]+\/?$/, tiktok: /^https:\/\/www\.tiktok\.com\/@[A-Za-z0-9._]+\/?$/ };

// Bronze outline icons (24px grid, stroke only) matching the PLP icon style.
export const SOCIAL_ICON_PATHS = Object.freeze({
  facebook: '<path d="M14.5 8H17V4.5h-2.5A4 4 0 0 0 10.5 8.5V11H8v3.5h2.5V21H14v-6.5h2.6l.6-3.5H14V8.9c0-.5.4-.9.5-.9z"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6"/>',
  tiktok: '<path d="M14 3.5v11.3a3.6 3.6 0 1 1-3.6-3.6"/><path d="M14 3.5c.4 2.6 2.4 4.6 5 4.8"/>',
});

export function socialProfiles(site = SITE) {
  return Object.entries(site.social || {})
    .filter(([key, url]) => HOSTS[key] && typeof url === 'string' && HOSTS[key].test(url))
    .map(([key, url]) => ({ key, url, label: SOCIAL_LABELS[key] }));
}

export function socialIconSvg(key, size = 20) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${SOCIAL_ICON_PATHS[key] || ''}</svg>`;
}

export function socialLinksHtml(site = SITE) {
  // Inline styles so the links render correctly on every static page, with or without the shared stylesheet.
  const link = 'display:inline-grid;place-items:center;width:44px;height:44px;border:1px solid rgba(138,109,59,.55);border-radius:50%;color:#8a6d3b;text-decoration:none';
  const links = socialProfiles(site).map(p => `<a href="${p.url}" target="_blank" rel="noopener noreferrer me" aria-label="Pueblo La Perla on ${p.label}" style="${link}">${socialIconSvg(p.key)}</a>`).join('');
  return links ? `<nav class="plp-social" data-plp-social="true" aria-label="Official social accounts" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;margin:14px 0 4px">${links}</nav>` : '';
}
