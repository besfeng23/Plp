# PLP Phase 12 Content Management

Phase 12 adds a lightweight staff content workflow for Pueblo La Perla.

## Implemented

- Public content API: `/api/content`
- Staff content API: `/api/admin/content`
- Staff content page: `/content-ops.html`
- Supabase SQL setup: `docs/plp-phase-12-content-management.sql`

## What staff can manage

The system is designed for structured site content such as:

- homepage copy
- room names and rates
- room capacity and bedroom counts
- experience copy
- policy notes
- testimonials
- gallery references
- seasonal messages

## Staff page

The content page allows staff to:

- enter the PLP staff code
- load existing content sections
- edit JSON content
- choose DRAFT, PUBLISHED, or ARCHIVED
- save through the protected API
- format JSON before saving

## Public content behavior

The public API returns published content from Supabase when available.

If Supabase is not ready, or the content table is missing, it returns safe default content so the website does not break.

## Database step

Run the SQL file in Supabase before using the staff page:

`docs/plp-phase-12-content-management.sql`

This creates the `plp_site_content` table, indexes, RLS, and starter content rows.

## Limitation

This phase creates the content management foundation.

A later integration pass should connect homepage, booking, accommodation, and experience pages directly to `/api/content` so published content updates appear automatically on the public site.
