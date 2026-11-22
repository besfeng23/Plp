import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeWebsiteBehavior,websiteBehaviorReport} from '../lib/owner-behavior.js';
import adminHandler from '../api/admin.js';
const r=(event_name,page_path,created_at='2026-11-01T11:00:00Z')=>({event_name,page_path,created_at});
test('anonymized website counts group local days and reject other pages and months',()=>{
 const x=summarizeWebsiteBehavior([
   r('view_page','/club','2026-10-31T16:00:00Z'),
   r('view_page','/club'),r('click_reserve','/club'),r('submit_club_enquiry','/club'),
   r('booking_created','/booking'),r('view_page','/admin'),r('view_page','/club?email=sensitive'),
   r('view_page','/club','2026-11-30T16:00:00Z'),r('random','/club')
 ],'2026-11');
 assert.equal(x.metrics.pageViews,2);assert.equal(x.metrics.reserveClicks,1);
 assert.equal(x.metrics.clubEnquiries,1);assert.equal(x.metrics.bookingRequests,1);
 assert.equal(x.classified,5);assert.equal(x.topPages[0].path,'/club');
 assert.equal(x.daily.length,30);assert.equal(x.daily[0].pageViews,2);
 assert.equal(x.daily.at(-1).pageViews,0);
 assert.throws(()=>summarizeWebsiteBehavior([],'2026-13'));
});
test('only consented records within a Philippine calendar month are read',async()=>{
 const result=await websiteBehaviorReport('2026-11',async(table,raw)=>{
  assert.equal(table,'plp_analytics_events');const q=new URLSearchParams(raw);
  assert.equal(q.get('select'),'event_name,page_path,created_at');
  assert.equal(q.get('payload->>collection'),'eq.plp_consent_v2');
  assert.deepEqual(q.getAll('created_at'),['gte.2026-10-31T16:00:00.000Z','lt.2026-11-30T16:00:00.000Z']);
  assert.equal(q.get('limit'),'500');
  return [r('view_page','/'),r('click_phone','/contact')];
 });
 assert.equal(result.complete,true);assert.equal(result.scanned,2);
 assert.equal(result.metrics.phoneClicks,1);assert.equal(result.metrics.pageViews,1);
});
test('high event volume hides partial totals',async()=>{
 let calls=0;const x=await websiteBehaviorReport('2026-11',async()=>{
  calls++;return Array.from({length:500},()=>r('view_page','/club'));
 });
 assert.equal(calls,20);assert.equal(x.complete,false);assert.equal(x.scanned,10000);
 assert.equal(x.metrics,null);assert.equal(x.topPages,null);
});
test('owner analytics endpoint is staff-guarded and private',async()=>{
 const res={headers:{},setHeader(k,v){this.headers[k]=v},end(s){this.body=JSON.parse(s)}};
 await adminHandler({method:'GET',query:{action:'owner-behavior',month:'2026-11'},headers:{}},res);
 assert.equal(res.statusCode,401);assert.equal(res.headers['Cache-Control'],'private, no-store');
 assert.equal(res.body.ok,false);assert.ok(!('metrics' in res.body));
});
test('website analytics remains inside protected existing PLP workspace',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 assert.match(read('src/admin/PlpEnterpriseAdminApp.jsx'),/page === 'analytics' && <WebsiteAnalytics code=\{code\}/);
 assert.match(read('src/admin/PlpEnterpriseAdminApp.jsx'),/id: 'analytics', label: 'Website Analytics'/);
 assert.match(read('api/admin.js'),/action === 'owner-behavior'/);
 assert.doesNotMatch(read('src/admin/WebsiteAnalytics.jsx'),/localStorage|sessionStorage|POST/);
});
