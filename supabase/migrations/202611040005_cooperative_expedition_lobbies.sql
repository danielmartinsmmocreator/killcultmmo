-- KillCult MMO: salas e preparação para expedições cooperativas.
-- Esta migration implementa somente lobby, convites, escolha de herói e prontidão.
-- A criação/inicialização do combate multiplayer será feita em uma etapa posterior.

create table public.coop_expedition_rooms (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  leader_user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'lobby'
    check (status in ('lobby', 'prepared', 'cancelled')),
  max_players integer not null default 3 check (max_players = 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coop_expedition_rooms_guild_status_idx
  on public.coop_expedition_rooms (guild_id, status, created_at desc);

create table public.coop_expedition_room_members (
  room_id uuid not null references public.coop_expedition_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, character_id)
);

create index coop_expedition_room_members_user_idx
  on public.coop_expedition_room_members (user_id, room_id);

create table public.coop_expedition_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.coop_expedition_rooms(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (room_id, invited_user_id)
);

create index coop_expedition_invites_recipient_idx
  on public.coop_expedition_invites (invited_user_id, status, created_at desc);

-- Habilita atualizações em tempo real para que a sala reflita escolhas e prontidão.
do $
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'coop_expedition_rooms') then
      execute 'alter publication supabase_realtime add table public.coop_expedition_rooms';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'coop_expedition_room_members') then
      execute 'alter publication supabase_realtime add table public.coop_expedition_room_members';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'coop_expedition_invites') then
      execute 'alter publication supabase_realtime add table public.coop_expedition_invites';
    end if;
  end if;
end;
$;

alter table public.coop_expedition_rooms enable row level security;
alter table public.coop_expedition_room_members enable row level security;
alter table public.coop_expedition_invites enable row level security;

create or replace function public.is_coop_expedition_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.coop_expedition_room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid()
  );
$;

create policy "Room participants can read cooperative rooms"
  on public.coop_expedition_rooms for select to authenticated
  using (public.is_coop_expedition_room_member(id));

create policy "Room participants can read cooperative members"
  on public.coop_expedition_room_members for select to authenticated
  using (public.is_coop_expedition_room_member(room_id));

create policy "Players can read their cooperative invitations"
  on public.coop_expedition_invites for select to authenticated
  using (
    invited_user_id = auth.uid()
    or public.is_coop_expedition_room_member(room_id)
  );

create or replace function public.get_my_coop_lobby()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;

  select r.id into v_room_id
  from public.coop_expedition_room_members mine
  join public.coop_expedition_rooms r on r.id = mine.room_id
  where mine.user_id = v_user_id and r.status in ('lobby', 'prepared')
  order by r.created_at desc
  limit 1;

  select jsonb_build_object(
    'room', case when v_room_id is null then null else (
      select jsonb_build_object(
        'id', r.id,
        'guild_id', r.guild_id,
        'guild_name', g.name,
        'guild_tag', g.tag,
        'leader_user_id', r.leader_user_id,
        'status', r.status,
        'max_players', r.max_players,
        'created_at', r.created_at,
        'members', coalesce((
          select jsonb_agg(jsonb_build_object(
            'user_id', m.user_id,
            'nickname', p.nickname,
            'character_id', m.character_id,
            'class_id', c.class_id,
            'character_level', c.level,
            'is_ready', m.is_ready,
            'joined_at', m.joined_at
          ) order by case when m.user_id = r.leader_user_id then 0 else 1 end, lower(p.nickname))
          from public.coop_expedition_room_members m
          join public.profiles p on p.id = m.user_id
          left join public.characters c on c.id = m.character_id
          where m.room_id = r.id
        ), '[]'::jsonb)
      )
      from public.coop_expedition_rooms r
      join public.guilds g on g.id = r.guild_id
      where r.id = v_room_id
    ) end,
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'room_id', i.room_id,
        'guild_name', g.name,
        'guild_tag', g.tag,
        'inviter_nickname', inviter.nickname,
        'created_at', i.created_at
      ) order by i.created_at desc)
      from public.coop_expedition_invites i
      join public.coop_expedition_rooms r on r.id = i.room_id
      join public.guilds g on g.id = r.guild_id
      join public.profiles inviter on inviter.id = i.invited_by
      where i.invited_user_id = v_user_id and i.status = 'pending' and r.status = 'lobby'
    ), '[]'::jsonb),
    'characters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'class_id', c.class_id,
        'level', c.level
      ) order by case c.class_id
        when 'warrior' then 1 when 'mage' then 2 when 'cleric' then 3
        when 'assassin' then 4 when 'archer' then 5 else 6 end)
      from public.characters c where c.user_id = v_user_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.create_coop_expedition_room()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
  v_room_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select gm.guild_id into v_guild_id
  from public.guild_members gm where gm.user_id = v_user_id;
  if v_guild_id is null then raise exception 'Você precisa participar de uma guilda para criar uma expedição cooperativa.'; end if;

  if exists (
    select 1 from public.coop_expedition_room_members m
    join public.coop_expedition_rooms r on r.id = m.room_id
    where m.user_id = v_user_id and r.status in ('lobby', 'prepared')
  ) then raise exception 'Você já participa de uma sala cooperativa.'; end if;

  insert into public.coop_expedition_rooms (guild_id, leader_user_id)
  values (v_guild_id, v_user_id)
  returning id into v_room_id;

  insert into public.coop_expedition_room_members (room_id, user_id)
  values (v_room_id, v_user_id);

  return v_room_id;
