-- Run after applying the firm workspace RLS hardening migration.
-- Fails closed if any policy is missing, over-broad, or no longer binds
-- membership to the owning firm row.

do $$
declare
  policy_row record;
begin
  select * into policy_row
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'law_firms'
    and policyname = 'firm admins update descriptive profile';

  if not found
    or position('fm.firm_id = law_firms.id' in coalesce(policy_row.qual, '')) = 0
    or position('fm.firm_id = law_firms.id' in coalesce(policy_row.with_check, '')) = 0
    or not ('authenticated' = any(policy_row.roles)) then
    raise exception 'law_firms administrator update policy is not correctly tenant-scoped';
  end if;

  select * into policy_row
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'firm_branches'
    and policyname = 'firm admins create branches';

  if not found
    or position('fm.firm_id = firm_branches.firm_id' in coalesce(policy_row.with_check, '')) = 0
    or not ('authenticated' = any(policy_row.roles)) then
    raise exception 'firm_branches insert policy is not correctly tenant-scoped';
  end if;

  select * into policy_row
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'firm_branches'
    and policyname = 'firm admins update branches';

  if not found
    or position('fm.firm_id = firm_branches.firm_id' in coalesce(policy_row.qual, '')) = 0
    or position('fm.firm_id = firm_branches.firm_id' in coalesce(policy_row.with_check, '')) = 0
    or not ('authenticated' = any(policy_row.roles)) then
    raise exception 'firm_branches update policy is not correctly tenant-scoped';
  end if;

  select * into policy_row
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'firm_branches'
    and policyname = 'firm admins delete branches';

  if not found
    or position('fm.firm_id = firm_branches.firm_id' in coalesce(policy_row.qual, '')) = 0
    or not ('authenticated' = any(policy_row.roles)) then
    raise exception 'firm_branches delete policy is not correctly tenant-scoped';
  end if;
end;
$$;
