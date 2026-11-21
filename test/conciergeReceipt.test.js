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

test('residential interest is tagged in the existing private desk and can be filtered by staff', async t => {
  const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const old = keys.map(key => process.env[key]);
  process.env.SUPABASE_URL = 'https://desk.example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-fixture';
  t.after(() => keys.forEach((key,i) => old[i] === undefined ? delete process.env[key] : process.env[key] = old[i]));
  const { receiveEnquiry, staffEnquiries } = await import('../lib/concierge-desk.js');
  const received = [];
  const mock = t.mock.method(globalThis,'fetch',async (url,options) => {
    if (url.includes('/rpc/receive_concierge_enquiry')) {
      const body = JSON.parse(options.body);
      received.push(body);
      return Response.json(body.p_id);
    }
    assert.match(url,/plp_concierge_enquiries/);
    const query = new URL(url).searchParams;
    assert.equal(query.get('topic'),'eq.club');
    assert.equal(query.get('interest'),'ilike.*Senior living concept interest*');
    return Response.json([]);
  });
  const request = { requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    topic:'club', name:'Test Guest', email:'guest@example.invalid', message:'Please explain the proposed residences.',
    purpose:'residential-interest' };
  const [status,outcome] = await receiveEnquiry(request);
  assert.equal(status,200);
  assert.equal(outcome.received,true);
  assert.match(received[0].p_interest,/Senior living concept interest/);
  assert.equal(received[0].p_topic,'club');
  const other = await receiveEnquiry({ ...request,requestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',purpose:'arbitrary-user-text' });
  assert.equal(other[0],200);
  assert.doesNotMatch(received[1].p_interest,/Senior living concept interest/);
  const [listStatus,result] = await staffEnquiries('GET',{scope:'residential',status:'NEW'});
  assert.equal(listStatus,200);
  assert.deepEqual(result.rows,[]);
  assert.equal(mock.mock.callCount(),3);
});
