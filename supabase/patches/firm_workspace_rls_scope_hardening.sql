-- JusticeConnect firm workspace RLS scope correction.
-- Fixes unqualified identifiers that resolved to the inner firm_members alias,
-- allowing a firm administrator's membership predicate to be detached from
-- the firm_id on the outer firm_branches / law_firms row.
--
-- Apply only as a reviewed database migration. This reference patch is not
-- itself a timestamped Supabase migration.

begin;

drop policy if exists "firm admins update descriptive profile" on public.law_firms;
create policy "firm admins update descriptive profile"
on public.law_firms
for update to authenticated
using (
  public.is_firm_member(law_firms.id)
  and exists (
    select 1
    from public.firm_members as fm
    where fm.firm_id = law_firms.id
      and fm.user_id = (select auth.uid())
      and fm.firm_role in ('owner', 'administrator')
      and fm.status = 'active'
  )
)
with check (
  public.is_firm_member(law_firms.id)
  and exists (
    select 1
    from public.firm_members as fm
    where fm.firm_id = law_firms.id
      and fm.user_id = (select auth.uid())
      and fm.firm_role in ('owner', 'administrator')
      and fm.status = 'active'
  )
);

drop policy if exists "firm admins create branches" on public.firm_branches;
create policy "firm admins create branches"
on public.firm_branches
for insert to authenticated
with check (
  exists (
    select 1
    from public.firm_members as fm
    where fm.firm_id = firm_branches.firm_id
      and fm.user_id = (select auth.uid())
      and fm.firm_role in ('owner', 'administrator')
      and fm.status = 'active'
  )
);

drop policy if exists "firm admins update branches" on public.firm_branches;
create policy "firm admins update branches"
on public.firm_branches
for update to authenticated
using (
  exists (
    select 1
    from public.firm_members as fm
    where fm.firm_id = firm_branches.firm_id
      and fm.user_id = (select auth.uid())
      and fm.firm_role in ('owner', 'administrator')
      and fm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.firm_members as fm
    where fm.firm_id = firm_branches.firm_id
      and fm.user_id = (select auth.uid())
      and fm.firm_role in ('owner', 'administrator')
      and fm.status = 'active'
  )
);

drop policy if exists "firm admins delete branches" on public.firm_branches;
create policy "firm admins delete branches"
on public.firm_branches
for delete to authenticated
using (
  exists (
    select 1
    from public.firm_members as fm
    where fm.firm_id = firm_branches.firm_id
      and fm.user_id = (select auth.uid())
      and fm.firm_role in ('owner', 'administrator')
      and fm.status = 'active'
  )
);

commit;
