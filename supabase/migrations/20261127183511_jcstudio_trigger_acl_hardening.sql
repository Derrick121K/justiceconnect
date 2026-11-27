begin;
revoke all on function private.guard_practice_matter_update() from public, anon, authenticated;
commit;