end;
$$;

create or replace function public.invite_coop_expedition_player(p_nickname text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_guild_id uuid;
  v_target_id uuid;
  v_invite_id uuid;
  v_status text;
  v_count integer;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;

  select r.id, r.guild_id, r.status into v_room_id, v_guild_id, v_status
  from public.coop_expedition_rooms r
  where r.leader_user_id = v_user_id and r.status = 'lobby'
  order by r.created_at desc limit 1;
  if v_room_id is null then raise exception 'Somente o líder de uma sala em preparação pode convidar jogadores.'; end if;

  select p.id into v_target_id from public.profiles p
  where lower(p.nickname) = lower(trim(coalesce(p_nickname, '')));
  if v_target_id is null then raise exception 'Jogador não encontrado.'; end if;
  if v_target_id = v_user_id then raise exception 'Você já está nessa sala.'; end if;
  if not exists (
    select 1 from public.guild_members gm
    where gm.guild_id = v_guild_id and gm.user_id = v_target_id
  ) then raise exception 'O jogador precisa fazer parte da sua guilda.'; end if;

  if exists (
    select 1 from public.coop_expedition_room_members m
    join public.coop_expedition_rooms r on r.id = m.room_id
    where m.user_id = v_target_id and r.status in ('lobby', 'prepared')
  ) then raise exception 'Esse jogador já participa de uma sala cooperativa.'; end if;

  select count(*) into v_count from public.coop_expedition_room_members m where m.room_id = v_room_id;
  if v_count >= 3 then raise exception 'A sala já está cheia.'; end if;

  insert into public.coop_expedition_invites (room_id, invited_user_id, invited_by, status)
  values (v_room_id, v_target_id, v_user_id, 'pending')
  on conflict (room_id, invited_user_id) do update
    set invited_by = excluded.invited_by, status = 'pending', created_at = now(), responded_at = null
  returning id into v_invite_id;

  return v_invite_id;
end;
$$;

create or replace function public.respond_coop_expedition_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_guild_id uuid;
  v_status text;
  v_count integer;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select i.room_id, r.guild_id, r.status
    into v_room_id, v_guild_id, v_status
  from public.coop_expedition_invites i
  join public.coop_expedition_rooms r on r.id = i.room_id
  where i.id = p_invite_id and i.invited_user_id = v_user_id and i.status = 'pending'
  for update of i, r;

  if v_room_id is null then raise exception 'Convite não encontrado ou expirado.'; end if;

  if not p_accept then
    update public.coop_expedition_invites set status = 'declined', responded_at = now() where id = p_invite_id;
    return;
  end if;

  if v_status <> 'lobby' then raise exception 'Essa sala não está mais aceitando participantes.'; end if;
  if not exists (
    select 1 from public.guild_members gm where gm.guild_id = v_guild_id and gm.user_id = v_user_id
  ) then raise exception 'Você não faz mais parte da guilda dessa sala.'; end if;
  if exists (
    select 1 from public.coop_expedition_room_members m
    join public.coop_expedition_rooms r on r.id = m.room_id
    where m.user_id = v_user_id and r.status in ('lobby', 'prepared')
  ) then raise exception 'Você já participa de uma sala cooperativa.'; end if;

  select count(*) into v_count from public.coop_expedition_room_members m where m.room_id = v_room_id;
  if v_count >= 3 then raise exception 'A sala já está cheia.'; end if;

  insert into public.coop_expedition_room_members (room_id, user_id)
  values (v_room_id, v_user_id);
  update public.coop_expedition_invites set status = 'accepted', responded_at = now() where id = p_invite_id;
  update public.coop_expedition_invites set status = 'cancelled', responded_at = now()
  where invited_user_id = v_user_id and status = 'pending' and id <> p_invite_id;
end;
$$;

create or replace function public.set_coop_expedition_hero(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;

  select r.id into v_room_id
  from public.coop_expedition_room_members m
  join public.coop_expedition_rooms r on r.id = m.room_id
  where m.user_id = v_user_id and r.status = 'lobby'
  limit 1;
  if v_room_id is null then raise exception 'Você não está em uma sala que aceita alterações.'; end if;

  if not exists (select 1 from public.characters c where c.id = p_character_id and c.user_id = v_user_id) then
    raise exception 'Esse personagem não pertence à sua conta.';
  end if;

  if exists (
    select 1 from public.coop_expedition_room_members m
    where m.room_id = v_room_id and m.character_id = p_character_id and m.user_id <> v_user_id
  ) then raise exception 'Esse herói já foi selecionado por outro participante.'; end if;

  update public.coop_expedition_room_members
  set character_id = p_character_id, is_ready = false
  where room_id = v_room_id and user_id = v_user_id;
  update public.coop_expedition_rooms set updated_at = now(), status = 'lobby' where id = v_room_id;
  update public.coop_expedition_room_members set is_ready = false where room_id = v_room_id;
end;
$$;

create or replace function public.set_coop_expedition_ready(p_ready boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;

  select r.id into v_room_id
  from public.coop_expedition_room_members m
  join public.coop_expedition_rooms r on r.id = m.room_id
  where m.user_id = v_user_id and r.status = 'lobby'
  limit 1;
  if v_room_id is null then raise exception 'Você não está em uma sala em preparação.'; end if;

  if p_ready and not exists (
    select 1 from public.coop_expedition_room_members m
    where m.room_id = v_room_id and m.user_id = v_user_id and m.character_id is not null
  ) then raise exception 'Escolha seu herói antes de confirmar prontidão.'; end if;

  update public.coop_expedition_room_members set is_ready = p_ready
  where room_id = v_room_id and user_id = v_user_id;
end;
$$;

create or replace function public.prepare_coop_expedition_room()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_count integer;
  v_ready_count integer;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;

  select r.id into v_room_id from public.coop_expedition_rooms r
  where r.leader_user_id = v_user_id and r.status = 'lobby'
  order by r.created_at desc limit 1;
  if v_room_id is null then raise exception 'Somente o líder pode preparar essa sala.'; end if;

  select count(*), count(*) filter (where m.is_ready and m.character_id is not null)
    into v_count, v_ready_count
  from public.coop_expedition_room_members m where m.room_id = v_room_id;

  if v_count < 2 then raise exception 'A expedição cooperativa precisa de pelo menos 2 jogadores.'; end if;
  if v_count > 3 then raise exception 'A sala excedeu o limite de 3 jogadores.'; end if;
  if v_ready_count <> v_count then raise exception 'Todos os jogadores precisam escolher um herói e confirmar prontidão.'; end if;

  update public.coop_expedition_rooms set status = 'prepared', updated_at = now() where id = v_room_id;
end;
$$;

create or replace function public.leave_coop_expedition_room()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_leader_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;

  select r.id, r.leader_user_id into v_room_id, v_leader_id
  from public.coop_expedition_room_members m
  join public.coop_expedition_rooms r on r.id = m.room_id
  where m.user_id = v_user_id and r.status in ('lobby', 'prepared')
  limit 1;
  if v_room_id is null then raise exception 'Você não participa de uma sala ativa.'; end if;

  if v_user_id = v_leader_id then
    update public.coop_expedition_rooms set status = 'cancelled', updated_at = now() where id = v_room_id;
    update public.coop_expedition_invites set status = 'cancelled', responded_at = now()
    where room_id = v_room_id and status = 'pending';
    delete from public.coop_expedition_room_members where room_id = v_room_id;
  else
    delete from public.coop_expedition_room_members where room_id = v_room_id and user_id = v_user_id;
    update public.coop_expedition_rooms set status = 'lobby', updated_at = now() where id = v_room_id;
    update public.coop_expedition_room_members set is_ready = false where room_id = v_room_id;
  end if;
end;
$$;

revoke all on function public.is_coop_expedition_room_member(uuid) from public, anon;
grant execute on function public.is_coop_expedition_room_member(uuid) to authenticated;

revoke all on function public.get_my_coop_lobby() from public, anon;
revoke all on function public.create_coop_expedition_room() from public, anon;
revoke all on function public.invite_coop_expedition_player(text) from public, anon;
revoke all on function public.respond_coop_expedition_invite(uuid, boolean) from public, anon;
revoke all on function public.set_coop_expedition_hero(uuid) from public, anon;
revoke all on function public.set_coop_expedition_ready(boolean) from public, anon;
revoke all on function public.prepare_coop_expedition_room() from public, anon;
revoke all on function public.leave_coop_expedition_room() from public, anon;

grant execute on function public.get_my_coop_lobby() to authenticated;
grant execute on function public.create_coop_expedition_room() to authenticated;
grant execute on function public.invite_coop_expedition_player(text) to authenticated;
grant execute on function public.respond_coop_expedition_invite(uuid, boolean) to authenticated;
grant execute on function public.set_coop_expedition_hero(uuid) to authenticated;
grant execute on function public.set_coop_expedition_ready(boolean) to authenticated;
grant execute on function public.prepare_coop_expedition_room() to authenticated;
grant execute on function public.leave_coop_expedition_room() to authenticated;
