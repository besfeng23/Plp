import React, { useState } from 'react';
import { Archive, Download, FileText, RefreshCw, Upload } from 'lucide-react';
import { chapters } from './OwnerWorkItems.jsx';
import './owner-work.css';

const MAX=8*1024*1024;
const TYPES={
 '.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
 '.csv':'text/csv','.txt':'text/plain','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
};
const formatSize=n=>n<1024*1024?Math.max(1,Math.round(n/1024))+' KB':(n/1024/1024).toFixed(1)+' MB';
export default function OwnerDocuments({documents=[],status='loading',error='',busy=false,registerItems=[],onUpload,onPrepareDownload,onArchive,onReload}) {
 const [file,setFile]=useState(null),[chapter,setChapter]=useState('boracay'),[itemId,setItemId]=useState('');
 const [uploadError,setUploadError]=useState(''),[downloadLinks,setDownloadLinks]=useState({}),[working,setWorking]=useState('');
 const active=documents.filter(d=>d.status!=='archived');
 async function submit(e){
  e.preventDefault();setUploadError('');
  if(!file)return;
  const ext='.'+(file.name.split('.').pop()||'').toLowerCase();
  if(file.size<1||file.size>MAX||TYPES[ext]!==file.type){setUploadError('Choose a supported file with a matching file type, no larger than 8 MB.');return;}
  setWorking('upload');
  try{await onUpload(file,{chapter,item_id:itemId||null});setFile(null);setItemId('');}
  catch(e){setUploadError(e.message||'Upload failed.');}finally{setWorking('');}
 }
 async function prepare(id){
  setWorking(id);setUploadError('');
  try{const url=await onPrepareDownload(id);setDownloadLinks(old=>({...old,[id]:url}));}
  catch(e){setUploadError(e.message||'Could not prepare a secure download.');}finally{setWorking('');}
 }
 async function archive(id){
  setWorking(id);setUploadError('');
  try{await onArchive(id);setDownloadLinks(old=>{const next={...old};delete next[id];return next;});}
  catch(e){setUploadError(e.message||'Could not archive document.');}finally{setWorking('');}
 }
 return <section className="owner-panel">
  <div className="owner-work-heading"><div><h3>Private document vault</h3><p className="owner-note">Files are stored in a private Supabase bucket. Upload links are single-file and time-limited; download links expire after five minutes.</p></div>
   <button type="button" className="owner-secondary" onClick={onReload} disabled={busy}><RefreshCw size={14}/> Refresh</button></div>
  <form className="owner-document-form" onSubmit={submit}>
   <div className="owner-work-fields"><label>Location<select value={chapter} onChange={e=>setChapter(e.target.value)}>{chapters.map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
    <label>Link to a saved owner record (optional)<select value={itemId} onChange={e=>setItemId(e.target.value)}><option value="">No linked record</option>{registerItems.filter(x=>x.status!=='archived').map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label></div>
   <label>Choose document<input type="file" accept=".pdf,.docx,.xlsx,.pptx,.csv,.txt,.png,.jpg,.jpeg" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   {file&&<p className="owner-note">{file.name} · {formatSize(file.size)}</p>}
   <div className="owner-work-actions"><button type="submit" className="owner-primary" disabled={busy||working==='upload'||!file}><Upload size={14}/>{working==='upload'?'Uploading…':'Upload privately'}</button></div>
   <p className="owner-work-help">Allowed: PDF, DOCX, XLSX, PPTX, CSV, TXT, PNG and JPEG. Maximum 8 MB per file. No public links or anonymous file access.</p>
  </form>
  {error&&<p className="owner-work-error" role="alert">{error}</p>}{uploadError&&<p className="owner-work-error" role="alert">{uploadError}</p>}
  {status==='loading'?<p className="owner-note">Loading private document register…</p>
   :status==='error'?<p className="owner-note">Private document register unavailable. Existing files were not changed.</p>
   :!active.length?<p className="owner-work-empty">No uploaded documents. The existing external document references remain in the register above.</p>
   :<div>{active.map(doc=><article className="owner-document-row" key={doc.id}>
     <div className="owner-work-item-head"><div><h4><FileText size={15}/> {doc.original_name}</h4><span className="owner-eyebrow">{chapters.find(([key])=>key===doc.chapter)?.[1]||doc.chapter}</span></div><span className="owner-pill">{doc.status}</span></div>
     <div className="owner-document-meta"><span>{formatSize(doc.size_bytes)}</span><span>{doc.mime_type}</span><span>Uploaded {new Date(doc.created_at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila'})}</span></div>
     <div className="owner-document-actions"><button type="button" className="owner-secondary" disabled={busy||working===doc.id} onClick={()=>prepare(doc.id)}><Download size={14}/> Prepare secure download</button>
       {downloadLinks[doc.id]&&<a href={downloadLinks[doc.id]} target="_blank" rel="noopener noreferrer">Open download</a>}
       <button type="button" className="owner-secondary" disabled={busy||working===doc.id} onClick={()=>archive(doc.id)}><Archive size={14}/> Archive</button></div>
     {doc.history?.length>0&&<div className="owner-document-history">{doc.history.slice(0,5).map((h,i)=><div key={i}>{h.created_at?.slice(0,16).replace('T',' ')} · {h.action.replaceAll('_',' ')}</div>)}</div>}
    </article>)}</div>}
 </section>;
}
