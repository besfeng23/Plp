# PLP owner private document vault

Files uploaded through Doctora's verified owner session are stored in the private Supabase Storage bucket `plp-owner-documents`. No public bucket URL or anonymous file policy is created.

Allowed types: PDF, DOCX, XLSX, PPTX, CSV, TXT, PNG and JPEG. Maximum file size: 8 MiB. Both the browser and server validate the extension, MIME type and size; the Storage bucket enforces the same size/type limits.

The server generates a unique owner-scoped path and a one-time signed upload URL. Supabase signed upload URLs are valid for two hours. The browser uploads directly to that path without receiving the service-role key. A server-side completion function verifies the stored object metadata before marking the file uploaded.

Downloads are issued only after checking the document belongs to the verified owner; signed download URLs expire after five minutes. The owner may archive a file, which hides it from the active register but does not physically delete the object. This preserves the audit history and avoids destructive deletion.

Audit events record upload request, upload completion/failure, download-link issuance and archive. No file content or signed token is stored in the database. Document metadata is linked optionally to an existing owner register item and a location chapter.

The bucket has no public access policy. Metadata/audit tables have RLS enabled and service-role-only privileges; browser requests are routed through the owner-authenticated API.
