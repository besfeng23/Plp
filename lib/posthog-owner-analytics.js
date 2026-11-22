import { monthBounds } from './owner-month.js';

const POSTHOG_PROJECT_ID = 526760;
const POSTHOG_API = 'https://us.i.posthog.com/api/projects/' + POSTHOG_PROJECT_ID + '/query/';
const EPOCH = "toDateTime('1970-01-02 00:00:00')";

function sqlDate(value) {
  return new Date(value).toISOString().slice(0,19).replace('T',' ');
}
export function buildPostHogOwnerQuery(month) {
  const bounds = monthBounds(month);
  if (!bounds) throw new TypeError('Invalid reporting month');
  const start = sqlDate(bounds.start), end = sqlDate(bounds.end);
  return `WITH
    base AS (
      SELECT event, distinct_id, timestamp, properties
      FROM events
      WHERE timestamp >= toDateTime('${start}')
        AND timestamp < toDateTime('${end}')
        AND (properties.$pathname IS NULL OR
          (properties.$pathname NOT LIKE '/admin%' AND properties.$pathname NOT LIKE '/owner%'))
    ),
    funnel AS (
      SELECT distinct_id,
        minIf(timestamp, event = 'booking_interest') AS interest_at,
        minIf(timestamp, event = 'start_booking') AS start_at,
        minIf(timestamp, event = 'submit_booking') AS submit_at,
        minIf(timestamp, event = 'booking_created') AS created_at
      FROM base
      WHERE event IN ('booking_interest','start_booking','submit_booking','booking_created')
      GROUP BY distinct_id
    )
    SELECT 'summary' AS section, 'pageViews' AS metric, toString(countIf(event = '$pageview')) AS value, '' AS label FROM base
    UNION ALL SELECT 'summary','uniqueVisitors',toString(uniqExactIf(distinct_id,event = '$pageview')),'' FROM base
    UNION ALL SELECT 'summary','sessions',toString(uniqExactIf(properties.$session_id,event = '$pageview' AND properties.$session_id != '')),'' FROM base
    UNION ALL SELECT 'summary','autocaptureClicks',toString(countIf(event = '$autocapture')),'' FROM base
    UNION ALL SELECT 'summary','bookingInterest',toString(countIf(event = 'booking_interest')),'' FROM base
    UNION ALL
      SELECT 'pages','top',toString(n),path FROM (
        SELECT coalesce(nullIf(properties.$pathname,''),'/') AS path, count() AS n
        FROM base WHERE event = '$pageview' GROUP BY path ORDER BY n DESC LIMIT 10
      )
    UNION ALL
      SELECT 'referrers','top',toString(n),referrer FROM (
        SELECT coalesce(nullIf(properties.$referring_domain,''),nullIf(properties.$referrer,''),'Direct / unknown') AS referrer,
          count() AS n FROM base WHERE event = '$pageview' GROUP BY referrer ORDER BY n DESC LIMIT 10
      )
    UNION ALL
      SELECT 'countries','top',toString(n),country FROM (
        SELECT coalesce(nullIf(properties.$geoip_country_name,''),'Not available') AS country,
          count() AS n FROM base WHERE event = '$pageview' GROUP BY country ORDER BY n DESC LIMIT 10
      )
    UNION ALL
      SELECT 'devices','top',toString(n),device FROM (
        SELECT coalesce(nullIf(properties.$device_type,''),'Unknown') AS device,
          count() AS n FROM base WHERE event = '$pageview' GROUP BY device ORDER BY n DESC LIMIT 10
      )
    UNION ALL SELECT 'funnel','interest',toString(countIf(interest_at > ${EPOCH})),'' FROM funnel
    UNION ALL SELECT 'funnel','started',toString(countIf(interest_at > ${EPOCH} AND start_at > interest_at)),'' FROM funnel
    UNION ALL SELECT 'funnel','submitted',toString(countIf(interest_at > ${EPOCH} AND start_at > interest_at AND submit_at > start_at)),'' FROM funnel
    UNION ALL SELECT 'funnel','created',toString(countIf(interest_at > ${EPOCH} AND start_at > interest_at AND submit_at > start_at AND created_at > submit_at)),'' FROM funnel`;
}
function count(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}
function label(value) {
  return String(value || '').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,120) || 'Unknown';
}
export function parsePostHogOwnerRows(rows) {
  if (!Array.isArray(rows)) throw new Error('Unexpected PostHog query result');
  const metrics = { pageViews:0, uniqueVisitors:0, sessions:0, autocaptureClicks:0, bookingInterest:0 };
  const funnel = { interest:0, started:0, submitted:0, created:0 };
  const lists = { pages:[], referrers:[], countries:[], devices:[] };
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const [section,metric,value,name] = row;
    if (section === 'summary' && Object.hasOwn(metrics,metric)) metrics[metric] = count(value);
    else if (section === 'funnel' && Object.hasOwn(funnel,metric)) funnel[metric] = count(value);
    else if (Object.hasOwn(lists,section) && metric === 'top') lists[section].push({label:label(name),value:count(value)});
  }
  return {metrics,funnel,...lists};
}
export async function posthogOwnerAnalytics(month, env = process.env, fetcher = fetch) {
  const key = typeof env.POSTHOG_PERSONAL_API_KEY === 'string' ? env.POSTHOG_PERSONAL_API_KEY.trim() : '';
  if (!key) return { status:'not_connected', message:'A PostHog personal API key is not configured on the server.' };
  const query = buildPostHogOwnerQuery(month);
  try {
    const response = await fetcher(POSTHOG_API,{
      method:'POST',
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify({query:{kind:'HogQLQuery',query}}),
      cache:'no-store',
      signal:AbortSignal.timeout(9000),
    });
    if (response.status === 401 || response.status === 403) return {status:'not_connected',message:'The PostHog personal API key is missing query access or is invalid.'};
    if (response.status === 429) return {status:'unavailable',message:'PostHog query budget is temporarily unavailable.'};
    if (!response.ok) return {status:'unavailable',message:'PostHog did not return a complete report.'};
    const body = await response.json();
    if (body?.error || !Array.isArray(body?.results)) return {status:'unavailable',message:'PostHog did not return a complete report.'};
    return {status:'connected',...parsePostHogOwnerRows(body.results),projectId:POSTHOG_PROJECT_ID,month,source:'posthog'};
  } catch {
    return {status:'unavailable',message:'PostHog query service is temporarily unavailable.'};
  }
}
