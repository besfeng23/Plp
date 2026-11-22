import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocumentIntent, requestOwnerDocumentUpload, listOwnerDocuments, getOwnerDocumentDownload, completeOwnerDocumentUpload, archiveOwnerDocument } from '../lib/owner-documents.js';
import { readFileSync } from 'node:fs';
const uid='3c674ce1-7ab5-4823-b9ae-062a47c61f12';
const doc='3c674ce1-7ab5-4823-b9ae-062a47c61f13';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const input={name:'Board minutes.pdf',mime:'application/pdf',size:1200,chapter:'boracay',item_id:null};

test('document uploads enforce matching extension/MIME, supported types and 8 MB cap',()=>{
 assert.equal(validateDocumentIntent(input).mime_type,'application/pdf');
 assert.throws(()=>validateDocumentIntent({...input,name:'invoice.pdf',mime:'text/plain'}),TypeError);
 assert.throws(()=>validateDocumentIntent({...input,name:'unsafe.html',mime:'text/html'}),TypeError);
 assert.throws(()=>validateDocumentIntent({...input,size:8*1024*1024+1}),TypeError);
 assert.throws(()=>validateDocumentIntent({...input,name:'../private.pdf'}),TypeError);
 assert.throws(()=>validateDocumentIntent({...input,chapter:'other'}),TypeError);
});
test('upload intent creates an owner-scoped path, metadata and one-time signed URL',async()=>{
 const inserted=[];let signedPath;
 const result=await requestOwnerDocumentUpload(uid,input,{
  selectRows:async()=>[],
  insertRow:async(table,row)=>{inserted.push({table,row});return [row]},
  updateRows:async()=>[],
  signUpload:async path=>{signedPath=path;return 'https://storage.example/signed-upload'},
 });
 assert.equal(result.upload_url,'https://storage.example/signed-upload');
 assert.equal(result.expires_in,7200);
 assert.ok(signedPath.startsWith(uid+'/'));
 assert.equal(inserted[0].table,'plp_owner_documents');
 assert.equal(inserted[0].row.owner_id,uid);
 assert.equal(inserted[0].row.status,'pending_upload');
 assert.equal(inserted[1].row.action,'upload_requested');
});
test('document references must belong to the same owner',async()=>{
 await assert.rejects(()=>requestOwnerDocumentUpload(uid,{...input,item_id:doc},{
  selectRows:async()=>[],
  insertRow:async()=>{throw new Error('must not insert')},
  updateRows:async()=>[],signUpload:async()=>'/signed',
 }),TypeError);
});
test('document listing and download are scoped to owner and only uploaded files get signed links',async()=>{
 const queries=[],events=[];
 const docs=await listOwnerDocuments(uid,{selectRows:async(table,q)=>{
  queries.push({table,params:new URLSearchParams(q)});
  if(table==='plp_owner_documents')return [{id:doc,owner_id:uid,status:'uploaded',original_name:'Board minutes.pdf'}];
  return [{document_id:doc,action:'uploaded'}];
 }});
 assert.equal(queries[0].params.get('owner_id'),'eq.'+uid);
 assert.equal(docs[0].history[0].action,'uploaded');
 const download=await getOwnerDocumentDownload(uid,doc,{
  selectRows:async(table,q)=>{queries.push({table,params:new URLSearchParams(q)});return [{id:doc,storage_path:uid+'/'+doc+'/Board minutes.pdf',original_name:'Board minutes.pdf',mime_type:'application/pdf',size_bytes:1200}]},
  signDownload:async path=>{assert.ok(path.startsWith(uid+'/'));return 'https://storage.example/signed-download'},
  insertRow:async(table,row)=>events.push({table,row}),
 });
 assert.equal(download.url,'https://storage.example/signed-download');assert.equal(download.expires_in,300);
 assert.equal(queries.at(-1).params.get('owner_id'),'eq.'+uid);assert.equal(events[0].row.action,'download_link_issued');
});
test('completion and archive use server-side RPC with verified owner identity',async()=>{
 const calls=[];const io={callRpc:async(name,args)=>{calls.push({name,args});return {status:'ok'}}};
 await completeOwnerDocumentUpload(uid,doc,io);await archiveOwnerDocument(uid,doc,io);
 assert.equal(calls[0].name,'plp_owner_document_complete');assert.equal(calls[0].args.p_owner_id,uid);
 assert.equal(calls[1].name,'plp_owner_archive_document');
});
test('private storage migration, owner UI and API do not create public file access',()=>{
 const sql=read('supabase/migrations/20261122030000_plp_owner_private_documents.sql');
 const ui=read('src/owner/OwnerDocuments.jsx'),app=read('src/owner/OwnerApp.jsx'),api=read('lib/owner-handler.js');
 assert.match(sql,/values\('plp-owner-documents','plp-owner-documents',false,8388608/);
 assert.match(sql,/enable row level security/g);assert.match(sql,/revoke all on plp_runtime\.plp_owner_documents/);
 assert.match(read('lib/owner-documents.js'),/expiresIn:300/);assert.match(ui,/8 MB/);assert.match(ui,/expires after five minutes/);
 assert.match(app,/ownerRequest\('documents'/);assert.match(api,/requestOwnerDocumentUpload/);
 assert.doesNotMatch(ui,/storage_path|service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
