-- JCStudio: private legal-practice management connected to JusticeConnect.
-- Marketplace enquiries remain separate. Conversion is only allowed from an active mandate.
begin;

create table public.practice_matters (
  id uuid primary key default gen_random_uuid(),
  matter_number text not null unique default ('JCS-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10))),
  firm_id uuid references public.law_firms(id) on delete restrict,
  source_mandate_id uuid unique references public.mandates(id) on delete restrict,
  source_marketplace_matter_id uuid references public.legal_matters(id) on delete restrict,
  client_user_id uuid references public.profiles(id) on delete restrict,
  client_name text not null check (length(client_name) between 2 and 160),
  client_email citext,
  title text not null check (length(title) between 8 and 180),
  practice_area text not null default 'General' check (length(practice_area) between 2 and 120),
  confidential_description text,
  status text not null default 'open' check (status in ('open','on_hold','awaiting_client','awaiting_court','completed','closed','archived')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  confidentiality text not null default 'restricted' check (confidentiality in ('standard','restricted','highly_restricted')),
  opened_on date not null default (timezone('Africa/Johannesburg', now())::date),
  due_on date,
  closed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  responsible_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_mandate_id is null or source_marketplace_matter_id is not null)
);
create index practice_matters_firm_status_idx on public.practice_matters(firm_id, status, updated_at desc);
create index practice_matters_responsible_idx on public.practice_matters(responsible_user_id, status, updated_at desc);
create index practice_matters_due_idx on public.practice_matters(due_on) where status not in ('completed','closed','archived');

create table public.practice_matter_members (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.practice_matters(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  permission text not null default 'read' check (permission in ('read','edit','manage','billing')),
  active boolean not null default true,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(matter_id, user_id)
);
create index practice_matter_members_user_idx on public.practice_matter_members(user_id, active, matter_id);

create table public.practice_matter_notes (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.practice_matters(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  note_type text not null default 'attendance' check (note_type in ('attendance','research','strategy','client_instruction','internal')),
  body text not null check (length(body) between 1 and 30000),
  visibility text not null default 'internal' check (visibility = 'internal'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index practice_matter_notes_matter_idx on public.practice_matter_notes(matter_id, created_at desc);

create table public.practice_tasks (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.practice_matters(id) on delete cascade,
  title text not null check (length(title) between 2 and 200),
  description text,
  task_type text not null default 'general' check (task_type in ('general','document','research','client_follow_up','court_filing','billing','review')),
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index practice_tasks_assignee_idx on public.practice_tasks(assigned_to, status, due_at);
create index practice_tasks_matter_idx on public.practice_tasks(matter_id, status, due_at);

create table public.practice_events (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.practice_matters(id) on delete cascade,
  title text not null check (length(title) between 2 and 200),
  event_type text not null default 'meeting' check (event_type in ('court','consultation','deadline','meeting','reminder','filing','other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null default 'Africa/Johannesburg',
  location text,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index practice_events_calendar_idx on public.practice_events(starts_at, status);
create index practice_events_matter_idx on public.practice_events(matter_id, starts_at);

create table public.practice_time_entries (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.practice_matters(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  work_date date not null default (timezone('Africa/Johannesburg', now())::date),
  description text not null check (length(description) between 3 and 1000),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  billable boolean not null default true,
  rate_minor bigint check (rate_minor is null or rate_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index practice_time_entries_matter_idx on public.practice_time_entries(matter_id, work_date desc);
create index practice_time_entries_user_idx on public.practice_time_entries(user_id, work_date desc);

create table public.practice_documents (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.practice_matters(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  storage_bucket text not null default 'jcstudio-private' check (storage_bucket = 'jcstudio-private'),
  storage_path text not null unique,
  original_filename text not null check (length(original_filename) between 1 and 255),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 104857600),
  version_number integer not null default 1 check (version_number > 0),
  scan_status text not null default 'pending' check (scan_status in ('pending','clean','infected','error')),
  created_at timestamptz not null default now()
);
create index practice_documents_matter_idx on public.practice_documents(matter_id, created_at desc);

create table public.practice_invoices (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.practice_matters(id) on delete restrict,
  invoice_number text not null unique default ('JCS-INV-' || upper(substr(encode(gen_random_bytes(7), 'hex'), 1, 10))),
  status text not null default 'draft' check (status in ('draft','issued','partially_paid','paid','void','overdue')),
  client_name text not null check (length(client_name) between 2 and 160),
  client_email citext,
  issue_date date,
  due_date date,
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0 and total_minor = subtotal_minor + tax_minor),
  external_payment_reference text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index practice_invoices_matter_idx on public.practice_invoices(matter_id, status, created_at desc);

create table public.practice_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.practice_invoices(id) on delete cascade,
  description text not null check (length(description) between 2 and 500),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0),
  created_at timestamptz not null default now()
);
create index practice_invoice_items_invoice_idx on public.practice_invoice_items(invoice_id);

create or replace function private.can_access_practice_matter(target_matter uuid)
returns boolean language sql stable security definer set search_path = ''
as $$$
  select auth.uid() is not null
    and exists (select 1 from public.profiles account where account.id = auth.uid() and account.status = 'active')
    and exists (
      select 1 from public.practice_matters m
      where m.id = target_matter and (
        exists (
          select 1 from public.practice_matter_members mm
          where mm.matter_id = m.id and mm.user_id = auth.uid() and mm.active
            and mm.permission in ('read','edit','manage')
        )
        or (m.firm_id is not null and exists (
          select 1 from public.firm_members fm
          join public.law_firms f on f.id = fm.firm_id
          where fm.firm_id = m.firm_id and fm.user_id = auth.uid()
            and fm.status = 'active' and fm.firm_role in ('owner','administrator')
            and f.status = 'active' and f.verification_status = 'verified'
        ))
      )
    );
$$;

create or replace function private.can_edit_practice_matter(target_matter uuid)
returns boolean language sql stable security definer set search_path = ''
as $$$
  select auth.uid() is not null
    and exists (select 1 from public.profiles account where account.id = auth.uid() and account.status = 'active')
    and exists (
      select 1 from public.practice_matters m
      where m.id = target_matter and (
        exists (
          select 1 from public.practice_matter_members mm
          where mm.matter_id = m.id and mm.user_id = auth.uid() and mm.active
            and mm.permission in ('edit','manage')
        )
        or (m.firm_id is not null and exists (
          select 1 from public.firm_members fm
          join public.law_firms f on f.id = fm.firm_id
          where fm.firm_id = m.firm_id and fm.user_id = auth.uid()
            and fm.status = 'active' and fm.firm_role in ('owner','administrator')
            and f.status = 'active' and f.verification_status = 'verified'
        ))
      )
    );
$$;

create or replace function private.can_manage_practice_matter(target_matter uuid)
returns boolean language sql stable security definer set search_path = ''
as $$$
  select auth.uid() is not null
    and exists (select 1 from public.profiles account where account.id = auth.uid() and account.status = 'active')
    and exists (
      select 1 from public.practice_matters m
      where m.id = target_matter and (
        exists (
          select 1 from public.practice_matter_members mm
          where mm.matter_id = m.id and mm.user_id = auth.uid() and mm.active
            and mm.permission = 'manage'
        )
        or (m.firm_id is not null and exists (
          select 1 from public.firm_members fm
          join public.law_firms f on f.id = fm.firm_id
          where fm.firm_id = m.firm_id and fm.user_id = auth.uid()
            and fm.status = 'active' and fm.firm_role in ('owner','administrator')
            and f.status = 'active' and f.verification_status = 'verified'
        ))
      )
    );
$$;

create or replace function private.can_bill_practice_matter(target_matter uuid)
returns boolean language sql stable security definer set search_path = ''
as $$$
  select auth.uid() is not null
    and exists (select 1 from public.profiles account where account.id = auth.uid() and account.status = 'active')
    and exists (
      select 1 from public.practice_matters m
      where m.id = target_matter and (
        exists (
          select 1 from public.practice_matter_members mm
          where mm.matter_id = m.id and mm.user_id = auth.uid() and mm.active
            and (
              mm.permission in ('billing','manage')
              or (m.responsible_user_id = auth.uid() and mm.permission = 'edit')
            )
        )
        or (m.firm_id is not null and exists (
          select 1 from public.firm_members fm
          join public.law_firms f on f.id = fm.firm_id
          where fm.firm_id = m.firm_id and fm.user_id = auth.uid()
            and fm.status = 'active' and fm.firm_role in ('owner','administrator')
            and f.status = 'active' and f.verification_status = 'verified'
        ))
      )
    );
$$;

revoke all on function private.can_access_practice_matter(uuid) from public, anon;
revoke all on function private.can_edit_practice_matter(uuid) from public, anon;
revoke all on function private.can_manage_practice_matter(uuid) from public, anon;
revoke all on function private.can_bill_practice_matter(uuid) from public, anon;
grant execute on function private.can_access_practice_matter(uuid) to authenticated, service_role;
grant execute on function private.can_edit_practice_matter(uuid) to authenticated, service_role;
grant execute on function private.can_manage_practice_matter(uuid) to authenticated, service_role;
grant execute on function private.can_bill_practice_matter(uuid) to authenticated, service_role;

create or replace function private.guard_practice_matter_update()
returns trigger language plpgsql set search_path = ''
as $$$
begin
  if new.firm_id is distinct from old.firm_id
    or new.source_mandate_id is distinct from old.source_mandate_id
    or new.source_marketplace_matter_id is distinct from old.source_marketplace_matter_id
    or new.client_user_id is distinct from old.client_user_id
    or new.created_by is distinct from old.created_by then
    raise exception 'Matter tenant, source and ownership fields are immutable' using errcode = '42501';
  end if;
  if new.responsible_user_id is distinct from old.responsible_user_id
    and not exists (
      select 1 from public.practitioners pr
      where pr.user_id = new.responsible_user_id
        and pr.verification_status = 'verified' and pr.profile_visibility = true
        and private.has_current_practitioner_credential(pr.id)
        and (new.firm_id is null or exists (
          select 1 from public.firm_members fm
          where fm.firm_id = new.firm_id and fm.user_id = new.responsible_user_id and fm.status = 'active'
        ))
    ) then
    raise exception 'Responsible practitioner must have current verified eligibility and active firm membership' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.audit_practice_change()
returns trigger language plpgsql security definer set search_path = ''
as $$$
declare payload jsonb; record_id text; org_id uuid; actor_id uuid;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  record_id := payload ->> 'id';
  org_id := nullif(payload ->> 'firm_id','')::uuid;
  if org_id is null and nullif(payload ->> 'matter_id','') is not null then
    select m.firm_id into org_id from public.practice_matters m where m.id = (payload ->> 'matter_id')::uuid;
  elsif org_id is null and nullif(payload ->> 'invoice_id','') is not null then
    select m.firm_id into org_id from public.practice_invoices i
      join public.practice_matters m on m.id = i.matter_id
      where i.id = (payload ->> 'invoice_id')::uuid;
  end if;
  actor_id := auth.uid();
  insert into public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  values(actor_id, org_id, 'jcstudio.' || tg_table_name || '.' || lower(tg_op),
    tg_table_name, record_id, jsonb_build_object('module','jcstudio','record_id',record_id));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.audit_practice_change() from public, anon, authenticated;

create trigger practice_matters_guard_update before update on public.practice_matters
for each row execute function private.guard_practice_matter_update();

create trigger practice_matters_audit after insert or update on public.practice_matters
for each row execute function private.audit_practice_change();
create trigger practice_matter_members_audit after insert or update or delete on public.practice_matter_members
for each row execute function private.audit_practice_change();
create trigger practice_matter_notes_audit after insert or update or delete on public.practice_matter_notes
for each row execute function private.audit_practice_change();
create trigger practice_tasks_audit after insert or update or delete on public.practice_tasks
for each row execute function private.audit_practice_change();
create trigger practice_events_audit after insert or update or delete on public.practice_events
for each row execute function private.audit_practice_change();
create trigger practice_time_entries_audit after insert or update or delete on public.practice_time_entries
for each row execute function private.audit_practice_change();
create trigger practice_documents_audit after insert or update or delete on public.practice_documents
for each row execute function private.audit_practice_change();
create trigger practice_invoices_audit after insert or update on public.practice_invoices
for each row execute function private.audit_practice_change();
create trigger practice_invoice_items_audit after insert or update or delete on public.practice_invoice_items
for each row execute function private.audit_practice_change();

create or replace function private.revoke_practice_matter_access_for_firm_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare target_firm uuid; target_user uuid;
begin
  if tg_table_name = 'firm_members' then
    target_firm := old.firm_id;
    target_user := old.user_id;
    if tg_op = 'UPDATE' and new.status = 'active' then
      return new;
    end if;
    update public.practice_matter_members mm
      set active = false
      from public.practice_matters m
      where m.id = mm.matter_id and m.firm_id = target_firm
        and mm.user_id = target_user and mm.active;
  elsif tg_table_name = 'law_firms' then
    target_firm := old.id;
    if tg_op = 'UPDATE' and new.status = 'active' and new.verification_status = 'verified' then
      return new;
    end if;
    update public.practice_matter_members mm
      set active = false
      from public.practice_matters m
      where m.id = mm.matter_id and m.firm_id = target_firm and mm.active;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.revoke_practice_matter_access_for_firm_change() from public, anon, authenticated;
create trigger firm_members_revoke_practice_access
  after update of status or delete on public.firm_members
  for each row execute function private.revoke_practice_matter_access_for_firm_change();
create trigger law_firms_revoke_practice_access
  after update of status, verification_status on public.law_firms
  for each row execute function private.revoke_practice_matter_access_for_firm_change();

create or replace function public.list_qualified_firm_practitioners(target_firm uuid)
returns table(user_id uuid, display_name text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.firm_members fm
    join public.law_firms f on f.id = fm.firm_id
    join public.profiles requester on requester.id = fm.user_id
    where requester.status = 'active' and fm.firm_id = target_firm and fm.user_id = auth.uid()
      and fm.status = 'active' and fm.firm_role in ('owner','administrator')
      and f.status = 'active' and f.verification_status = 'verified'
  ) then
    raise exception 'Verified firm administrator access is required' using errcode = '42501';
  end if;

  return query
  select fm.user_id, p.display_name
  from public.firm_members fm
  join public.practitioners pr on pr.user_id = fm.user_id
  join public.profiles p on p.id = fm.user_id and p.status = 'active'
  where fm.firm_id = target_firm and fm.status = 'active'
    and p.status = 'active'
    and pr.verification_status = 'verified' and pr.profile_visibility = true
    and private.has_current_practitioner_credential(pr.id)
  order by p.display_name;
end;
$$;
revoke all on function public.list_qualified_firm_practitioners(uuid) from public, anon;
grant execute on function public.list_qualified_firm_practitioners(uuid) to authenticated;

create or replace function public.create_practice_matter(
  target_title text,
  target_client_name text,
  target_client_email text default null,
  target_practice_area text default 'General',
  target_description text default null,
  target_firm_id uuid default null,
  target_due_on date default null,
  target_priority text default 'normal',
  target_source_mandate_id uuid default null,
  target_responsible_user_id uuid default null
)
returns table(practice_matter_id uuid, matter_number text)
language plpgsql security definer set search_path = ''
as $$$
declare
  actor uuid := auth.uid();
  firm_role text;
  practitioner_id uuid;
  practitioner_user uuid;
  responsible_user uuid;
  mandate_row public.mandates%rowtype;
  marketplace_row public.legal_matters%rowtype;
  client_row public.profiles%rowtype;
  created_id uuid;
  created_number text;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles p where p.id = actor and p.status = 'active') then
    raise exception 'An active account is required to use JCStudio' using errcode = '42501';
  end if;
  if target_priority not in ('low','normal','high','urgent') then raise exception 'Invalid priority' using errcode = '22023'; end if;
  if length(coalesce(target_title,'')) < 8 or length(target_title) > 180
    or length(coalesce(target_client_name,'')) < 2 or length(target_client_name) > 160
    or length(coalesce(target_practice_area,'General')) < 2 or length(coalesce(target_practice_area,'General')) > 120
    or length(coalesce(target_description,'')) > 30000 then
    raise exception 'Matter details are invalid' using errcode = '22023';
  end if;

  if target_source_mandate_id is not null then
    select * into mandate_row from public.mandates
    where id = target_source_mandate_id for update;
    if not found or mandate_row.engagement_status <> 'active' then
      raise exception 'Only an active, accepted mandate can enter JCStudio' using errcode = '42501';
    end if;
    if target_firm_id is distinct from mandate_row.firm_id then
      raise exception 'The Studio firm must match the accepted mandate' using errcode = '42501';
    end if;
    select * into marketplace_row from public.legal_matters
    where id = mandate_row.matter_id and client_user_id = mandate_row.client_user_id;
    if not found then raise exception 'The linked client enquiry could not be verified' using errcode = 'P0002'; end if;
    select * into client_row from public.profiles where id = marketplace_row.client_user_id;
    target_client_name := client_row.display_name;
    target_client_email := client_row.email::text;
    target_title := marketplace_row.title;
  end if;

  if target_firm_id is null then
    select p.id, p.user_id into practitioner_id, practitioner_user
    from public.practitioners p
    where p.user_id = actor and p.verification_status = 'verified' and p.profile_visibility = true;
    if practitioner_id is null or not exists (
      select 1 from public.practitioner_credentials c
      where c.practitioner_id = practitioner_id
        and c.credential_type in ('lpc_registration','candidate_registration','admission')
        and c.verification_status = 'verified'
        and (c.expires_at is null or c.expires_at >= timezone('Africa/Johannesburg', now())::date)
    ) then raise exception 'A current verified practitioner profile and qualifying credential are required' using errcode = '42501'; end if;
    if target_source_mandate_id is not null and mandate_row.practitioner_id is distinct from practitioner_id then
      raise exception 'This accepted mandate belongs to a different practitioner' using errcode = '42501';
    end if;
    responsible_user := actor;
  else
    select fm.firm_role into firm_role
    from public.firm_members fm
    join public.law_firms f on f.id = fm.firm_id
    where fm.firm_id = target_firm_id and fm.user_id = actor
      and fm.status = 'active' and fm.firm_role in ('owner','administrator','practitioner')
      and f.status = 'active' and f.verification_status = 'verified';
    if firm_role is null then raise exception 'Active verified firm membership is required' using errcode = '42501'; end if;
    if firm_role = 'practitioner' then
      select p.id into practitioner_id from public.practitioners p
      where p.user_id = actor and p.verification_status = 'verified' and p.profile_visibility = true
        and exists (
          select 1 from public.practitioner_credentials c
          where c.practitioner_id = p.id
            and c.credential_type in ('lpc_registration','candidate_registration','admission')
            and c.verification_status = 'verified'
            and (c.expires_at is null or c.expires_at >= timezone('Africa/Johannesburg', now())::date)
        );
      if practitioner_id is null then raise exception 'A current verified practitioner profile is required for practitioners' using errcode = '42501'; end if;
      if target_source_mandate_id is not null and mandate_row.practitioner_id is distinct from practitioner_id then
        raise exception 'This accepted mandate belongs to a different practitioner' using errcode = '42501';
      end if;
      responsible_user := actor;
    elsif target_source_mandate_id is not null then
      select p.user_id, p.id into practitioner_user, practitioner_id
      from public.practitioners p
      join public.profiles active_profile on active_profile.id = p.user_id and active_profile.status = 'active'
      where p.id = mandate_row.practitioner_id
        and p.verification_status = 'verified' and p.profile_visibility = true
        and exists (
          select 1 from public.practitioner_credentials c
          where c.practitioner_id = p.id
            and c.credential_type in ('lpc_registration','candidate_registration','admission')
            and c.verification_status = 'verified'
            and (c.expires_at is null or c.expires_at >= timezone('Africa/Johannesburg', now())::date)
        );
      if practitioner_user is null or not exists (
        select 1 from public.firm_members fm
        where fm.firm_id = target_firm_id and fm.user_id = practitioner_user and fm.status = 'active'
      ) then raise exception 'Mandated practitioner must be a verified active member of this firm' using errcode = '42501'; end if;
      responsible_user := practitioner_user;
    else
      if target_responsible_user_id is null then
        raise exception 'Select a responsible verified practitioner for this firm matter' using errcode = '22023';
      end if;
      select p.user_id, p.id into practitioner_user, practitioner_id
      from public.practitioners p
      join public.profiles active_profile on active_profile.id = p.user_id and active_profile.status = 'active'
      join public.firm_members fm on fm.user_id = p.user_id
      where p.user_id = target_responsible_user_id and fm.firm_id = target_firm_id
        and fm.status = 'active' and p.verification_status = 'verified' and p.profile_visibility = true
        and exists (
          select 1 from public.practitioner_credentials c
          where c.practitioner_id = p.id
            and c.credential_type in ('lpc_registration','candidate_registration','admission')
            and c.verification_status = 'verified'
            and (c.expires_at is null or c.expires_at >= timezone('Africa/Johannesburg', now())::date)
        );
      if practitioner_user is null then raise exception 'Responsible practitioner must be a verified member with a current qualifying credential' using errcode = '42501'; end if;
      responsible_user := practitioner_user;
    end if;
  end if;

  insert into public.practice_matters(
    firm_id, source_mandate_id, source_marketplace_matter_id, client_user_id,
    client_name, client_email, title, practice_area, confidential_description,
    priority, due_on, created_by, responsible_user_id
  ) values (
    target_firm_id, target_source_mandate_id,
    case when target_source_mandate_id is null then null else marketplace_row.id end,
    case when target_source_mandate_id is null then null else marketplace_row.client_user_id end,
    target_client_name, nullif(target_client_email,''), target_title,
    coalesce(nullif(target_practice_area,''),'General'), nullif(target_description,''),
    target_priority, target_due_on, actor, responsible_user
  ) returning id, public.practice_matters.matter_number into created_id, created_number;

  insert into public.practice_matter_members(matter_id,user_id,permission,added_by)
  values(created_id, actor, 'manage', actor)
  on conflict (matter_id,user_id) do nothing;
  if responsible_user is distinct from actor then
    insert into public.practice_matter_members(matter_id,user_id,permission,added_by)
    values(created_id, responsible_user, 'edit', actor)
    on conflict (matter_id,user_id) do nothing;
  end if;

  return query select created_id, created_number;
end;
$$;
revoke all on function public.create_practice_matter(text,text,text,text,text,uuid,date,text,uuid,uuid) from public, anon;
grant execute on function public.create_practice_matter(text,text,text,text,text,uuid,date,text,uuid,uuid) to authenticated;

alter table public.practice_matters enable row level security;
alter table public.practice_matter_members enable row level security;
alter table public.practice_matter_notes enable row level security;
alter table public.practice_tasks enable row level security;
alter table public.practice_events enable row level security;
alter table public.practice_time_entries enable row level security;
alter table public.practice_documents enable row level security;
alter table public.practice_invoices enable row level security;
alter table public.practice_invoice_items enable row level security;

revoke all on public.practice_matters, public.practice_matter_members, public.practice_matter_notes,
  public.practice_tasks, public.practice_events, public.practice_time_entries,
  public.practice_documents, public.practice_invoices, public.practice_invoice_items from public, anon;
grant select on public.practice_matters to authenticated;
grant select, insert, update, delete on public.practice_matter_members to authenticated;
grant select, insert, update, delete on public.practice_matter_notes, public.practice_tasks,
  public.practice_events, public.practice_time_entries to authenticated;
grant select, insert, delete on public.practice_documents to authenticated;
grant select, insert, update on public.practice_invoices to authenticated;
grant select, insert, update, delete on public.practice_invoice_items to authenticated;
grant all on public.practice_matters, public.practice_matter_members, public.practice_matter_notes,
  public.practice_tasks, public.practice_events, public.practice_time_entries,
  public.practice_documents, public.practice_invoices, public.practice_invoice_items to service_role;

create policy "studio members read matters" on public.practice_matters
  for select to authenticated using (private.can_access_practice_matter(id));
create policy "studio members read matter team" on public.practice_matter_members
  for select to authenticated using (private.can_access_practice_matter(matter_id));
create policy "studio managers add matter team" on public.practice_matter_members
  for insert to authenticated with check (
    private.can_manage_practice_matter(matter_id) and exists (
      select 1 from public.practice_matters m
      where m.id = matter_id and (
        (m.firm_id is not null and exists (
          select 1 from public.firm_members fm
          where fm.firm_id = m.firm_id and fm.user_id = practice_matter_members.user_id and fm.status = 'active'
        ))
        or (m.firm_id is null and user_id = auth.uid())
      )
    )
  );
create policy "studio managers update matter team" on public.practice_matter_members
  for update to authenticated using (private.can_manage_practice_matter(matter_id))
  with check (
    private.can_manage_practice_matter(matter_id) and exists (
      select 1 from public.practice_matters m
      where m.id = matter_id and (
        (m.firm_id is not null and exists (
          select 1 from public.firm_members fm
          where fm.firm_id = m.firm_id and fm.user_id = practice_matter_members.user_id and fm.status = 'active'
        ))
        or (m.firm_id is null and user_id = auth.uid())
      )
    )
  );
create policy "studio managers remove matter team" on public.practice_matter_members
  for delete to authenticated using (private.can_manage_practice_matter(matter_id));

create policy "studio members read internal notes" on public.practice_matter_notes
  for select to authenticated using (visibility = 'internal' and private.can_access_practice_matter(matter_id));
create policy "studio editors create internal notes" on public.practice_matter_notes
  for insert to authenticated with check (author_user_id = auth.uid() and private.can_edit_practice_matter(matter_id));
create policy "studio authors update internal notes" on public.practice_matter_notes
  for update to authenticated using (author_user_id = auth.uid() and private.can_edit_practice_matter(matter_id))
  with check (author_user_id = auth.uid() and private.can_edit_practice_matter(matter_id));
create policy "studio authors or managers delete internal notes" on public.practice_matter_notes
  for delete to authenticated using ((author_user_id = auth.uid() or private.can_manage_practice_matter(matter_id))
    and private.can_edit_practice_matter(matter_id));

create policy "studio members read tasks" on public.practice_tasks
  for select to authenticated using (private.can_access_practice_matter(matter_id));
create policy "studio editors create tasks" on public.practice_tasks
  for insert to authenticated with check (
    created_by = auth.uid() and private.can_edit_practice_matter(matter_id)
    and (assigned_to is null or assigned_to = auth.uid() or exists (
      select 1 from public.practice_matter_members mm
      where mm.matter_id = practice_tasks.matter_id and mm.user_id = practice_tasks.assigned_to and mm.active
    ))
  );
create policy "studio editors update tasks" on public.practice_tasks
  for update to authenticated using (private.can_edit_practice_matter(matter_id))
  with check (private.can_edit_practice_matter(matter_id)
    and (assigned_to is null or assigned_to = auth.uid() or exists (
      select 1 from public.practice_matter_members mm
      where mm.matter_id = practice_tasks.matter_id and mm.user_id = practice_tasks.assigned_to and mm.active
    ))
  );
create policy "studio editors delete tasks" on public.practice_tasks
  for delete to authenticated using (private.can_manage_practice_matter(matter_id));

create policy "studio members read events" on public.practice_events
  for select to authenticated using (private.can_access_practice_matter(matter_id));
create policy "studio editors create events" on public.practice_events
  for insert to authenticated with check (created_by = auth.uid() and private.can_edit_practice_matter(matter_id));
create policy "studio editors update events" on public.practice_events
  for update to authenticated using (private.can_edit_practice_matter(matter_id))
  with check (private.can_edit_practice_matter(matter_id));
create policy "studio managers delete events" on public.practice_events
  for delete to authenticated using (private.can_manage_practice_matter(matter_id));

create policy "studio members read time entries" on public.practice_time_entries
  for select to authenticated using (private.can_access_practice_matter(matter_id));
create policy "studio members create own time" on public.practice_time_entries
  for insert to authenticated with check (user_id = auth.uid() and private.can_edit_practice_matter(matter_id));
create policy "studio users update own time" on public.practice_time_entries
  for update to authenticated using ((user_id = auth.uid() or private.can_manage_practice_matter(matter_id))
    and private.can_edit_practice_matter(matter_id))
  with check ((user_id = auth.uid() or private.can_manage_practice_matter(matter_id))
    and private.can_edit_practice_matter(matter_id));
create policy "studio users delete own time" on public.practice_time_entries
  for delete to authenticated using ((user_id = auth.uid() or private.can_manage_practice_matter(matter_id))
    and private.can_edit_practice_matter(matter_id));

create policy "studio members read document records" on public.practice_documents
  for select to authenticated using (private.can_access_practice_matter(matter_id));
create policy "studio editors add document records" on public.practice_documents
  for insert to authenticated with check (
    uploaded_by = auth.uid() and scan_status = 'pending'
    and storage_bucket = 'jcstudio-private'
    and private.can_edit_practice_matter(matter_id)
  );
create policy "studio managers delete document records" on public.practice_documents
  for delete to authenticated using (private.can_manage_practice_matter(matter_id));

create policy "studio billing roles read invoices" on public.practice_invoices
  for select to authenticated using (private.can_bill_practice_matter(matter_id));
create policy "studio billing roles create invoices" on public.practice_invoices
  for insert to authenticated with check (
    created_by = auth.uid() and status = 'draft'
    and issue_date is null and external_payment_reference is null
    and private.can_bill_practice_matter(matter_id)
  );
create policy "studio billing roles update draft invoices" on public.practice_invoices
  for update to authenticated using (private.can_bill_practice_matter(matter_id) and status = 'draft')
  with check (private.can_bill_practice_matter(matter_id) and status = 'draft');

create policy "studio billing roles read invoice items" on public.practice_invoice_items
  for select to authenticated using (exists (
    select 1 from public.practice_invoices i
    where i.id = invoice_id and private.can_bill_practice_matter(i.matter_id)
  ));
create policy "studio billing roles add invoice items" on public.practice_invoice_items
  for insert to authenticated with check (exists (
    select 1 from public.practice_invoices i
    where i.id = invoice_id and private.can_bill_practice_matter(i.matter_id) and i.status = 'draft'
  ));
create policy "studio billing roles update invoice items" on public.practice_invoice_items
  for update to authenticated using (exists (
    select 1 from public.practice_invoices i
    where i.id = invoice_id and private.can_bill_practice_matter(i.matter_id) and i.status = 'draft'
  )) with check (exists (
    select 1 from public.practice_invoices i
    where i.id = invoice_id and private.can_bill_practice_matter(i.matter_id) and i.status = 'draft'
  ));
create policy "studio billing roles delete invoice items" on public.practice_invoice_items
  for delete to authenticated using (exists (
    select 1 from public.practice_invoices i
    where i.id = invoice_id and private.can_bill_practice_matter(i.matter_id) and i.status = 'draft'
  ));

commit;
