// B1 regression: authenticated owner writes must reach their handlers (they
// previously all returned 405), while auth, origin and method checks hold.
import test from 'node:test';
import assert from 'node:assert/strict';

const uid='3c674ce1-7ab5-4823-b9ae-062a47c61f12';
const itemId='3c674ce1-7ab5-4823-b9ae-062a47c61f13';
const docId='3c674ce1-7ab5-4823-b9ae-062a47c61f14';
const SUPA='https://jcyqixttuebxqqfkjonq.supabase.co';
// api/_supabase.js reads env at import time, so set it before importing.
Object.assign(process.env,{PLP_OWNER_EMAIL:'owner@example.test',PLP_OWNER_SESSION_SECRET:'s'.repeat(64),
 SUPABASE_URL:SUPA,SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service'});
const { default: handler } = await import('../lib/owner-handler.js');
const { ownerCookie } = await import('../lib/owner-auth.js');

const calls=[];
let ownerValid=true;
globalThis.fetch=async(url,opts={})=>{
 const u=new URL(url);const method=opts.method||'GET';
 calls.push({path:u.pathname,method,body:opts.body?JSON.parse(opts.body):undefined});
 const json=(code,body)=>({ok:code<400,status:code,json:async()=>body,text:async()=>JSON.stringify(body)});
 if(u.pathname==='/auth/v1/admin/users/'+uid)
  return ownerValid?json(200,{id:uid,email:'owner@example.test',email_confirmed_at:'2026-11-01T00:00:00Z',is_anonymous:false}):json(404,{});
 if(u.pathname==='/rest/v1/plp_owner_items'&&method==='POST')return json(201,[{id:itemId,...JSON.parse(opts.body)}]);
 if(u.pathname==='/rest/v1/plp_owner_items'&&method==='PATCH')return json(200,[{id:itemId,status:'reviewed'}]);
 if(u.pathname==='/rest/v1/plp_owner_items'&&method==='GET')return json(200,[{id:itemId}]);
 if(u.pathname.startsWith('/rest/v1/rpc/'))return json(200,{status:'ok',task_id:docId});
 if(u.pathname.startsWith('/rest/v1/plp_owner_document'))return json(201,[{}]);
 if(u.pathname.startsWith('/storage/v1/object/upload/sign/'))return json(200,{url:'/object/upload/sign/owner-documents/x?token=t'});
 return json(500,{message:'unexpected '+method+' '+u.pathname});
};

const origin={host:'plp-boracay.vercel.app',origin:'https://plp-boracay.vercel.app'};
const authed=()=>({...origin,cookie:ownerCookie(uid,process.env)});
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},end(s){this.body=JSON.parse(s)}}}
async function call(method,operation,{headers=authed(),body,query={}}={}){
 const r=res();await handler({method,headers,body,query:{operation,...query}},r);return r;
}
const item={title:'Verify Pearl Club pricing',details:'',chapter:'boracay',kind:'decision',status:'needs_decision',priority:'high'};

test('unauthenticated GET and POST are rejected with 401, not 405',async()=>{
 assert.equal((await call('GET','items',{headers:{}})).statusCode,401);
 for(const op of ['items','decide','documents']){
  const r=await call('POST',op,{headers:origin,body:{}});
  assert.equal(r.statusCode,401,op);
 }
 assert.equal((await call('PATCH','items',{headers:origin,body:{}})).statusCode,401);
 assert.ok(!calls.some(c=>c.path.startsWith('/rest/v1/')||c.path.startsWith('/storage/')),'no data call before auth');
});

test('forged cookie and cross-site writes are rejected before any write',async()=>{
 calls.length=0;
 assert.equal((await call('POST','items',{headers:{...origin,cookie:'__Host-plp_owner=forged.sig'},body:item})).statusCode,401);
 assert.equal((await call('POST','items',{headers:{...authed(),origin:'https://evil.example'},body:item})).statusCode,403);
 assert.equal(calls.length,0);
});

