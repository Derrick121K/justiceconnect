begin;

-- Clients can maintain categories only while their own enquiry remains a draft.
create policy "client adds draft matter categories" on public.matter_practice_areas for insert
with check (exists(select 1 from public.legal_matters m where m.id = matter_id and m.client_user_id = auth.uid() and m.status = 'draft'));
create policy "client removes draft matter categories" on public.matter_practice_areas for delete
using (exists(select 1 from public.legal_matters m where m.id = matter_id and m.client_user_id = auth.uid() and m.status = 'draft'));

-- Practitioners may maintain their own expertise and coverage, but cannot publish themselves as verified.
create policy "practitioner manages own expertise" on public.practitioner_practice_areas for insert
with check (exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = auth.uid()));
create policy "practitioner removes own expertise" on public.practitioner_practice_areas for delete
using (exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = auth.uid()));
create policy "practitioner manages own service areas" on public.practitioner_service_areas for insert
with check (exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = auth.uid()));
create policy "practitioner removes own service areas" on public.practitioner_service_areas for delete
using (exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = auth.uid()));

-- Firm profile edits are limited to descriptive/contact fields. Verification and account status remain privileged.
revoke update on public.law_firms from authenticated;
grant update(legal_name, trading_name, description, website_url, email, phone) on public.law_firms to authenticated;
create policy "firm admins update descriptive profile" on public.law_firms for update
using (public.is_firm_member(id) and exists(select 1 from public.firm_members fm where fm.firm_id = id and fm.user_id = auth.uid() and fm.firm_role in ('owner','administrator') and fm.status = 'active'))
with check (public.is_firm_member(id) and exists(select 1 from public.firm_members fm where fm.firm_id = id and fm.user_id = auth.uid() and fm.firm_role in ('owner','administrator') and fm.status = 'active'));

create policy "firm admins create branches" on public.firm_branches for insert
with check (exists(select 1 from public.firm_members fm where fm.firm_id = firm_id and fm.user_id = auth.uid() and fm.firm_role in ('owner','administrator') and fm.status = 'active'));
create policy "firm admins update branches" on public.firm_branches for update
using (exists(select 1 from public.firm_members fm where fm.firm_id = firm_id and fm.user_id = auth.uid() and fm.firm_role in ('owner','administrator') and fm.status = 'active'))
with check (exists(select 1 from public.firm_members fm where fm.firm_id = firm_id and fm.user_id = auth.uid() and fm.firm_role in ('owner','administrator') and fm.status = 'active'));
create policy "firm admins delete branches" on public.firm_branches for delete
using (exists(select 1 from public.firm_members fm where fm.firm_id = firm_id and fm.user_id = auth.uid() and fm.firm_role in ('owner','administrator') and fm.status = 'active'));

commit;
