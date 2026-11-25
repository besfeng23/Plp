import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredPermission, can, permissionsFor, authorizeStaffRequest } from '../lib/access-control.js';
import { visibleTiles } from '../src/admin/adminNavigation.js';

test('partner administration is available only to individually authorized owners', async()=>{
  for (const method of ['GET','POST','PATCH','DELETE']) assert.equal(requiredPermission('affiliates',method),'affiliate.manage');
  assert.equal(can('owner','affiliate.manage'),true);
  for (const role of ['manager','staff','legacy']) assert.equal(permissionsFor(role).includes('affiliate.manage'),false);
  assert.equal(visibleTiles('growth',permissionsFor('owner')).filter(t=>['partners','payouts'].includes(t.id)).length,2);
  for (const role of ['manager','staff','legacy']) assert.equal(visibleTiles('growth',permissionsFor(role)).some(t=>['partners','payouts'].includes(t.id)),false);
  const legacy=await authorizeStaffRequest({method:'GET',headers:{'x-plp-staff-code':'fixture-code'}},'affiliates',{PLP_STAFF_CODE:'fixture-code',PLP_AUTH_V2_ENABLED:'false'},async()=>{throw Error('Unexpected network request')});
  assert.equal(legacy.ok,false);
});
