import { isSupabaseConfigured, selectRows } from './_supabase.js';

const DEFAULT_CONTENT = {
  homepage: {
    heroTitle: 'Pueblo La Perla',
    heroSubtitle: 'A private hillside retreat above Boracay’s white sands.',
    primaryCta: 'Reserve your stay'
  },
  accommodation: {
    grandOceanVilla: {
      name: 'Grand Ocean Villa',
      rate: 40000,
      capacity: 8,
      bedrooms: 4
    },
    sunsetSuite: {
      name: 'Sunset Suite',
      rate: 18000,
      capacity: 4,
      bedrooms: 2
    },
    smartRoomPremium: {
      name: 'Smart Room Premium',
      rate: 8000,
      capacity: 2,
      bedrooms: 1
    }
  },
  experiences: {
    water: 'Paraw sailing, island hopping, snorkeling, and curated water activities.',
    wellness: 'Quiet recovery days and rest-focused island rhythm.',
    privateDining: 'Sunset dinners, in-villa meals, and intimate celebration arrangements.'
  },
  policies: {
    reservationNote: 'Final confirmation follows availability review and reservation completion.'
  }
};

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.end(JSON.stringify(payload));
}

function cleanSection(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 80);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const section = cleanSection(req.query?.section || '');

  if (!isSupabaseConfigured()) {
    if (section) return json(res, 200, { section, content: DEFAULT_CONTENT[section] || null, source: 'default' });
    return json(res, 200, { content: DEFAULT_CONTENT, source: 'default' });
  }

  try {
    const query = section
      ? `section=eq.${encodeURIComponent(section)}&status=eq.PUBLISHED&select=section,content,updated_at&limit=1`
      : 'status=eq.PUBLISHED&select=section,content,updated_at&order=section.asc';
    const rows = await selectRows('plp_site_content', query);

    if (section) {
      return json(res, 200, {
        section,
        content: rows?.[0]?.content || DEFAULT_CONTENT[section] || null,
        source: rows?.[0] ? 'database' : 'default'
      });
    }

    const content = { ...DEFAULT_CONTENT };
    for (const row of rows || []) content[row.section] = row.content;
    return json(res, 200, { content, source: rows?.length ? 'database' : 'default' });
  } catch (error) {
    if (section) return json(res, 200, { section, content: DEFAULT_CONTENT[section] || null, source: 'default', warning: 'content_table_unavailable' });
    return json(res, 200, { content: DEFAULT_CONTENT, source: 'default', warning: 'content_table_unavailable' });
  }
}
