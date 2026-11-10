-- JusticeConnect initial schema. Apply to a fresh Supabase PostgreSQL project.
-- Sensitive case files and identity documents must live in private storage buckets.
begin;
create extension if not exists pgcrypto;
create extension if not exists postgis;
create extension if not exists citext;

create type public.account_status as enum ('pending','active','suspended','closed');
create type public.practitioner_type as enum ('attorney','advocate','candidate_attorney','candidate_legal_practitioner','other');
create type public.verification_status as enum ('not_started','pending','verified','expired','rejected','suspended');
create type public.matter_status as enum ('draft','submitted','screening','matching','in_review','consultation_pending','engaged','closed','withdrawn','declined');
create type public.consultation_mode as enum ('in_person','remote','either');
create type public.matter_urgency as enum ('low','normal','urgent','critical');
create type public.interest_status as enum ('submitted','shortlisted','invited_to_contact','declined','withdrawn');
create type public.membership_role as enum ('super_admin','compliance_officer','support_officer','firm_owner','firm_admin','firm_practitioner','individual_practitioner','client','enterprise_admin','auditor');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique,
  display_name text not null check (length(display_name) between 2 and 160),
  phone text,
  avatar_path text,
  status public.account_status not null default 'pending',
  preferred_language text not null default 'en-ZA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null,
  organisation_id uuid,
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(user_id, role, organisation_id)
);

create table public.provinces (
  id smallint generated always as identity primary key,
  code text not null unique,
  name text not null unique,
  created_at timestamptz not null default now()
);
create table public.municipalities (
  id uuid primary key default gen_random_uuid(),
  province_id smallint not null references public.provinces(id),
  name text not null,
  municipality_type text not null default 'municipality',
  code text,
  unique(province_id,name)
);
create table public.places (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid references public.municipalities(id),
  name text not null,
  place_type text not null check (place_type in ('city','town','suburb','township','village','other')),
  latitude double precision,
  longitude double precision,
  location geography(point,4326),
  search_name text generated always as (lower(name)) stored,
  created_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -35 and -22 and longitude between 16 and 33))
);
create index places_location_gix on public.places using gist(location);
create index places_search_idx on public.places using gin(to_tsvector('simple', name));