test('withdrawn owner identity cannot write even with a signed cookie',async()=>{
 calls.length=0;ownerValid=false;
 try{
  const r=await call('POST','items',{body:item});
  assert.equal(r.statusCode,401);
  assert.ok(!calls.some(c=>c.path.startsWith('/rest/v1/')));
 }finally{ownerValid=true;}
});

test('authenticated item creation and update reach their handlers',async()=>{
 calls.length=0;
 const created=await call('POST','items',{body:item});
 assert.equal(created.statusCode,201);assert.equal(created.body.item.owner_id,uid);
 assert.ok(calls.some(c=>c.path==='/rest/v1/plp_owner_items'&&c.method==='POST'));
 const updated=await call('PATCH','items',{body:{id:itemId,updated_at:'2026-11-22T01:00:00.000Z',status:'reviewed'}});
 assert.equal(updated.statusCode,200);assert.equal(updated.body.item.status,'reviewed');
});

test('authenticated decision submission reaches the decide RPC',async()=>{
 calls.length=0;
 const r=await call('POST','decide',{body:{id:itemId,decision:'approved',assigned_to_label:'Front office',due_on:'2026-12-01',notes:''}});
 assert.equal(r.statusCode,201,JSON.stringify(r.body));
 const rpc=calls.find(c=>c.path==='/rest/v1/rpc/plp_owner_decide_and_assign');
 assert.ok(rpc);assert.equal(rpc.body.p_owner_id,uid);
});

test('authenticated document upload intent, completion, failure and archive reach their handlers',async()=>{
 calls.length=0;
 const intent=await call('POST','documents',{body:{op:'upload-intent',name:'Board minutes.pdf',mime:'application/pdf',size:1200,chapter:'boracay',item_id:null}});
 assert.equal(intent.statusCode,201,JSON.stringify(intent.body));
 assert.match(intent.body.upload_url,/^https:\/\/jcyqixttuebxqqfkjonq\.supabase\.co\/storage\/v1\/object\/upload\/sign\//);
 assert.ok(calls.some(c=>c.path.startsWith('/storage/v1/object/upload/sign/owner')||c.path.startsWith('/storage/v1/object/upload/sign/')));
 assert.equal((await call('POST','documents',{body:{op:'complete',document_id:docId}})).statusCode,200);
 assert.equal((await call('POST','documents',{body:{op:'fail',document_id:docId}})).statusCode,200);
 assert.equal((await call('PATCH','documents',{body:{op:'archive',document_id:docId}})).statusCode,200);
 const rpcs=calls.filter(c=>c.path.startsWith('/rest/v1/rpc/'));
 assert.ok(rpcs.length>=3);for(const c of rpcs)assert.equal(Object.values(c.body).includes(uid),true);
});

test('unauthorized document access is rejected',async()=>{
 calls.length=0;
 assert.equal((await call('GET','documents',{headers:{},query:{op:'download',id:docId}})).statusCode,401);
 assert.equal((await call('POST','documents',{headers:origin,body:{op:'upload-intent'}})).statusCode,401);
 assert.equal((await call('PATCH','documents',{headers:origin,body:{op:'archive',document_id:docId}})).statusCode,401);
 assert.equal(calls.filter(c=>!c.path.startsWith('/auth/')).length,0);
});

test('unsupported methods return 405',async()=>{
 for(const m of ['PUT','DELETE'])assert.equal((await call(m,'items',{body:{}})).statusCode,405,m);
 // Authenticated writes to read-only operations are still not allowed.
 assert.equal((await call('POST','summary',{body:{}})).statusCode,405);
 assert.equal((await call('POST','me',{body:{}})).statusCode,405);
 assert.equal((await call('PATCH','decide',{body:{}})).statusCode,405);
 assert.equal((await call('PATCH','approvals',{body:{}})).statusCode,405);
});
