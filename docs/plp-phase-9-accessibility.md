# PLP Phase 9 Accessibility and Premium Readability

Phase 9 improves accessibility while preserving the quiet luxury feel of the site.

## Implemented changes

- stronger readable color overrides
- stronger keyboard focus state
- skip link support on the main app shell
- reduced motion CSS support
- hidden video presentation for reduced-motion users
- booking page skip link to the reservation form
- live availability announcements
- assertive booking status announcements
- room selection group label
- selected room state exposed through aria-pressed
- room buttons labelled with room type, capacity, and rate
- review summary updates announced politely
- submit button connected to reservation note and status text

## Acceptance criteria

Phase 9 is complete when:

- keyboard users can see focus state
- users can skip navigation
- booking errors and availability updates are announced
- room card selection is not visual-only
- reduced-motion users are respected
- important text has stronger contrast
- mobile form fields remain readable

## Manual QA still recommended

Check with:

- keyboard-only navigation
- iPhone VoiceOver
- Android TalkBack
- browser zoom at 200 percent
- reduced-motion OS setting
- high brightness outdoor phone conditions

Pages to review:

- homepage
- booking
- accommodation
- experiences
- reservation policy
- privacy
- terms
