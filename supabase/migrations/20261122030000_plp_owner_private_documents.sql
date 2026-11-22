-- PLP owner documents use a private bucket and short-lived signed access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('plp-owner-documents','plp-owner-documents',false,8388608,
  array['application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv','text/plain','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=8388608,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists plp_owner_documents_service_role_only on storage.objects;
create policy plp_owner_documents_service_role_only on storage.objects
  for all to service_role
  using (bucket_id='plp-owner-documents')
  with check (bucket_id='plp-owner-documents');

create table if not exists plp_runtime.plp_owner_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  item_id uuid references plp_runtime.plp_owner_items(id) on delete set null,
  chapter text not null check (chapter in ('boracay','singapore','malaysia','global')),
  storage_path text not null unique,
  original_name text not null check (length(btrim(original_name)) between 1 and 120),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv','text/plain','image/png','image/jpeg'
  )),
  size_bytes bigint not null check (size_bytes between 1 and 8388608),
  status text not null default 'pending_upload'
    check (status in ('pending_upload','uploaded','upload_failed','archived')),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plp_owner_documents_by_owner on plp_runtime.plp_owner_documents(owner_id,created_at desc);
create index if not exists plp_owner_documents_by_item on plp_runtime.plp_owner_documents(item_id);

create table if not exists plp_runtime.plp_owner_document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references plp_runtime.plp_owner_documents(id) on delete restrict,
  owner_id uuid not null,
  action text not null check (action in ('upload_requested','uploaded','upload_failed','download_link_issued','archived')),
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists plp_owner_document_events_by_owner on plp_runtime.plp_owner_document_events(owner_id,created_at desc);
create index if not exists plp_owner_document_events_by_document on plp_runtime.plp_owner_document_events(document_id,created_at desc);

alter table plp_runtime.plp_owner_documents enable row level security;
alter table plp_runtime.plp_owner_document_events enable row level security;
revoke all on plp_runtime.plp_owner_documents,plp_runtime.plp_owner_document_events from public,anon,authenticated;
grant select,insert,update on plp_runtime.plp_owner_documents to service_role;
grant select,insert on plp_runtime.plp_owner_document_events to service_role;

create or replace function plp_runtime.plp_owner_document_complete(p_owner_id uuid,p_document_id uuid)
returns jsonb language plpgsql security invoker
set search_path=pg_catalog,plp_runtime,storage
as $$
declare
  v_doc plp_runtime.plp_owner_documents%rowtype;
  v_metadata jsonb;
  v_size bigint;
  v_mime text;
begin
  select * into v_doc from plp_runtime.plp_owner_documents
  where id=p_document_id and owner_id=p_owner_id for update;
  if not found or v_doc.status<>'pending_upload' then raise exception 'Pending owner document not found'; end if;
  select metadata into v_metadata from storage.objects
  where bucket_id='plp-owner-documents' and name=v_doc.storage_path;
  if not found then raise exception 'Uploaded object not found'; end if;
  v_size:=nullif(v_metadata->>'size','')::bigint;
  v_mime:=lower(coalesce(v_metadata->>'mimetype',''));
  if v_size is distinct from v_doc.size_bytes or v_mime<>lower(v_doc.mime_type) then
    raise exception 'Uploaded object metadata does not match the authorized file';
  end if;
  update plp_runtime.plp_owner_documents
    set status='uploaded',updated_at=now(),updated_by=p_owner_id
    where id=v_doc.id and owner_id=p_owner_id;
  insert into plp_runtime.plp_owner_document_events
    (document_id,owner_id,action,storage_path,original_name,mime_type,size_bytes,actor_id)
  values (v_doc.id,p_owner_id,'uploaded',v_doc.storage_path,v_doc.original_name,v_doc.mime_type,v_doc.size_bytes,p_owner_id);
  return jsonb_build_object('document_id',v_doc.id,'status','uploaded');
end $$;

create or replace function plp_runtime.plp_owner_document_fail(p_owner_id uuid,p_document_id uuid)
returns jsonb language plpgsql security invoker
set search_path=pg_catalog,plp_runtime
as $$
declare v_doc plp_runtime.plp_owner_documents%rowtype;
begin
  select * into v_doc from plp_runtime.plp_owner_documents
  where id=p_document_id and owner_id=p_owner_id for update;
  if not found or v_doc.status<>'pending_upload' then raise exception 'Pending owner document not found'; end if;
  update plp_runtime.plp_owner_documents set status='upload_failed',updated_at=now(),updated_by=p_owner_id
  where id=v_doc.id;
  insert into plp_runtime.plp_owner_document_events
    (document_id,owner_id,action,storage_path,original_name,mime_type,size_bytes,actor_id)
  values (v_doc.id,p_owner_id,'upload_failed',v_doc.storage_path,v_doc.original_name,v_doc.mime_type,v_doc.size_bytes,p_owner_id);
  return jsonb_build_object('document_id',v_doc.id,'status','upload_failed');
end $$;

create or replace function plp_runtime.plp_owner_archive_document(p_owner_id uuid,p_document_id uuid)
returns jsonb language plpgsql security invoker
set search_path=pg_catalog,plp_runtime
as $$
declare v_doc plp_runtime.plp_owner_documents%rowtype;
begin
  select * into v_doc from plp_runtime.plp_owner_documents
  where id=p_document_id and owner_id=p_owner_id for update;
  if not found or v_doc.status<>'uploaded' then raise exception 'Uploaded owner document not found'; end if;
  update plp_runtime.plp_owner_documents set status='archived',updated_at=now(),updated_by=p_owner_id
  where id=v_doc.id;
  insert into plp_runtime.plp_owner_document_events
    (document_id,owner_id,action,storage_path,original_name,mime_type,size_bytes,actor_id)
  values (v_doc.id,p_owner_id,'archived',v_doc.storage_path,v_doc.original_name,v_doc.mime_type,v_doc.size_bytes,p_owner_id);
  return jsonb_build_object('document_id',v_doc.id,'status','archived');
end $$;

revoke all on function plp_runtime.plp_owner_document_complete(uuid,uuid) from public,anon,authenticated;
revoke all on function plp_runtime.plp_owner_document_fail(uuid,uuid) from public,anon,authenticated;
revoke all on function plp_runtime.plp_owner_archive_document(uuid,uuid) from public,anon,authenticated;
grant execute on function plp_runtime.plp_owner_document_complete(uuid,uuid) to service_role;
grant execute on function plp_runtime.plp_owner_document_fail(uuid,uuid) to service_role;
grant execute on function plp_runtime.plp_owner_archive_document(uuid,uuid) to service_role;
