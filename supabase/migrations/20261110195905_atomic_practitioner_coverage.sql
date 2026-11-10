begin;

create or replace function public.save_practitioner_coverage(
  target_practitioner uuid,
  selected_practice_areas uuid[],
  selected_provinces smallint[],
  selected_places uuid[] default '{}'
)
returns void language plpgsql security definer set search_path = ''
as $$
declare p public.practitioners%rowtype; remote_ok boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into p from public.practitioners where id = target_practitioner and user_id = auth.uid() for update;
  if not found then raise exception 'Practitioner profile not found or access denied' using errcode = '42501'; end if;
  if coalesce(cardinality(selected_practice_areas),0) < 1 or cardinality(selected_practice_areas) > 20
    or coalesce(cardinality(selected_provinces),0) < 1 or cardinality(selected_provinces) > 9
    or coalesce(cardinality(selected_places),0) > 100 then
    raise exception 'Invalid practice or service area selection' using errcode = '22023';
  end if;
  if (select count(distinct x) from unnest(selected_practice_areas) x) <> cardinality(selected_practice_areas)
    or (select count(distinct x) from unnest(selected_provinces) x) <> cardinality(selected_provinces)
    or (select count(distinct x) from unnest(selected_places) x) <> cardinality(selected_places) then
    raise exception 'Duplicate selection is not allowed' using errcode = '22023';
  end if;
  if (select count(*) from public.practice_areas a where a.id = any(selected_practice_areas) and a.is_active) <> cardinality(selected_practice_areas) then
    raise exception 'One or more practice areas are unavailable' using errcode = '22023';
  end if;
  if (select count(*) from public.provinces pr where pr.id = any(selected_provinces)) <> cardinality(selected_provinces) then
    raise exception 'One or more provinces are unavailable' using errcode = '22023';
  end if;
  if cardinality(selected_places) > 0 and
    (select count(*) from public.places pl where pl.id = any(selected_places) and pl.province_id = any(selected_provinces)) <> cardinality(selected_places) then
    raise exception 'Each selected place must be within a selected province' using errcode = '22023';
  end if;
  remote_ok := p.accepts_remote_matters;
  delete from public.practitioner_practice_areas where practitioner_id = p.id;
  delete from public.practitioner_service_areas where practitioner_id = p.id;
  insert into public.practitioner_practice_areas(practitioner_id,practice_area_id)
    select p.id, x from unnest(selected_practice_areas) x;
  insert into public.practitioner_service_areas(practitioner_id,province_id,accepts_remote)
    select p.id, x, remote_ok from unnest(selected_provinces) x;
  if cardinality(selected_places) > 0 then
    insert into public.practitioner_service_areas(practitioner_id,place_id,accepts_remote)
      select p.id, x, remote_ok from unnest(selected_places) x;
  end if;
  insert into public.audit_events(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'practitioner.coverage_updated','practitioner',p.id::text,
    jsonb_build_object('practice_area_count',cardinality(selected_practice_areas),'province_count',cardinality(selected_provinces),'place_count',cardinality(selected_places)));
end;
$$;
revoke all on function public.save_practitioner_coverage(uuid,uuid[],smallint[],uuid[]) from public, anon;
grant execute on function public.save_practitioner_coverage(uuid,uuid[],smallint[],uuid[]) to authenticated;

commit;
