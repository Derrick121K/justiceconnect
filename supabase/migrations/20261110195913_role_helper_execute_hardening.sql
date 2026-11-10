begin;

-- Explicitly scope helper execution. Anonymous calls to has_role resolve auth.uid()
-- to NULL and therefore return false; public directory policies need the other helpers.
revoke all on function public.has_role(public.membership_role, uuid) from public, anon;
grant execute on function public.has_role(public.membership_role, uuid) to anon, authenticated;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to anon, authenticated;

revoke all on function public.is_firm_member(uuid) from public, anon;
grant execute on function public.is_firm_member(uuid) to anon, authenticated;

commit;
