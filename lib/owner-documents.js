import { randomUUID } from 'node:crypto';
import { insertRow, selectRows, updateRows, callRpc } from '../api/_supabase.js';

export const OWNER_DOCUMENT_BUCKET='plp-owner-documents';
export const OWNER_DOCUMENT_MAX_BYTES=8*1024*1024;
export const OWNER_DOCUMENT_TYPES=Object.freeze({
  '.pdf':'application/pdf',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.csv':'text/csv',
  '.txt':'text/plain',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHAPTERS=['boracay','singapore','malaysia','global'];
function supabaseConfig(){
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('Storage service unavailable');
  return {base:url.replace(/\/$/,''),key};
}
function encodePath(path){return path.split('/').map(encodeURIComponent).join('/');}
async function storageAdmin(path,{method='POST',body}={}){
  const {base,key}=supabaseConfig();
  const response=await fetch(base+'/storage/v1/'+path,{
    method,cache:'no-store',signal:AbortSignal.timeout(8000),
    headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  const text=await response.text();
  let data={};try{data=text?JSON.parse(text):{}}catch{}
  if(!response.ok)throw new Error('Storage service unavailable');
  return data;
}
function absoluteStorageUrl(raw){
  const {base}=supabaseConfig();
  if(typeof raw!=='string'||!raw)throw new Error('Storage did not return a signed URL');
  if(/^https:\/\//i.test(raw))return raw;
  if(raw.startsWith('/storage/v1/'))return base+raw;
  return base+'/storage/v1'+(raw.startsWith('/')?raw:'/'+raw);
}
async function createUploadUrl(path){
  const data=await storageAdmin('object/upload/sign/'+OWNER_DOCUMENT_BUCKET+'/'+encodePath(path),{body:{upsert:false}});
  return absoluteStorageUrl(data.url||data.signedURL||data.signedUrl);
}
async function createDownloadUrl(path){
  const data=await storageAdmin('object/sign/'+OWNER_DOCUMENT_BUCKET+'/'+encodePath(path),{body:{expiresIn:300}});
  return absoluteStorageUrl(data.signedURL||data.signedUrl||data.url);
}
function cleanFilename(value){
  if(typeof value!=='string')throw new TypeError('Invalid file name');
  const raw=value.normalize('NFKC').trim();
  if(!raw||raw.length>180||/[\\/\x00-\x1f\x7f]/.test(raw)||raw==='.'||raw==='..')throw new TypeError('Invalid file name');
  const safe=raw.replace(/[^\p{L}\p{N}._ -]/gu,'_').replace(/\.{2,}/g,'.').replace(/^\.+/,'').trim().slice(0,120);
  const ext=safe.slice(safe.lastIndexOf('.')).toLowerCase();
  if(!OWNER_DOCUMENT_TYPES[ext])throw new TypeError('Unsupported file type');
  return {safe,extension:ext};
}
export function validateDocumentIntent(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Invalid upload');
  const allowed=new Set(['op','name','mime','size','chapter','item_id']);
  if(Object.keys(input).some(key=>!allowed.has(key)))throw new TypeError('Unrecognized upload field');
  const {safe,extension}=cleanFilename(input.name);
  if(!Object.hasOwn(OWNER_DOCUMENT_TYPES,extension)||input.mime!==OWNER_DOCUMENT_TYPES[extension])throw new TypeError('File extension and MIME type must match');
  if(!Number.isSafeInteger(input.size)||input.size<1||input.size>OWNER_DOCUMENT_MAX_BYTES)throw new TypeError('File size exceeds the 8 MB limit');
  const chapter=input.chapter||'boracay';
  if(!CHAPTERS.includes(chapter))throw new TypeError('Invalid chapter');
  const itemId=input.item_id||null;
  if(itemId!==null&&!UUID.test(itemId))throw new TypeError('Invalid register item');
  return {original_name:safe,mime_type:input.mime,size_bytes:input.size,chapter,item_id:itemId};
}
async function verifyOwnerItem(uid,itemId,io){
  if(!itemId)return;
  const q=new URLSearchParams({id:'eq.'+itemId,owner_id:'eq.'+uid,select:'id',limit:'1'});
  const rows=await io.selectRows('plp_owner_items',q.toString());
  if(!Array.isArray(rows)||rows.length!==1)throw new TypeError('Document reference not found');
}
export async function requestOwnerDocumentUpload(uid,input,io={selectRows,insertRow,updateRows,signUpload:createUploadUrl}){
  if(!UUID.test(uid))throw new TypeError('Invalid owner');
  const file=validateDocumentIntent(input);
  await verifyOwnerItem(uid,file.item_id,io);
  const id=randomUUID(),storage_path=uid+'/'+id+'/'+file.original_name;
  await io.insertRow('plp_owner_documents',{id,owner_id:uid,...file,storage_path,status:'pending_upload',created_by:uid,updated_by:uid});
  await io.insertRow('plp_owner_document_events',{document_id:id,owner_id:uid,action:'upload_requested',storage_path,original_name:file.original_name,mime_type:file.mime_type,size_bytes:file.size_bytes,actor_id:uid});
  try{
    const upload_url=await io.signUpload(storage_path);
    return {document_id:id,upload_url,expires_in:7200};
  }catch{
    const filter=new URLSearchParams({id:'eq.'+id,owner_id:'eq.'+uid});
    await io.updateRows('plp_owner_documents',filter.toString(),{status:'upload_failed',updated_at:new Date().toISOString(),updated_by:uid});
    await io.insertRow('plp_owner_document_events',{document_id:id,owner_id:uid,action:'upload_failed',storage_path,original_name:file.original_name,mime_type:file.mime_type,size_bytes:file.size_bytes,actor_id:uid});
    throw new Error('Private document storage is temporarily unavailable');
  }
}
export async function listOwnerDocuments(uid,io={selectRows}){
  if(!UUID.test(uid))throw new TypeError('Invalid owner');
  const q=new URLSearchParams({owner_id:'eq.'+uid,
    select:'id,item_id,chapter,original_name,mime_type,size_bytes,status,created_at,updated_at',
    order:'created_at.desc',limit:'101'});
  const rows=await io.selectRows('plp_owner_documents',q.toString());
  if(!Array.isArray(rows)||rows.length>100)throw new Error('Document register limit');
  if(!rows.length)return [];
  const ids=rows.map(x=>x.id).filter(x=>UUID.test(x||''));
  const events=await io.selectRows('plp_owner_document_events',new URLSearchParams({
    owner_id:'eq.'+uid,document_id:'in.('+ids.join(',')+')',
    select:'document_id,action,created_at,original_name,actor_id',
    order:'created_at.desc',limit:'300',
  }).toString());
  if(!Array.isArray(events)||events.length>300)throw new Error('Document audit history unavailable');
  return rows.map(doc=>({...doc,history:events.filter(event=>event.document_id===doc.id)}));
}
export async function completeOwnerDocumentUpload(uid,id,io={callRpc}){
  if(!UUID.test(uid)||!UUID.test(id||''))throw new TypeError('Invalid document');
  return io.callRpc('plp_owner_document_complete',{p_owner_id:uid,p_document_id:id});
}
export async function failOwnerDocumentUpload(uid,id,io={callRpc}){
  if(!UUID.test(uid)||!UUID.test(id||''))throw new TypeError('Invalid document');
  return io.callRpc('plp_owner_document_fail',{p_owner_id:uid,p_document_id:id});
}
export async function getOwnerDocumentDownload(uid,id,io={selectRows,signDownload:createDownloadUrl,insertRow}){
  if(!UUID.test(uid)||!UUID.test(id||''))throw new TypeError('Invalid document');
  const rows=await io.selectRows('plp_owner_documents',new URLSearchParams({
    id:'eq.'+id,owner_id:'eq.'+uid,status:'eq.uploaded',
    select:'id,storage_path,original_name,mime_type,size_bytes',limit:'1',
  }).toString());
  if(!Array.isArray(rows)||rows.length!==1)return null;
  const doc=rows[0],url=await io.signDownload(doc.storage_path);
  await io.insertRow('plp_owner_document_events',{document_id:doc.id,owner_id:uid,action:'download_link_issued',storage_path:doc.storage_path,original_name:doc.original_name,mime_type:doc.mime_type,size_bytes:doc.size_bytes,actor_id:uid});
  return {url,expires_in:300};
}
export async function archiveOwnerDocument(uid,id,io={callRpc}){
  if(!UUID.test(uid)||!UUID.test(id||''))throw new TypeError('Invalid document');
  return io.callRpc('plp_owner_archive_document',{p_owner_id:uid,p_document_id:id});
}
