-- Restrict client-writable columns and prevent self-verification/status escalation.
begin;

drop policy if exists "users create own profile" on public.profiles;
revoke insert, update on public.profiles from authenticated;
grant update(display_name, phone, avatar_path, preferred_language) on public.profiles to authenticated;

-- User-created practitioner records always start unverified. Verification fields are server/compliance controlled.
drop policy if exists "practitioner owner insert" on public.practitioners;
create policy "practitioner owner insert pending" on public.practitioners for insert
with check (user_id = auth.uid() and verification_status = 'not_started' and profile_visibility = false and verified_at is null and verified_by is null);
revoke update on public.practitioners from authenticated;
grant update(public_name, biography, years_experience, accepts_remote_matters, profile_visibility) on public.practitioners to authenticated;

-- A practitioner may submit evidence, but cannot approve their own credential.
drop policy if exists "credentials owner submit" on public.practitioner_credentials;
create policy "credentials owner submit pending" on public.practitioner_credentials for insert
with check (
  verification_status = 'pending' and verified_at is null and verified_by is null
  and exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = auth.uid())
);

-- Firms created by users enter a pending state; verification is a compliance workflow.
drop policy if exists "firm creator insert" on public.law_firms;
create policy "firm creator insert pending" on public.law_firms for insert
with check (created_by = auth.uid() and verification_status = 'pending' and status = 'pending');

-- Client intake is draft-only. Submission, matching consent timestamps and status transitions
-- are performed by trusted server workflows after validating consent and required fields.
drop policy if exists "client creates matter" on public.legal_matters;
create policy "client creates draft matter" on public.legal_matters for insert
with check (client_user_id = auth.uid() and status = 'draft' and matching_consent_at is null and submitted_at is null);
revoke update on public.legal_matters from authenticated;
grant update(title, public_summary, confidential_details, province_id, municipality_id, place_id, consultation_mode, urgency) on public.legal_matters to authenticated;

commit;
