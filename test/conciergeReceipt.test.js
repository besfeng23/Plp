import test from 'node:test';
import assert from 'node:assert/strict';

test('mixed-case enquiry identifiers acknowledge the same stored receipt on retry', async t => {
  const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const prior = keys.map(key => process.env[key]);
  t.after(() => keys.forEach((key,index) => {
    if (prior[index] === undefined) delete process.env[key];
    else process.env[key] = prior[index];
  }));
  process.env.SUPABASE_URL = 'https://desk.example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-fixture';
  const { receiveEnquiry } = await import('../lib/concierge-desk.js');
  const requestId = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
  const stored = requestId.toLowerCase();
  const req = {requestId,topic:'club',name:'Test Guest',email:'guest@example.invalid',message:'Membership details.'};
  const rpc = t.mock.method(globalThis, 'fetch', async (url,opts) => {
    assert.equal(new URL(url).pathname,'/rest/v1/rpc/receive_concierge_enquiry');
    assert.equal(JSON.parse(opts.body).p_id,stored);
    return new Response(JSON.stringify(stored));
  });
  for (const identity of [requestId,stored]) {
    const [status,result] = await receiveEnquiry({...req,requestId:identity});
    assert.equal(status,200);
    assert.equal(result.receipt,stored);
    assert.equal(result.received,true);
  }
  assert.equal(rpc.mock.callCount(),2);
});
