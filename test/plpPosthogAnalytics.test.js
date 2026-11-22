import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPostHogOwnerQuery, posthogOwnerAnalytics } from '../lib/posthog-owner-analytics.js';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('PostHog query is scoped to the selected Boracay-local month and excludes private routes',()=>{
 const query=buildPostHogOwnerQuery('2026-11');
 assert.match(query,/timestamp >= toDateTime\('2026-10-31 16:00:00'\)/);
 assert.match(query,/timestamp < toDateTime\('2026-11-30 16:00:00'\)/);
 assert.match(query,/properties\.\$pathname NOT LIKE '\/admin%'/);
 assert.match(query,/properties\.\$pathname NOT LIKE '\/owner%'/);
 assert.match(query,/uniqExactIf\(distinct_id,event = '\$pageview'\)/);
 assert.match(query,/properties\.\$session_id/);
 assert.match(query,/booking_interest/);assert.match(query,/start_booking/);
 assert.match(query,/submit_booking/);assert.match(query,/booking_created/);
 assert.throws(()=>buildPostHogOwnerQuery('November 2026'),TypeError);
});
test('missing personal API key returns an honest not-connected state without a request',async()=>{
 let calls=0;const result=await posthogOwnerAnalytics('2026-11',{},async()=>{calls++;throw new Error('must not run')});
 assert.equal(result.status,'not_connected');assert.equal(calls,0);
 assert.doesNotMatch(JSON.stringify(result),/phx_|personal.?key.{10,}/i);
});
test('PostHog query uses a server-only bearer key and returns aggregate results',async()=>{
 let request;
 const result=await posthogOwnerAnalytics('2026-11',{POSTHOG_PERSONAL_API_KEY:'test-secret-key'},async(url,options)=>{
  request={url,options};return {ok:true,status:200,json:async()=>({results:[
   ['summary','pageViews','120',''],['summary','uniqueVisitors','42',''],['summary','sessions','57',''],
   ['summary','autocaptureClicks','90',''],['summary','bookingInterest','12',''],
   ['pages','top','30','/'],['referrers','top','14','google.com'],['countries','top','20','Philippines'],
   ['devices','top','31','mobile'],['funnel','interest','12',''],['funnel','started','8',''],
   ['funnel','submitted','4',''],['funnel','created','3',''],
  ]})};
 });
 assert.equal(request.url,'https://us.i.posthog.com/api/projects/526760/query/');
 assert.equal(request.options.headers.Authorization,'Bearer test-secret-key');
 assert.equal(result.status,'connected');assert.equal(result.metrics.uniqueVisitors,42);
 assert.equal(result.metrics.sessions,57);assert.equal(result.topPages[0].label,'/');
 assert.equal(result.referrers[0].label,'google.com');assert.equal(result.countries[0].label,'Philippines');
 assert.equal(result.funnel.created,3);assert.doesNotMatch(JSON.stringify(result),/test-secret-key/);
});
test('invalid key and rate-limit states do not expose upstream response bodies',async()=>{
 const denied=await posthogOwnerAnalytics('2026-11',{POSTHOG_PERSONAL_API_KEY:'x'},async()=>({ok:false,status:403,json:async()=>({secret:'never expose'})}));
 assert.equal(denied.status,'not_connected');assert.doesNotMatch(JSON.stringify(denied),/never expose/);
 const limited=await posthogOwnerAnalytics('2026-11',{POSTHOG_PERSONAL_API_KEY:'x'},async()=>({ok:false,status:429}));
 assert.equal(limited.status,'unavailable');
});
test('public capture is consent gated, private routes are blocked, inputs and replay stay masked',()=>{
 const sdk=read('src/plp-posthog.js'),tracker=read('public/analytics.js'),admin=read('admin.html'),owner=read('owner.html');
 assert.match(tracker,/plp_analytics_consent_v2/);assert.match(tracker,/consent !== 'allow'/);
 assert.match(tracker,/client\.capture\('booking_interest'/);assert.match(sdk,/autocapture: \{/);
 assert.match(sdk,/element_allowlist: \['a', 'button'\]/);assert.match(sdk,/capture_performance: true/);
 assert.match(sdk,/disable_session_recording: true/);assert.match(sdk,/maskAllInputs: true/);
 assert.match(sdk,/privateRoute/);assert.doesNotMatch(admin,/analytics\.js/);assert.doesNotMatch(owner,/analytics\.js/);
});
