-- PLP Phase 14 Dynamic Content Schema
-- Run after docs/plp-phase-12-content-management.sql.
-- This enriches staff-editable published content without deleting existing sections.

insert into public.plp_site_content (section, status, content, updated_by, updated_at)
values
  ('homepage', 'PUBLISHED', '{
    "heroTitle": "Pueblo La Perla",
    "heroSubtitle": "A private hillside retreat above Boracay’s white sands.",
    "primaryCta": "Reserve your stay"
  }'::jsonb, 'phase-14', now()),
  ('accommodation', 'PUBLISHED', '{
    "grandOceanVilla": {
      "name": "Grand Ocean Villa",
      "rate": 300,
      "capacity": 8,
      "bedrooms": 4,
      "type": "Signature Villa",
      "bestForShort": "Groups",
      "bestFor": "Families, private groups, longer stays, and guests who want generous living space with a private villa rhythm.",
      "description": "A private hillside villa for families, long stays, and discreet gatherings. The villa is designed around space, pool atmosphere, and the quiet distance of High Boracay.",
      "arrangements": ["Airport and port transfer coordination", "In-villa dining and celebrations", "Water activities and wellness rituals"]
    },
    "sunsetSuite": {
      "name": "Sunset Suite",
      "rate": 200,
      "capacity": 4,
      "bedrooms": 2,
      "type": "Elevated Suite",
      "bestForShort": "Couples",
      "bestFor": "Couples, small families, and guests who want a quieter stay close to Boracay’s center.",
      "description": "A refined retreat for guests who want privacy, ease, and a quieter Boracay stay without feeling removed from the island.",
      "arrangements": ["Sunset dining reservations", "Wellness schedule requests", "Port timing and local transfer support"]
    },
    "smartRoomPremium": {
      "name": "Smart Room Premium",
      "rate": 100,
      "capacity": 2,
      "bedrooms": 1,
      "type": "Premium Room",
      "bestForShort": "Short stay",
      "bestFor": "Couples, solo travelers, work-friendly island trips, and guests who want a quiet premium room instead of a full villa.",
      "description": "A calm modern base for short stays, couples, solo travelers, and guests who want comfort, intelligent controls, and easy access to the island.",
      "arrangements": ["Arrival support", "Wellness requests", "Island activity coordination"]
    }
  }'::jsonb, 'phase-14', now()),
  ('experiences', 'PUBLISHED', '{
    "water": "Paraw sailing, island hopping, snorkeling, and curated water activities.",
    "waterItems": ["Paraw sailing", "Island hopping", "Snorkeling and dive preparation", "Jet ski and water activity coordination", "Private boat timing where available"],
    "wellness": "Quiet recovery days and rest-focused island rhythm.",
    "wellnessItems": ["Quiet recovery days", "Long-stay wellness rhythm", "Slow mornings", "Private rituals around arrival or departure"],
    "privateDining": "Sunset dinners, in-villa meals, and intimate celebration arrangements.",
    "privateDiningItems": ["Sunset dinner coordination", "In-villa dining", "Local seafood and island dining suggestions", "Celebration setups", "Family meal arrangements"]
  }'::jsonb, 'phase-14', now()),
  ('policies', 'PUBLISHED', '{
    "reservationNote": "A reservation hold may be requested only after your booking reference is created. Final confirmation is issued by the PLP team after review."
  }'::jsonb, 'phase-14', now())
on conflict (section) do update
set
  status = excluded.status,
  content = excluded.content,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at;
