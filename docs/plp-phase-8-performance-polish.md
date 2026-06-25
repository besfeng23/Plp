# PLP Phase 8 Performance and Technical Polish

Phase 8 focuses on making the PLP public experience feel fast, calm, and premium.

A luxury resort website should not feel heavy. It should load with confidence, reveal imagery smoothly, and avoid making the guest wait for unnecessary media.

## Implemented changes

### Lazy-loaded resort video

The homepage atmosphere video now waits until the video section is near the viewport before the video source is attached.

Before this phase, the video element existed immediately in the page. After this phase, the poster image appears first and the video loads only when needed.

This improves initial load and reduces unnecessary bandwidth on guests who do not scroll to the video section.

### Poster-first media behavior

The video section now shows a poster image first. This protects the layout and keeps the page visually complete while the video is deferred.

### Homepage resource hints

The main HTML now includes:

- preconnect for Google Fonts
- preload for the main PLP aerial hero image

This helps the browser prepare critical resources earlier.

### Static asset caching

Vercel cache headers were added for:

- `/images/*`
- `/videos/*`
- `/assets/*`

These are marked as long-lived immutable assets so repeat visits and returning guests feel faster.

## Performance targets

Target Core Web Vitals:

- LCP under 2.5 seconds
- CLS under 0.1
- INP under 200ms

Target Lighthouse scores:

- Performance: 85+
- Accessibility: 90+
- SEO: 90+
- Best Practices: 90+

## Remaining performance work

### Image pipeline

The next real performance jump requires replacing large JPEGs with optimized WebP or AVIF files.

Recommended future assets:

- hero image under 250 KB where possible
- room thumbnails under 120 KB
- gallery images under 250 KB
- responsive variants for mobile and desktop

### Font pipeline

Google Fonts are still loaded externally. The best final version is to self-host only the used font weights.

Recommended font weights:

- Cormorant Garamond 400 and 500
- Inter 400, 500, 700

### Static page consolidation

Some standalone pages contain inline CSS. This is acceptable for fast deployment, but long-term maintainability and caching would improve if shared static CSS is extracted.

### Full Lighthouse pass

A final Lighthouse pass should be performed after production deploy on:

- homepage
- booking
- accommodation
- experiences
- reservation policy

## Acceptance criteria

Phase 8 is complete when:

- homepage video does not load immediately on first paint
- poster image preserves layout before video load
- key hero image is preloaded
- font origins are preconnected
- images, videos, and built assets have cache headers
- remaining performance work is documented clearly
