import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../src/owner/OwnerApp.jsx',import.meta.url),'utf8');

// Carried over from PR #97: the Reports & Documents tab threw a ReferenceError
// because the document vault handlers were nested inside decideItem.
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

test('signed document uploads use PUT, the method Supabase Storage upload/sign accepts',()=>{
 assert.match(app,/fetch\(intent\.upload_url,\{method:'PUT'/);
 assert.doesNotMatch(app,/fetch\(intent\.upload_url,\{method:'POST'/);
});

test('OwnerApp compiles and imports (build/import smoke test)',async()=>{
 const { createServer } = await import('vite');
 const server=await createServer({root:new URL('..',import.meta.url).pathname,logLevel:'silent',server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const mod=await server.ssrLoadModule('/src/owner/OwnerApp.jsx');
  assert.equal(typeof mod.default,'function');
 }finally{await server.close();}
});
