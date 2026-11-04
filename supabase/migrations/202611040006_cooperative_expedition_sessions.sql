-- KillCult MMO: cria a sessão persistente da expedição cooperativa.
-- Esta etapa prepara o estado compartilhado e o controle de versão; o tabuleiro
-- e a resolução de ações serão conectados na etapa seguinte.

create table public.coop_expedition_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.coop_expedition_rooms(id) on delete cascade,
  leader_user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'completed', 'defeated', 'abandoned')),
  current_floor integer not null default 1 check (current_floor between 1 and 100),
  turn_number integer not null default 1 check (turn_number >= 1),
  current_turn_user_id uuid references public.profiles(id) on delete set null,
  state_snapshot jsonb,
  state_version bigint not null default 0 check (state_version >= 0),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coop_expedition_sessions_status_idx
  on public.coop_expedition_sessions (status, updated_at desc);

alter table public.coop_expedition_sessions enable row level security;

create policy "Cooperative room members can read their session"
  on public.coop_expedition_sessions for select to authenticated
  using (public.is_coop_expedition_room_member(room_id));

do $block$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'coop_expedition_sessions'
    ) then
    execute 'alter publication supabase_realtime add table public.coop_expedition_sessions';
  end if;
end;
$block$;

create or replace function public.start_coop_expedition_session()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_session_id uuid;
  v_member_count integer;
  v_ready_count integer;
  v_first_turn_user_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;

  select r.id into v_room_id
  from public.coop_expedition_rooms r
  where r.leader_user_id = v_user_id and r.status = 'prepared'
  order by r.created_at desc
  limit 1
  for update;

  if v_room_id is null then
    raise exception 'Somente o líder pode iniciar um grupo preparado.';
  end if;

  select count(*),
         count(*) filter (where m.is_ready and m.character_id is not null),
         (array_agg(m.user_id order by case when m.user_id = v_user_id then 0 else 1 end, m.joined_at))[1]
    into v_member_count, v_ready_count, v_first_turn_user_id
  from public.coop_expedition_room_members m
  where m.room_id = v_room_id;

  if v_member_count < 2 or v_member_count > 3 or v_ready_count <> v_member_count then
    raise exception 'O grupo precisa ter de 2 a 3 jogadores prontos, cada um com um herói selecionado.';
  end if;

  insert into public.coop_expedition_sessions (
    room_id, leader_user_id, current_turn_user_id
  )
  values (v_room_id, v_user_id, v_first_turn_user_id)
  on conflict (room_id) do update
    set status = 'active',
        current_floor = 1,
        turn_number = 1,
        current_turn_user_id = excluded.current_turn_user_id,
        state_snapshot = null,
        state_version = 0,
        started_at = now(),
        updated_at = now()
    where public.coop_expedition_sessions.status in ('abandoned', 'defeated', 'completed')
  returning id into v_session_id;

  if v_session_id is null then
    select s.id into v_session_id
    from public.coop_expedition_sessions s
    where s.room_id = v_room_id and s.status = 'active';
  end if;

  if v_session_id is null then
    raise exception 'Essa sala já possui uma sessão cooperativa ativa.';
  end if;

  update public.coop_expedition_rooms
  set updated_at = now()
  where id = v_room_id;

  return v_session_id;
end;
$function$;

create or replace function public.get_my_coop_expedition_session()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;

  select jsonb_build_object(
    'id', s.id,
    'room_id', s.room_id,
    'leader_user_id', s.leader_user_id,
    'status', s.status,
    'current_floor', s.current_floor,
    'turn_number', s.turn_number,
    'current_turn_user_id', s.current_turn_user_id,
    'state_snapshot', s.state_snapshot,
    'state_version', s.state_version,
    'started_at', s.started_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'nickname', p.nickname,
        'character_id', m.character_id,
        'class_id', c.class_id,
        'character_level', c.level
      ) order by case when m.user_id = s.leader_user_id then 0 else 1 end, m.joined_at)
      from public.coop_expedition_room_members m
      join public.profiles p on p.id = m.user_id
      left join public.characters c on c.id = m.character_id
      where m.room_id = s.room_id
    ), '[]'::jsonb)
  )
  into v_result
  from public.coop_expedition_sessions s
  join public.coop_expedition_room_members mine
    on mine.room_id = s.room_id and mine.user_id = v_user_id
  where s.status = 'active'
  order by s.started_at desc
  limit 1;

  return v_result;
end;
$function$;

create or replace function public.save_coop_expedition_session_snapshot(
  p_session_id uuid,
  p_expected_version bigint,
  p_current_floor integer,
  p_turn_number integer,
  p_current_turn_user_id uuid,
  p_state_snapshot jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_new_version bigint;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  if p_session_id is null
    or p_expected_version is null or p_expected_version < 0
    or p_current_floor is null or p_current_floor < 1 or p_current_floor > 100
    or p_turn_number is null or p_turn_number < 1
    or p_state_snapshot is null
    or jsonb_typeof(p_state_snapshot) <> 'object'
    or pg_column_size(p_state_snapshot) > 1048576 then
    raise exception 'Estado da sessão inválido ou maior que 1 MB.';
  end if;

  update public.coop_expedition_sessions s
  set current_floor = p_current_floor,
      turn_number = p_turn_number,
      current_turn_user_id = p_current_turn_user_id,
      state_snapshot = p_state_snapshot,
      state_version = s.state_version + 1,
      updated_at = now()
  where s.id = p_session_id
    and s.leader_user_id = v_user_id
    and s.status = 'active'
    and s.state_version = p_expected_version
    and p_current_floor >= s.current_floor
    and (
      p_current_turn_user_id is null
      or exists (
        select 1 from public.coop_expedition_room_members turn_member
        where turn_member.room_id = s.room_id
          and turn_member.user_id = p_current_turn_user_id
      )
    )
    and exists (
      select 1 from public.coop_expedition_room_members m
      where m.room_id = s.room_id and m.user_id = v_user_id
    )
  returning s.state_version into v_new_version;

  if v_new_version is null then
    raise exception 'A sessão mudou ou foi encerrada. Atualize o estado antes de tentar salvar novamente.';
  end if;

  return v_new_version;
end;
$function$;

create or replace function public.abandon_coop_expedition_session()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;

  update public.coop_expedition_sessions
  set status = 'abandoned', updated_at = now()
  where leader_user_id = v_user_id
    and status = 'active'
    and room_id in (
      select m.room_id from public.coop_expedition_room_members m
      where m.user_id = v_user_id
    )
  returning id into v_session_id;

  if v_session_id is null then
    raise exception 'Não existe sessão ativa que você possa encerrar.';
  end if;
end;
$function$;

revoke all on function public.start_coop_expedition_session() from public, anon;
revoke all on function public.get_my_coop_expedition_session() from public, anon;
revoke all on function public.save_coop_expedition_session_snapshot(uuid, bigint, integer, integer, uuid, jsonb) from public, anon;
revoke all on function public.abandon_coop_expedition_session() from public, anon;

grant execute on function public.start_coop_expedition_session() to authenticated;
grant execute on function public.get_my_coop_expedition_session() to authenticated;
grant execute on function public.save_coop_expedition_session_snapshot(uuid, bigint, integer, integer, uuid, jsonb) to authenticated;
grant execute on function public.abandon_coop_expedition_session() to authenticated;
