-- KillCult MMO: descoberta pública de guildas e solicitações de entrada.
-- Executar no Supabase SQL Editor após as migrations 001 e 002.

create table public.guild_join_requests (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (guild_id, user_id)
);

create index guild_join_requests_guild_status_idx
  on public.guild_join_requests (guild_id, status, created_at desc);

alter table public.guild_join_requests enable row level security;

create or replace function public.get_public_guilds(p_search text default '', p_limit integer default 30)
returns table (
  id uuid,
  name text,
  tag text,
  description text,
  member_count bigint,
  global_level bigint,
  leader_nickname text,
  has_requested boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    g.tag,
    g.description,
    (select count(*) from public.guild_members gm where gm.guild_id = g.id),
    coalesce((
      select sum(c.level)
      from public.guild_members gm
      join public.characters c on c.user_id = gm.user_id
      where gm.guild_id = g.id
    ), 0)::bigint,
    coalesce(leader.nickname, 'Jogador'),
    exists (
      select 1 from public.guild_join_requests jr
      where jr.guild_id = g.id and jr.user_id = auth.uid() and jr.status = 'pending'
    )
  from public.guilds g
  join public.profiles leader on leader.id = g.leader_user_id
  where auth.uid() is not null
    and (coalesce(trim(p_search), '') = ''
      or g.name ilike '%' || trim(p_search) || '%'
      or g.tag ilike '%' || trim(p_search) || '%')
  order by
    (select count(*) from public.guild_members gm where gm.guild_id = g.id) desc,
    g.name
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

create or replace function public.request_guild_join(p_guild_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  if exists (select 1 from public.guild_members gm where gm.user_id = v_user_id) then
    raise exception 'Você já participa de uma guilda.';
  end if;
  if not exists (select 1 from public.guilds g where g.id = p_guild_id) then
    raise exception 'Guilda não encontrada.';
  end if;

  insert into public.guild_join_requests (guild_id, user_id, status, created_at, responded_at)
  values (p_guild_id, v_user_id, 'pending', now(), null)
  on conflict (guild_id, user_id) do update
    set status = 'pending', created_at = now(), responded_at = null
    where public.guild_join_requests.status <> 'pending'
  returning id into v_request_id;

  if v_request_id is null then raise exception 'Você já possui uma solicitação pendente para essa guilda.'; end if;
  return v_request_id;
end;
$$;

create or replace function public.get_guild_join_requests()
returns table (
  id uuid,
  user_id uuid,
  nickname text,
  global_level bigint,
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
  from public.guild_members gm
  where gm.user_id = auth.uid() and gm.role in ('leader', 'admin');

  if v_guild_id is null then
    raise exception 'Somente líder e administradores podem consultar solicitações.';
  end if;

  return query
  select
    jr.id,
    jr.user_id,
    p.nickname,
    coalesce((select sum(c.level) from public.characters c where c.user_id = jr.user_id), 0)::bigint,
    jr.created_at
  from public.guild_join_requests jr
  join public.profiles p on p.id = jr.user_id
  where jr.guild_id = v_guild_id and jr.status = 'pending'
  order by jr.created_at asc;
end;
$$;

create or replace function public.respond_guild_join_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
  v_target_user_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;

  select gm.guild_id into v_guild_id
  from public.guild_members gm
  where gm.user_id = v_user_id and gm.role in ('leader', 'admin');

  if v_guild_id is null then raise exception 'Somente líder e administradores podem responder solicitações.'; end if;

  select jr.user_id into v_target_user_id
  from public.guild_join_requests jr
  where jr.id = p_request_id and jr.guild_id = v_guild_id and jr.status = 'pending'
  for update;

  if v_target_user_id is null then raise exception 'Solicitação não encontrada ou já respondida.'; end if;

  if p_approve then
    if exists (select 1 from public.guild_members gm where gm.user_id = v_target_user_id) then
      raise exception 'Esse jogador já participa de uma guilda.';
    end if;
    insert into public.guild_members (guild_id, user_id, role)
    values (v_guild_id, v_target_user_id, 'member');
    update public.guild_join_requests
    set status = 'approved', responded_at = now()
    where id = p_request_id;
    update public.guild_join_requests
    set status = 'cancelled', responded_at = now()
    where user_id = v_target_user_id and status = 'pending' and id <> p_request_id;
    update public.guild_invites
    set status = 'cancelled', responded_at = now()
    where invited_user_id = v_target_user_id and status = 'pending';
  else
    update public.guild_join_requests
    set status = 'rejected', responded_at = now()
    where id = p_request_id;
  end if;
end;
$$;

revoke all on function public.get_public_guilds(text, integer) from public, anon;
revoke all on function public.request_guild_join(uuid) from public, anon;
revoke all on function public.get_guild_join_requests() from public, anon;
revoke all on function public.respond_guild_join_request(uuid, boolean) from public, anon;

grant execute on function public.get_public_guilds(text, integer) to authenticated;
grant execute on function public.request_guild_join(uuid) to authenticated;
grant execute on function public.get_guild_join_requests() to authenticated;
grant execute on function public.respond_guild_join_request(uuid, boolean) to authenticated;
