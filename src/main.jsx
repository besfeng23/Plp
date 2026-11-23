import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App.jsx';
import './index.css';
import { CONCIERGE_EMAIL } from '../lib/contact.js';

// The static loading/fallback shell remains usable until React actually mounts.
function RevealMountedApp() {
  React.useLayoutEffect(() => {
    // Some return pages use a div for their main view, but App always renders
    // its footer. The error boundary uses a standalone main instead.
    if (document.getElementById('root')?.querySelector('main, footer')) {
      document.documentElement.classList.add('plp-app-ready');
    }
  }, []);
  return null;
}

class PublicAppBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <main id="main-content" className="min-h-screen bg-[#FAFAF7] px-6 py-32 text-center text-[#1A1A1A]">
        <h1 className="mb-6 font-serif text-4xl">We could not open this page.</h1>
        <p className="mx-auto mb-8 max-w-lg text-base leading-7">Please try again, or speak with the Pueblo La Perla concierge about your stay.</p>
        <a className="inline-flex min-h-12 items-center border-b border-[#1A1A1A]" href={'mailto:' + CONCIERGE_EMAIL}>Contact concierge</a>
      </main>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PublicAppBoundary><App /></PublicAppBoundary>
    <RevealMountedApp />
    <Analytics />
  </React.StrictMode>
);
