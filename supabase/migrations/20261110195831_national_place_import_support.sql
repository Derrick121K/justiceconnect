-- Support repeatable national populated-place imports without inventing a city list.
begin;
alter table public.places add column if not exists province_id smallint references public.provinces(id);
alter table public.places add column if not exists geoname_id bigint;
create unique index if not exists places_geoname_id_uidx on public.places(geoname_id);
create index if not exists places_province_search_idx on public.places(province_id, search_name);
commit;
