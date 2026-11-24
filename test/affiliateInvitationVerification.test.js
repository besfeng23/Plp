import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

test('invitation needs verified recipient email before consumption or session creation', async () => {
  const saved={...process.env};
  const originalFetch=globalThis.fetch;
  const secret='fixture-session-key-'.repeat(4);
  Object.assign(process.env,{PLP_DATABASE_TARGET:'legacy',SUPABASE_URL:'https://fixture.example.invalid',SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-server',PLP_AFFILIATE_SESSION_SECRET:secret,PLP_AFFILIATE_PUBLIC_ENROLLMENT:'false',PLP_AFFILIATE_COMMISSIONS_ACTIVE:'false'});
  const inviteId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const partnerId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const invite={id:inviteId,email:'invited@example.invalid',name:'Fixture partner',tier:'referral',expires_at:new Date(Date.now()+3600000).toISOString(),accepted_at:null};
  let partner=null,verifiedEmail='wrong@example.invalid',accepted=0,otp=0;
  const bookings=Array.from({length:51},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),created_at:'2026-11-24T12:00:00Z',booking_reference:'QA-'+i,status:'COMPLETED',currency:'USD',guest_name:'Private fixture'}));
  const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  const {handleAffiliatePortal,hashInviteToken,verifyAffiliateSession}=await import('../lib/affiliate.js');
  const token='a'.repeat(32);
  globalThis.fetch=async (url,opts={})=>{
    const u=new URL(url), method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):{};
    assert.equal(u.origin,'https://fixture.example.invalid');
    if(u.pathname==='/auth/v1/otp'){assert.equal(body.email,invite.email);otp++;return response({});}
    if(u.pathname==='/auth/v1/verify'){assert.equal(body.token,'123456');return response({access_token:'fixture-only'});}
    if(u.pathname==='/auth/v1/user')return response({id:'fixture-id',email:verifiedEmail,email_confirmed_at:'2026-01-01T00:00:00Z'});
    if(u.pathname.endsWith('/rpc/plp_reserve_preview_attempt'))return response(true);
    if(u.pathname.endsWith('/plp_affiliate_invites')){
      if(method==='PATCH'){assert.equal(u.searchParams.get('accepted_at'),'is.null');accepted++;invite.accepted_at=body.accepted_at;return response([{id:inviteId}]);}
      const valid=u.searchParams.get('token_hash')==='eq.'+hashInviteToken(token)||u.searchParams.get('id')==='eq.'+inviteId;
      return response(valid?[invite]:[]);
    }
    if(u.pathname.endsWith('/plp_affiliates')){
      if(method==='POST'){partner={...body,id:partnerId};return response([partner]);}
      return response(partner?[partner]:[]);
    }
    if(u.pathname.endsWith('/plp_bookings')){
      assert.equal(u.searchParams.get('affiliate_id'),'eq.'+partnerId);
      assert.equal(u.searchParams.get('order'),'created_at.desc,id.desc');
      assert.equal(u.searchParams.get('limit'),'51');
      return response(u.searchParams.has('or')?bookings.slice(50):bookings);
    }
    if(u.pathname.endsWith('/plp_concierge_enquiries')||u.pathname.endsWith('/plp_payouts')){assert.equal(u.searchParams.get('affiliate_id'),'eq.'+partnerId);return response([]);}
    throw Error('Unexpected fixture request '+u.pathname);
  };
  const request=(action,body={},cookie='')=>handleAffiliatePortal({method:'POST',headers:{cookie,'x-forwarded-for':'fixture'}},{action,...body});
  try{
    assert.equal((await request('enroll-start',{email:invite.email}))[0],403);
    const result=await request('accept',{invite:token});
    assert.equal(result[0],200);assert.equal(result[1].verificationRequired,true);
    assert.match(result[2],/^__Host-plp_affiliate_enroll=/);
    assert.equal(partner,null);assert.equal(accepted,0);assert.equal(otp,1);
    const pending=result[2].split(';')[0];
    assert.equal((await request('enroll-verify',{code:'123456'},pending))[0],401);
    assert.equal(partner,null);assert.equal(accepted,0);
    verifiedEmail=invite.email;
    const verified=await request('enroll-verify',{code:'123456'},pending);
    assert.equal(verified[0],200);assert.equal(partner.status,'active');
    assert.equal(partner.rate_approval_status,'pending_owner_approval');assert.equal(accepted,1);
    assert.match(verified[2][0],/^__Host-plp_affiliate=/);
    assert.equal((await request('accept',{invite:token}))[0],400);
    const session=verified[2][0].split(';')[0];
    const read=(action,body={})=>handleAffiliatePortal({method:'GET',headers:{cookie:session}},{action,...body});
    const dashboard=await read('me');
    assert.equal(dashboard[0],200);
    assert.equal(dashboard[1].referrals.length,50);
    assert.ok(dashboard[1].ledgerNext.referrals);
    assert.doesNotMatch(JSON.stringify(dashboard[1].referrals),/guest_name|Private fixture/);
    const page=await read('ledger',{kind:'referrals',cursor:dashboard[1].ledgerNext.referrals});
    assert.equal(page[0],200);assert.equal(page[1].rows.length,1);assert.equal(page[1].next,null);
    assert.equal((await read('ledger',{kind:'unknown',cursor:dashboard[1].ledgerNext.referrals}))[0],400);
    assert.equal((await read('ledger',{kind:'referrals',cursor:'invalid'}))[0],400);
    const now=Math.floor(Date.now()/1000);
    const payload=Buffer.from(JSON.stringify({v:1,typ:'affiliate',uid:partnerId,iat:now,exp:now+3600})).toString('base64url');
    assert.equal(verifyAffiliateSession(payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url'),secret),null);
  }finally{
    globalThis.fetch=originalFetch;
    for(const k of Object.keys(process.env))if(!Object.hasOwn(saved,k))delete process.env[k];
    Object.assign(process.env,saved);
  }
});
