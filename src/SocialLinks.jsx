import React from 'react';
import { SOCIAL_ICON_PATHS, socialProfiles } from '../lib/social.js';

// Official social accounts as bronze outline icons. Only confirmed profiles render.
export default function SocialLinks({ className = '' }) {
  const profiles = socialProfiles();
  if (!profiles.length) return null;
  return <nav className={'plp-social ' + className} aria-label="Official social accounts">{profiles.map(p => <a key={p.key} href={p.url} target="_blank" rel="noopener noreferrer me" aria-label={'Pueblo La Perla on ' + p.label}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: SOCIAL_ICON_PATHS[p.key] }} />
  </a>)}</nav>;
}
