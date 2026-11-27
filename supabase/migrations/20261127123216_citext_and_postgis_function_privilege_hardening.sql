-- Move the relocatable citext extension out of public and restrict
-- direct PostGIS estimated-extent RPC execution to server-side service_role.
-- PostGIS itself is not relocatable through ordinary SQL on this Supabase
-- instance; do not DROP EXTENSION or rebuild it here.

alter extension citext set schema extensions;

revoke execute on function public.st_estimatedextent(text, text)
  from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text)
  from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text, boolean)
  from public, anon, authenticated;

grant execute on function public.st_estimatedextent(text, text) to service_role;
grant execute on function public.st_estimatedextent(text, text, text) to service_role;
grant execute on function public.st_estimatedextent(text, text, text, boolean) to service_role;
