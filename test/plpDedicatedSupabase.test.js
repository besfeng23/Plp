import test from 'node:test';
import assert from 'node:assert/strict';
import { plpSupabaseEnv, DEDICATED_PLP_URL } from '../lib/plp-supabase-env.js';
import { lookupOwnerUser } from '../lib/owner-god-code.js';
import { ownerConfigured } from '../lib/owner-auth.js';
import { authV2Enabled } from '../lib/access-control.js';

const legacy = { SUPABASE_URL: 'https://legacy.supabase.co', SUPABASE_ANON_KEY: 'legacy-anon', SUPABASE_SERVICE_ROLE_KEY: 'legacy-service' };
const env = { ...legacy, PLP_NEW_SUPABASE_URL: DEDICATED_PLP_URL, PLP_NEW_SUPABASE_ANON_KEY: 'new-anon', PLP_NEW_SUPABASE_SERVICE_ROLE_KEY: 'new-service', PLP_OWNER_EMAIL: 'owner@example.test', PLP_OWNER_SESSION_SECRET: 'x'.repeat(64), PLP_STAFF_SESSION_SECRET: 'y'.repeat(64), PLP_AUTH_V2_ENABLED: 'true' };
const uid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

test('selects dedicated database as a complete bundle, legacy only when explicitly selected or no prefix exists', () => {
  assert.equal(plpSupabaseEnv(env).SUPABASE_URL, DEDICATED_PLP_URL);
  assert.equal(plpSupabaseEnv(env).SUPABASE_SERVICE_ROLE_KEY, 'new-service');
  assert.equal(plpSupabaseEnv(env).SUPABASE_ANON_KEY, 'new-anon');
  assert.equal(plpSupabaseEnv({...env, PLP_DATABASE_TARGET:'legacy'}).SUPABASE_URL, legacy.SUPABASE_URL);
  assert.equal(plpSupabaseEnv(legacy).SUPABASE_URL, legacy.SUPABASE_URL);
  assert.equal(ownerConfigured(env), true);
  assert.equal(authV2Enabled(env), true);
});
test('wrong URL, incomplete bundle, missing dedicated config or unknown mode fail closed', () => {
  for (const broken of [{...env, PLP_NEW_SUPABASE_URL:'https://wrong.supabase.co'}, {...env, PLP_NEW_SUPABASE_SERVICE_ROLE_KEY:''}, {...legacy, PLP_DATABASE_TARGET:'dedicated'}, {...env, PLP_DATABASE_TARGET:'wrong'}]) {
    assert.equal(plpSupabaseEnv(broken).SUPABASE_URL, '');
    assert.equal(plpSupabaseEnv(broken).SUPABASE_SERVICE_ROLE_KEY, '');
    assert.equal(ownerConfigured(broken), false);
    assert.equal(authV2Enabled(broken), false);
  }
});
test('God Mode uses only the dedicated Auth URL and exact allow-listed active identity', async () => {
  const calls = [];
  const user = {id:uid,email:'owner@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false};
  const result = await lookupOwnerUser(env, async (url, options) => {
    calls.push(url); assert.equal(options.headers.Authorization, 'Bearer new-service');
    assert.ok(url.startsWith(DEDICATED_PLP_URL + '/auth/v1/'));
    return {ok:true,json:async()=>url.includes('?') ? {users:[{id:uid,email:'other@example.test'},user]} : user};
  });
  assert.equal(result.id, uid); assert.equal(calls.length, 2);
  assert.match(calls[0], /page=1&per_page=100/);
});
test('God Mode refuses missing, banned or anonymous users and mixed credentials', async () => {
  const baseUser = {id:uid,email:'owner@example.test',email_confirmed_at:'2026-01-01T00:00:00Z'};
  for(const user of [{...baseUser,deleted_at:'2026-01-01T00:00:00Z'},{...baseUser,banned_until:'2099-01-01T00:00:00Z'},{...baseUser,is_anonymous:true}]) {
    assert.equal(await lookupOwnerUser(env, async url => ({ok:true,json:async()=>url.includes('?')?{users:[user]}:user})), null);
  }
  assert.equal(await lookupOwnerUser(env,async()=>({ok:true,json:async()=>({users:[]})})),null);
  assert.equal(await lookupOwnerUser({...env,PLP_NEW_SUPABASE_SERVICE_ROLE_KEY:''},async()=>{throw Error('Must not fetch')}),null);
});
