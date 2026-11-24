import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerCookie, readOwnerCookie, validateCurrentOwner, validateGodOwner, validateOwnerBearer } from '../lib/owner-auth.js';
import { staffCookie, resolveStaffActor } from '../lib/access-control.js';
import { hasValidStaffOrOwnerSession } from '../lib/preview-gate.js';
import { issueOwnerGodSession } from '../lib/owner-god-code.js';
const uid='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const user={id:uid,email:'owner@example.test',email_confirmed_at:null,is_anonymous:false};
const env={PLP_OWNER_EMAIL:user.email,PLP_OWNER_GOD_CODE_HASH:'a'.repeat(64),PLP_OWNER_SESSION_SECRET:'o'.repeat(64),PLP_STAFF_SESSION_SECRET:'s'.repeat(64),PLP_AUTH_V2_ENABLED:'true',SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'server'};
const fetcher=async()=>({ok:true,json:async()=>user});
const request=cookie=>({headers:{cookie:cookie.split(';')[0]}});
test('code-only login accepts an active allow-listed unconfirmed account, email login does not',async()=>{
  assert.equal(await validateCurrentOwner(uid,env,fetcher),null);
  assert.equal(await validateOwnerBearer('t'.repeat(50),env,fetcher),null);
  assert.equal((await validateGodOwner(uid,env,fetcher)).id,uid);
  const issued=await issueOwnerGodSession(env,{lookupOwnerUser:async()=>user});
  assert.equal(issued.ok,true);
  const owner=request(issued.cookies[0]),staff=request(issued.cookies[1]);
  assert.equal(readOwnerCookie(owner,env).authMethod,'god-code');
  assert.equal((await resolveStaffActor(staff,env,fetcher)).role,'owner');
  assert.equal(await hasValidStaffOrOwnerSession(owner,env),true);
  assert.equal(await hasValidStaffOrOwnerSession(staff,env),true);
  assert.equal((await resolveStaffActor(request(staffCookie(uid,env)),env,fetcher)),null);
  assert.equal(readOwnerCookie(request(ownerCookie(uid,env)),env).authMethod,undefined);
  for(const changed of [{...env,PLP_OWNER_GOD_CODE_HASH:'b'.repeat(64)},{...env,PLP_OWNER_GOD_CODE_HASH:''},{...env,PLP_OWNER_EMAIL:'different@example.test'}]){
    assert.equal(readOwnerCookie(owner,changed),null);
    assert.equal(await resolveStaffActor(staff,changed,fetcher),null);
    assert.equal(await hasValidStaffOrOwnerSession(owner,changed),false);
  }
  for(const invalid of [{...user,banned_until:'2099-01-01'},{...user,deleted_at:'2026-01-01'},{...user,email:'different@example.test'},{...user,is_anonymous:true}]){
    assert.equal(await validateGodOwner(uid,env,async()=>({ok:true,json:async()=>invalid})),null);
  }
});