create table public.practice_areas (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.practice_areas(id),
  slug text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table public.practitioners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  practitioner_type public.practitioner_type not null,
  public_name text not null,
  biography text,
  years_experience smallint check (years_experience between 0 and 80),
  accepts_remote_matters boolean not null default false,
  profile_visibility boolean not null default false,
  verification_status public.verification_status not null default 'not_started',
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index practitioners_public_search_idx on public.practitioners(verification_status,profile_visibility);

create table public.practitioner_credentials (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  credential_type text not null,
  issuing_body text,
  registration_number_encrypted text,
  verification_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  expires_at date,
  evidence_storage_path text,
  created_at timestamptz not null default now()
);
create table public.fidelity_fund_certificates (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  certificate_year int not null,
  certificate_reference_encrypted text,
  verification_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  expires_at date,
  evidence_storage_path text,
  unique(practitioner_id,certificate_year)
);

create table public.law_firms (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trading_name text,
  registration_number text,
  description text,
  website_url text,
  email citext,
  phone text,
  verification_status public.verification_status not null default 'pending',
  status public.account_status not null default 'pending',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_roles add constraint user_roles_organisation_fk foreign key (organisation_id) references public.law_firms(id) on delete cascade;
create table public.firm_members (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.law_firms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  firm_role text not null check (firm_role in ('owner','administrator','practitioner','staff','read_only')),
  status public.account_status not null default 'pending',
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(firm_id,user_id)
);
create table public.firm_branches (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.law_firms(id) on delete cascade,
  name text not null,
  address_line text,
  place_id uuid references public.places(id),
  location geography(point,4326),
  phone text,
  email citext,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index firm_branches_location_gix on public.firm_branches using gist(location);

create table public.practitioner_practice_areas (
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  practice_area_id uuid not null references public.practice_areas(id),
  primary key(practitioner_id,practice_area_id)
);
create table public.practitioner_service_areas (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  province_id smallint references public.provinces(id),
  municipality_id uuid references public.municipalities(id),
  place_id uuid references public.places(id),
  radius_km numeric(6,2),
  accepts_remote boolean not null default false,
  check (province_id is not null or municipality_id is not null or place_id is not null or accepts_remote)
);

create table public.legal_matters (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique default ('JC-' || upper(substr(encode(gen_random_bytes(8),'hex'),1,10))),
  client_user_id uuid not null references public.profiles(id),
  title text not null check (length(title) between 8 and 160),
  public_summary text not null check (length(public_summary) between 30 and 5000),
  confidential_details text,
  province_id smallint not null references public.provinces(id),
  municipality_id uuid references public.municipalities(id),
  place_id uuid references public.places(id),
  consultation_mode public.consultation_mode not null default 'either',
  urgency public.matter_urgency not null default 'normal',
  status public.matter_status not null default 'draft',
  matching_consent_at timestamptz,
  privacy_notice_version text,
  submitted_at timestamptz,
  assigned_firm_id uuid references public.law_firms(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index legal_matters_client_idx on public.legal_matters(client_user_id,created_at desc);
create index legal_matters_discovery_idx on public.legal_matters(status,province_id,urgency) where status in ('submitted','screening','matching');
create table public.matter_practice_areas (
  matter_id uuid not null references public.legal_matters(id) on delete cascade,
  practice_area_id uuid not null references public.practice_areas(id),
  primary key(matter_id,practice_area_id)
);
create table public.matter_documents (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.legal_matters(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  malware_scan_status text not null default 'pending' check (malware_scan_status in ('pending','clean','infected','error')),
  visibility text not null default 'client_only' check (visibility in ('client_only','engaged_practitioner','explicitly_shared')),
  created_at timestamptz not null default now()
);
create table public.case_interests (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.legal_matters(id) on delete cascade,
  practitioner_id uuid not null references public.practitioners(id),
  firm_id uuid references public.law_firms(id),
  status public.interest_status not null default 'submitted',
  introductory_message text check (length(introductory_message) <= 2000),
  submitted_at timestamptz not null default now(),
  unique(matter_id,practitioner_id)
);
create table public.mandates (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.legal_matters(id),
  client_user_id uuid not null references public.profiles(id),
  practitioner_id uuid references public.practitioners(id),
  firm_id uuid references public.law_firms(id),
  engagement_status text not null default 'proposed' check (engagement_status in ('proposed','conflict_check','awaiting_client','active','completed','terminated')),
  engagement_document_path text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (practitioner_id is not null or firm_id is not null)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid references public.legal_matters(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id),
  body text not null check (length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index messages_conversation_idx on public.messages(conversation_id,created_at);

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid references public.legal_matters(id),
  client_user_id uuid not null references public.profiles(id),
  practitioner_id uuid not null references public.practitioners(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode public.consultation_mode not null,
  status text not null default 'requested' check (status in ('requested','confirmed','cancelled','completed','no_show')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references public.profiles(id),
  practitioner_id uuid references public.practitioners(id),
  firm_id uuid references public.law_firms(id),
  mandate_id uuid not null unique references public.mandates(id),
  rating smallint not null check (rating between 1 and 5),
  review_text text check (length(review_text) <= 2000),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','published','rejected','hidden')),
  created_at timestamptz not null default now(),
  check (practitioner_id is not null or firm_id is not null)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  title text not null,
  body text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id),
  firm_id uuid references public.law_firms(id),
  plan_code text not null,
  status text not null default 'trial' check (status in ('trial','active','past_due','cancelled','expired')),
  currency char(3) not null default 'ZAR',
  amount_minor bigint not null default 0 check (amount_minor >= 0),
  billing_interval text not null default 'month' check (billing_interval in ('month','year')),
  provider_customer_ref text,
  provider_subscription_ref text,
  created_at timestamptz not null default now(),
  check (owner_user_id is not null or firm_id is not null)
);
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id),
  organisation_id uuid references public.law_firms(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  outcome text not null default 'success',
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index audit_events_actor_idx on public.audit_events(actor_user_id,occurred_at desc);
create index audit_events_resource_idx on public.audit_events(resource_type,resource_id,occurred_at desc);

-- Role helper. Security-definer avoids recursive reads of user_roles RLS.
create or replace function public.has_role(required_role public.membership_role, target_org uuid default null)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = required_role and (target_org is null or r.organisation_id = target_org)) $$;
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'super_admin') $$;
create or replace function public.is_firm_member(target_firm uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.firm_members m where m.firm_id = target_firm and m.user_id = auth.uid() and m.status = 'active') $$;

-- Updated-at trigger.
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger practitioners_updated_at before update on public.practitioners for each row execute function public.set_updated_at();
create trigger firms_updated_at before update on public.law_firms for each row execute function public.set_updated_at();
create trigger matters_updated_at before update on public.legal_matters for each row execute function public.set_updated_at();

-- Seed the nine provinces. Municipalities/places are loaded from a maintained official/geospatial dataset in a later import.
insert into public.provinces(code,name) values
('EC','Eastern Cape'),('FS','Free State'),('GP','Gauteng'),('KZN','KwaZulu-Natal'),('LP','Limpopo'),('MP','Mpumalanga'),('NW','North West'),('NC','Northern Cape'),('WC','Western Cape');

-- Public reference data can be read without authentication.
alter table public.provinces enable row level security;
alter table public.municipalities enable row level security;
alter table public.places enable row level security;
alter table public.practice_areas enable row level security;
create policy "provinces readable" on public.provinces for select using (true);
create policy "municipalities readable" on public.municipalities for select using (true);
create policy "places readable" on public.places for select using (true);
create policy "active practice areas readable" on public.practice_areas for select using (is_active);

-- Enable RLS everywhere else. Policies are intentionally restrictive by default.
do $$ declare t text; begin
  foreach t in array array['profiles','user_roles','practitioners','practitioner_credentials','fidelity_fund_certificates','law_firms','firm_members','firm_branches','practitioner_practice_areas','practitioner_service_areas','legal_matters','matter_practice_areas','matter_documents','case_interests','mandates','conversations','conversation_participants','messages','consultations','reviews','notifications','subscriptions','audit_events'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

create policy "profiles self or admin read" on public.profiles for select using (id = auth.uid() or public.is_super_admin() or exists(select 1 from public.firm_members fm where fm.user_id = profiles.id and public.is_firm_member(fm.firm_id)));
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "users create own profile" on public.profiles for insert with check (id = auth.uid());
create policy "roles self or admin read" on public.user_roles for select using (user_id = auth.uid() or public.is_super_admin());
create policy "practitioner public verified profiles" on public.practitioners for select using ((profile_visibility and verification_status = 'verified') or user_id = auth.uid() or public.is_super_admin());
create policy "practitioner owner insert" on public.practitioners for insert with check (user_id = auth.uid());
create policy "practitioner owner update" on public.practitioners for update using (user_id = auth.uid() or public.is_super_admin()) with check (user_id = auth.uid() or public.is_super_admin());
create policy "credentials owner or compliance" on public.practitioner_credentials for select using (exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = auth.uid()) or public.has_role('compliance_officer') or public.is_super_admin());
create policy "credentials owner submit" on public.practitioner_credentials for insert with check (exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = auth.uid()));
create policy "firms public verified" on public.law_firms for select using ((verification_status = 'verified' and status = 'active') or public.is_firm_member(id) or public.is_super_admin());
create policy "firm creator insert" on public.law_firms for insert with check (created_by = auth.uid());
create policy "firm members read own firm" on public.firm_members for select using (user_id = auth.uid() or public.is_firm_member(firm_id) or public.is_super_admin());
create policy "firm branches public for verified firm" on public.firm_branches for select using (exists(select 1 from public.law_firms f where f.id = firm_id and f.verification_status = 'verified' and f.status = 'active') or public.is_firm_member(firm_id) or public.is_super_admin());
create policy "practitioner practice areas readable" on public.practitioner_practice_areas for select using (exists(select 1 from public.practitioners p where p.id = practitioner_id and p.profile_visibility and p.verification_status = 'verified') or exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = auth.uid()));
create policy "service areas readable" on public.practitioner_service_areas for select using (exists(select 1 from public.practitioners p where p.id = practitioner_id and p.profile_visibility and p.verification_status = 'verified') or exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = auth.uid()));

-- Clients can only see their own matters. Matching access is mediated by a server-side workflow,
-- not a broad policy that exposes all submitted cases to every practitioner.
create policy "client owns matter" on public.legal_matters for select using (client_user_id = auth.uid() or public.is_super_admin());
create policy "client creates matter" on public.legal_matters for insert with check (client_user_id = auth.uid());
create policy "client edits own draft" on public.legal_matters for update using (client_user_id = auth.uid() and status = 'draft') with check (client_user_id = auth.uid());
create policy "client sees matter categories" on public.matter_practice_areas for select using (exists(select 1 from public.legal_matters m where m.id = matter_id and m.client_user_id = auth.uid()));
create policy "client manages own matter documents" on public.matter_documents for select using (uploaded_by = auth.uid() or exists(select 1 from public.legal_matters m where m.id = matter_id and m.client_user_id = auth.uid()));
create policy "client uploads own matter documents" on public.matter_documents for insert with check (uploaded_by = auth.uid() and exists(select 1 from public.legal_matters m where m.id = matter_id and m.client_user_id = auth.uid()));
create policy "case interest owner read" on public.case_interests for select using (exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = auth.uid()) or exists(select 1 from public.legal_matters m where m.id = matter_id and m.client_user_id = auth.uid()) or public.is_super_admin());
create policy "mandate parties read" on public.mandates for select using (client_user_id = auth.uid() or exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = auth.uid()) or (firm_id is not null and public.is_firm_member(firm_id)) or public.is_super_admin());
create policy "conversation participants read" on public.conversations for select using (exists(select 1 from public.conversation_participants cp where cp.conversation_id = id and cp.user_id = auth.uid()) or public.is_super_admin());
create policy "participants list own conversations" on public.conversation_participants for select using (user_id = auth.uid() or public.is_super_admin());
create policy "participants read messages" on public.messages for select using (exists(select 1 from public.conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()));
create policy "participants send messages" on public.messages for insert with check (sender_user_id = auth.uid() and exists(select 1 from public.conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()));
create policy "consultation parties read" on public.consultations for select using (client_user_id = auth.uid() or exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = auth.uid()) or public.is_super_admin());
create policy "reviews published public or author" on public.reviews for select using (moderation_status = 'published' or client_user_id = auth.uid() or public.is_super_admin());
create policy "notifications owner read" on public.notifications for select using (user_id = auth.uid());
create policy "notifications owner update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "subscriptions owner read" on public.subscriptions for select using (owner_user_id = auth.uid() or (firm_id is not null and public.is_firm_member(firm_id)) or public.is_super_admin());
create policy "audit events restricted read" on public.audit_events for select using (public.is_super_admin() or public.has_role('auditor') or public.has_role('compliance_officer'));

-- No client-facing UPDATE/DELETE policy is granted for audit_events. Service-role/server workflows append audit records.
commit;
