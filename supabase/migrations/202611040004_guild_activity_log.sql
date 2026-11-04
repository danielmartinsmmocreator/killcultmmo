-- KillCult MMO: histórico de atividades da guilda.
-- Executar no Supabase SQL Editor após as migrations anteriores.

create table public.guild_activity (
  id bigint generated always as identity primary key,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_nickname text not null default 'Jogador',
  event_type text not null check (event_type in (
    'member_joined', 'member_left', 'member_removed',
    'role_changed', 'bank_deposit', 'bank_withdraw'
  )),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index guild_activity_guild_created_idx
  on public.guild_activity (guild_id, created_at desc);

alter table public.guild_activity enable row level security;

create policy "Guild members can read activity"
  on public.guild_activity for select to authenticated
  using (public.current_guild_role(guild_id) is not null);

create or replace function public.record_guild_member_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_nickname text;
  v_type text;
  v_target uuid;
  v_guild_id uuid;
  v_details jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_target := new.user_id;
    v_guild_id := new.guild_id;
    v_type := 'member_joined';
    v_actor := auth.uid();
    if v_actor is null then v_actor := new.user_id; end if;
    v_details := jsonb_build_object('role', new.role);
  elsif tg_op = 'DELETE' then
    v_target := old.user_id;
    v_guild_id := old.guild_id;
    v_actor := auth.uid();
    if v_actor is null then v_actor := old.user_id; end if;
    v_type := case when v_actor = v_target then 'member_left' else 'member_removed' end;
  else
    v_target := new.user_id;
    v_guild_id := new.guild_id;
    v_actor := auth.uid();
    if new.role is distinct from old.role then
      v_type := 'role_changed';
      v_details := jsonb_build_object('old_role', old.role, 'new_role', new.role);
    else
      return new;
    end if;
  end if;

  select p.nickname into v_nickname
  from public.profiles p where p.id = v_actor;

  insert into public.guild_activity (guild_id, actor_user_id, actor_nickname, event_type, details)
  values (v_guild_id, v_actor, coalesce(v_nickname, 'Jogador'), v_type,
    v_details || jsonb_build_object('target_user_id', v_target));

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists guild_members_activity_trigger on public.guild_members;
create trigger guild_members_activity_trigger
after insert or update of role or delete on public.guild_members
for each row execute function public.record_guild_member_activity();

create or replace function public.record_guild_bank_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text;
begin
  select p.nickname into v_nickname
  from public.profiles p where p.id = new.actor_user_id;

  insert into public.guild_activity (guild_id, actor_user_id, actor_nickname, event_type, details)
  values (
    new.guild_id,
    new.actor_user_id,
    coalesce(v_nickname, 'Jogador'),
    case when new.action = 'deposit' then 'bank_deposit' else 'bank_withdraw' end,
    jsonb_build_object('item_definition_id', new.item_definition_id)
  );
  return new;
end;
$$;

drop trigger if exists guild_bank_logs_activity_trigger on public.guild_bank_logs;
create trigger guild_bank_logs_activity_trigger
after insert on public.guild_bank_logs
for each row execute function public.record_guild_bank_activity();

create or replace function public.get_guild_activity(p_limit integer default 50)
returns table (
  id bigint,
  actor_nickname text,
  event_type text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_guild_id uuid;
begin
  select gm.guild_id into v_guild_id
  from public.guild_members gm where gm.user_id = auth.uid();

  if v_guild_id is null then raise exception 'Você não participa de uma guilda.'; end if;

  return query
  select a.id, a.actor_nickname, a.event_type, a.details, a.created_at
  from public.guild_activity a
  where a.guild_id = v_guild_id
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

revoke all on function public.record_guild_member_activity() from public, anon, authenticated;
revoke all on function public.record_guild_bank_activity() from public, anon, authenticated;
revoke all on function public.get_guild_activity(integer) from public, anon;
grant execute on function public.get_guild_activity(integer) to authenticated;
