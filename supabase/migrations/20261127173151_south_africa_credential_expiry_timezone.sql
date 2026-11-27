-- Use South African local calendar dates for credential expiry decisions.
-- This keeps the server-side eligibility check aligned with the credential UI.

create or replace function private.has_current_practitioner_credential(
  target_practitioner uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.practitioner_credentials as c
    where c.practitioner_id = target_practitioner
      and c.credential_type in (
        'lpc_registration',
        'candidate_registration',
        'admission'
      )
      and c.verification_status = 'verified'
      and (
        c.expires_at is null
        or c.expires_at >= pg_catalog.timezone('Africa/Johannesburg', pg_catalog.now())::date
      )
  );
$function$;

create or replace function public.review_practitioner_credential(
  target_credential uuid,
  decision text,
  expiry date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  c public.practitioner_credentials%rowtype;
  effective_expiry date;
  south_african_today date;
begin
  if auth.uid() is null
     or not (
       public.has_role('compliance_officer'::public.membership_role)
       or public.is_super_admin()
     ) then
    raise exception 'Compliance permission required' using errcode = '42501';
  end if;

  if decision not in ('verified', 'rejected') then
    raise exception 'Invalid review decision' using errcode = '22023';
  end if;

  select *
  into c
  from public.practitioner_credentials
  where id = target_credential
  for update;

  if not found then
    raise exception 'Credential not found' using errcode = 'P0002';
  end if;

  effective_expiry := coalesce(expiry, c.expires_at);
  south_african_today := pg_catalog.timezone('Africa/Johannesburg', pg_catalog.now())::date;

  if decision = 'verified' then
    if exists (
      select 1
      from public.practitioners as p
      where p.id = c.practitioner_id
        and p.user_id = auth.uid()
    ) then
      raise exception 'Practitioners cannot verify their own credentials' using errcode = '42501';
    end if;

    if c.credential_type is null
       or c.credential_type not in (
         'lpc_registration',
         'candidate_registration',
         'admission',
         'ffc'
       )
       or c.registration_number_encrypted is null
       or pg_catalog.btrim(c.registration_number_encrypted) = ''
       or c.issuing_body is null
       or pg_catalog.btrim(c.issuing_body) = '' then
      raise exception 'Credential is missing required verification evidence' using errcode = '22023';
    end if;

    if c.credential_type = 'ffc' then
      if pg_catalog.lower(pg_catalog.btrim(c.issuing_body)) <> 'legal practice council' then
        raise exception 'Fidelity Fund Certificates must be issued by the Legal Practice Council' using errcode = '22023';
      end if;

      if effective_expiry is null then
        raise exception 'Fidelity Fund Certificates must include their annual expiry date' using errcode = '22023';
      end if;
    end if;

    if effective_expiry is not null and effective_expiry < south_african_today then
      raise exception 'Credential is already expired' using errcode = '22023';
    end if;
  end if;

  update public.practitioner_credentials
  set
    verification_status = decision::public.verification_status,
    verified_at = case when decision = 'verified' then now() else null end,
    verified_by = auth.uid(),
    expires_at = coalesce(expiry, expires_at)
  where id = target_credential;

  insert into public.audit_events (
    actor_user_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    auth.uid(),
    'credential.reviewed',
    'practitioner_credential',
    target_credential::text,
    jsonb_build_object('decision', decision)
  );
end;
$function$;
