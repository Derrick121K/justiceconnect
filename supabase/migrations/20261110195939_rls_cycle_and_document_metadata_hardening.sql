-- JusticeConnect database hardening.
-- Breaks the practitioner/credential RLS dependency cycle and protects
-- server-controlled matter-document scan and sharing metadata.

begin;

-- This schema is intentionally not exposed through the Supabase Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;

create or replace function private.has_current_practitioner_credential(target_practitioner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.practitioner_credentials c
    where c.practitioner_id = target_practitioner
      and c.credential_type in ('lpc_registration', 'candidate_registration', 'admission')
      and c.verification_status = 'verified'
      and (c.expires_at is null or c.expires_at >= current_date)
  );
$$;

revoke all on function private.has_current_practitioner_credential(uuid) from public, anon, authenticated;
grant execute on function private.has_current_practitioner_credential(uuid) to anon, authenticated;

-- Credential records are visible only to their owner and compliance staff.
-- Practitioner visibility now calls a narrow SECURITY DEFINER boolean helper,
-- which avoids recursive RLS evaluation between these two tables.
drop policy if exists "credentials owner or compliance" on public.practitioner_credentials;
create policy "credentials owner or compliance"
  on public.practitioner_credentials
  for select to authenticated
  using (
    exists (
      select 1
      from public.practitioners p
      where p.id = practitioner_credentials.practitioner_id
        and p.user_id = (select auth.uid())
    )
    or public.has_role('compliance_officer'::public.membership_role)
    or public.is_super_admin()
  );

-- Public practitioner discovery requires a current, compliance-verified credential.
drop policy if exists "practitioner public verified profiles" on public.practitioners;
create policy "practitioner public verified profiles"
  on public.practitioners
  for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or public.is_super_admin()
    or (
      profile_visibility = true
      and verification_status = 'verified'
      and private.has_current_practitioner_credential(id)
    )
  );

drop policy if exists "practitioner practice areas readable" on public.practitioner_practice_areas;
create policy "practitioner practice areas readable"
  on public.practitioner_practice_areas
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.practitioners p
      where p.id = practitioner_id and p.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.practitioners p
      where p.id = practitioner_id
        and p.profile_visibility = true
        and p.verification_status = 'verified'
        and private.has_current_practitioner_credential(p.id)
    )
  );

drop policy if exists "service areas readable" on public.practitioner_service_areas;
create policy "service areas readable"
  on public.practitioner_service_areas
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.practitioners p
      where p.id = practitioner_id and p.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.practitioners p
      where p.id = practitioner_id
        and p.profile_visibility = true
        and p.verification_status = 'verified'
        and private.has_current_practitioner_credential(p.id)
    )
  );

-- Scan status and disclosure visibility are server-controlled. Authenticated
-- clients can insert only the file metadata columns. Database defaults keep new
-- documents pending and client-only, and no client UPDATE is granted.
drop policy if exists "client uploads own matter documents" on public.matter_documents;
create policy "client uploads own matter documents"
  on public.matter_documents
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and malware_scan_status = 'pending'
    and visibility = 'client_only'
    and exists (
      select 1 from public.legal_matters m
      where m.id = matter_documents.matter_id
        and m.client_user_id = (select auth.uid())
    )
  );

revoke insert, update on public.matter_documents from public, anon, authenticated;
grant insert (matter_id, uploaded_by, storage_path, original_filename, mime_type, size_bytes)
  on public.matter_documents to authenticated;

commit;
