begin;

create or replace function public.invite_firm_member(target_firm uuid, invite_email text, requested_role text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare invitee uuid; member_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if requested_role not in ('administrator','practitioner','staff','read_only') then raise exception 'Invalid firm role' using errcode = '22023'; end if;
  if not exists(select 1 from public.firm_members fm where fm.firm_id = target_firm and fm.user_id = auth.uid() and fm.status = 'active' and fm.firm_role in ('owner','administrator')) then
    raise exception 'Firm administrator permission required' using errcode = '42501';
  end if;
  select p.id into invitee from public.profiles p where lower(p.email::text) = lower(trim(invite_email)) and p.status = 'active';
  if invitee is null then raise exception 'The invited person must create and confirm a JusticeConnect account first' using errcode = 'P0002'; end if;
  if invitee = auth.uid() then raise exception 'You are already a firm member' using errcode = '22023'; end if;
  insert into public.firm_members(firm_id,user_id,firm_role,status,invited_by)
  values(target_firm,invitee,requested_role,'pending',auth.uid())
  on conflict (firm_id,user_id) do update set firm_role = excluded.firm_role, status = 'pending', invited_by = auth.uid()
  returning id into member_id;
  insert into public.notifications(user_id,category,title,body,action_url)
  values(invitee,'firm_invitation','Law firm workspace invitation','You have been invited to join a law firm workspace. Review the invitation in your account.','/dashboard/invitations');
  insert into public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),target_firm,'firm.member_invited','firm_member',member_id::text,jsonb_build_object('role',requested_role));
  return member_id;
end;
$$;
revoke all on function public.invite_firm_member(uuid,text,text) from public, anon;
grant execute on function public.invite_firm_member(uuid,text,text) to authenticated;

create or replace function public.accept_firm_invitation(target_membership uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare m public.firm_members%rowtype; granted_role public.membership_role;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into m from public.firm_members where id = target_membership and user_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'Invitation not found or already processed' using errcode = '42501'; end if;
  granted_role := case when m.firm_role = 'administrator' then 'firm_admin'::public.membership_role
    when m.firm_role = 'read_only' then null
    else 'firm_practitioner'::public.membership_role end;
  update public.firm_members set status = 'active' where id = m.id;
  if granted_role is not null then
    insert into public.user_roles(user_id,role,organisation_id,granted_by)
    values(auth.uid(),granted_role,m.firm_id,m.invited_by) on conflict do nothing;
  end if;
  insert into public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id)
  values(auth.uid(),m.firm_id,'firm.invitation_accepted','firm_member',m.id::text);
end;
$$;
revoke all on function public.accept_firm_invitation(uuid) from public, anon;
grant execute on function public.accept_firm_invitation(uuid) to authenticated;

commit;
