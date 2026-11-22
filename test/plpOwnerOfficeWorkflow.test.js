import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../src/owner/OwnerApp.jsx',import.meta.url),'utf8');

test('document handlers are component-scoped, not nested inside the approval handler',()=>{
 const decision=app.slice(app.indexOf('async function decideItem(itemId,payload){'),app.indexOf('async function fetchBehavior()',app.indexOf('async function decideItem(itemId,payload){')));
 assert.ok(decision.length>0);
 assert.match(decision,/ownerRequest\('decide'/);
 assert.doesNotMatch(decision,/async function (loadDocuments|uploadDocument|prepareDocumentDownload|archiveDocument)/);
 for(const name of ['loadDocuments','uploadDocument','prepareDocumentDownload','archiveDocument']){
  assert.match(app,new RegExp('async function '+name+'\\('));
 }
 assert.match(app,/if\(tab==='reports'\)void loadDocuments\(\)/);
 assert.match(app,/onUpload=\{uploadDocument\}/);
 assert.match(app,/onPrepareDownload=\{prepareDocumentDownload\}/);
 assert.match(app,/onArchive=\{archiveDocument\}/);
});
