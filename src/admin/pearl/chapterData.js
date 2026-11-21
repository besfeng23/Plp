// References point to the exact project versions used to prepare this working file.
const boracay = 'https://github.com/besfeng23/Plp/blob/6c3699f6a77c21bd669d4fad85c21538c4965fae/';
const changi = 'https://github.com/besfeng23/cbc/blob/0fb782d49c0133b01b531b042639815077b9a2fe/index.html';
export const sources = {
  brand: boracay + 'docs/plp-editorial-brand.md',
  club: boracay + 'src/ClubView.jsx',
  application: boracay + 'src/ClubApplyForm.jsx',
  residential: boracay + 'src/SeniorLivingView.jsx',
  programme: boracay + 'docs/plp-club-boracay.md',
  changi,
};

export const chapters = {
  boracay: { name: 'Boracay', country: 'Philippines', type: 'First chapter', timeZone: 'Asia/Manila',
    brief: 'Prepare the senior membership programme, review applications and plan the first activities.',
    venue: 'Pueblo La Perla Boracay', source: sources.club },
  singapore: { name: 'Singapore', country: 'Singapore', type: 'Expansion', timeZone: 'Asia/Singapore',
    brief: 'Develop the Changi proposal. Venue permission, facility access and local programme terms await verification.',
    venue: 'Changi Beach Club · proposed', source: sources.changi },
  malaysia: { name: 'Malaysia', country: 'Malaysia', type: 'Expansion', timeZone: 'Asia/Kuala_Lumpur',
    brief: 'Scope a future chapter. A location and operating partner have yet to be identified.',
    venue: '', source: sources.programme },
};

export const states = ['Ready', 'Needs decision', 'Needs verification'];
export const checkGroups = ['Requirements', 'Content & imagery', 'Partners & suppliers'];

function entry(id, group, title, detail, state, evidence = '', extra = {}) {
  return { id, group, title, detail, state, evidence, ...extra };
}

function commonChecks() {
  return [
    entry('tier-terms', 'Requirements', 'Membership tiers and benefits', 'Decide the tier names, inclusions, exclusions and any companion privileges.', 'Needs decision'),
    entry('offer-terms', 'Requirements', 'Pricing and offer terms', 'Decide the fee, currency, billing interval, term, renewal and refund conditions for each offer.', 'Needs decision'),
    entry('activities', 'Requirements', 'First activity and calendar', 'Verify the facilitator, venue, capacity, access arrangements and date before offering a session.', 'Needs verification'),
    entry('privacy', 'Requirements', 'Consent and record handling', 'Review chapter-specific consent, access, retention and follow-up arrangements.', 'Needs verification'),
    entry('photography', 'Content & imagery', 'Activity photography and usage rights', 'Record the asset, permission to use it, participant consent where applicable, and descriptive alt text.', 'Needs verification'),
    entry('facilitator', 'Partners & suppliers', 'Activity facilitator', 'Identify a facilitator and verify their remit, availability and written terms.', 'Needs verification', '', { kind: 'Activity operator' }),
  ];
}

const initialChecks = {
  boracay: [
    entry('chapter', 'Requirements', 'First chapter and audience', 'The Boracay project identifies Pearl Club as a membership community for adults aged 60 and above.', 'Ready', sources.club),
    entry('intake', 'Requirements', 'Application review pathway', 'The Boracay application design collects a 60+ declaration and contact consent, then sends the application for staff review.', 'Ready', sources.application),
    entry('admission', 'Requirements', 'Separate residential admission', 'The proposed residential pathway requires a separate decision after membership approval. Medical and accommodation offers remain unverified.', 'Ready', sources.residential),
    entry('identity', 'Content & imagery', 'PLP oval crest', 'The brand pack specifies the master oval for ivory and the reversed crest for dark backgrounds.', 'Ready', sources.brand,
      { asset: 'public/brand/PLP_Editorial_Vector_Logo.svg', alt: 'Pueblo La Perla oval monogram' }),
    entry('application-copy', 'Content & imagery', 'Membership invitation and offer copy', 'Review final benefits and terms before using them in member-facing material.', 'Needs decision'),
    ...commonChecks(),
  ],
  singapore: [
    entry('direction', 'Requirements', 'Changi planning reference', 'The Changi project identifies Changi Beach Club as the proposed setting for a Singapore chapter.', 'Ready', sources.changi),
    entry('separate', 'Requirements', 'Separate club programmes', 'Changi Beach Club controls its own memberships. Pearl Club benefits and access require a separate agreement.', 'Ready', sources.changi),
    entry('venue', 'Partners & suppliers', 'Changi Beach Club venue permission', 'Obtain written confirmation of venue use, facility access and permitted wording.', 'Needs verification', '',
      { kind: 'Proposed venue', organisation: 'Changi Beach Club' }),
    entry('entry', 'Requirements', 'Local eligibility and application terms', 'Decide the local admission criteria and review process before opening intake.', 'Needs decision'),
    entry('assets', 'Content & imagery', 'Changi venue imagery', 'Verify original venue photography and reuse permission for each image.', 'Needs verification'),
    ...commonChecks(),
  ],
  malaysia: [
    entry('direction', 'Requirements', 'Expansion planning scope', 'The existing chapter plan identifies Malaysia as a future expansion location.', 'Ready', sources.programme),
    entry('venue', 'Requirements', 'Location selection', 'Identify the city and venue for owner review.', 'Needs decision'),
    entry('operator', 'Partners & suppliers', 'Local venue and operator', 'Verify the counterparty, venue authority and scope after a site has been selected.', 'Needs verification'),
    entry('entry', 'Requirements', 'Local eligibility and application terms', 'Decide the local entry criteria, review process and consent terms.', 'Needs decision'),
    entry('assets', 'Content & imagery', 'Local chapter identity and imagery', 'Collect site-specific copy and cleared photography once a venue is identified.', 'Needs verification'),
    ...commonChecks(),
  ],
};

export function initialBook() {
  const locations = {};
  for (const id of Object.keys(chapters)) {
    locations[id] = { checks: initialChecks[id].map(item => ({ ...item })), offers: [], members: [], events: [], attendance: [], enquiries: [] };
  }
  return { format: 'plp-pearl-owner', version: 1, locations };
}
