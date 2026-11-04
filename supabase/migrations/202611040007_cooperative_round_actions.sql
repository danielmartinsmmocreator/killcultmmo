-- KillCult MMO: validação de ações por jogador e fechamento atômico de rodada cooperativa.
-- O líder continua sendo o host que executa o motor TypeScript do combate; o banco
-- controla quem pode agir, a ordem, ações duplicadas e quando a rodada pode ser resolvida.

alter table public.coop_expedition_sessions
  add column if not exists resolution_pending boolean not null default false;

create table if not exists public.coop_expedition_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coop_expedition_sessions(id) on delete cascade,
  round_number integer not null check (round_number >= 1),
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete restrict,
  action_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint coop_expedition_actions_once_per_round
    unique (session_id, round_number, actor_user_id),
  constraint coop_expedition_actions_payload_object
    check (jsonb_typeof(action_payload) = 'object')
);

create index if not exists coop_expedition_actions_session_round_idx
  on public.coop_expedition_actions(session_id, round_number, created_at);

alter table public.coop_expedition_actions enable row level security;

drop policy if exists "Cooperative members can read round actions"
  on public.coop_expedition_actions;
create policy "Cooperative members can read round actions"
  on public.coop_expedition_actions for select to authenticated
  using (
    exists (
      select 1
      from public.coop_expedition_sessions s
      where s.id = session_id
        and public.is_coop_expedition_room_member(s.room_id)
    )
  );

do $block$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'coop_expedition_actions'
    ) then
    execute 'alter publication supabase_realtime add table public.coop_expedition_actions';
  end if;
end;
$block$;

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
    'resolution_pending', s.resolution_pending,
    'state_snapshot', s.state_snapshot,
    'state_version', s.state_version,
    'started_at', s.started_at,
    'submitted_actions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'actor_user_id', a.actor_user_id,
        'character_id', a.character_id,
        'action_payload', a.action_payload,
        'created_at', a.created_at
      ) order by m.joined_at)
      from public.coop_expedition_actions a
      join public.coop_expedition_room_members m
        on m.room_id = s.room_id and m.user_id = a.actor_user_id
      where a.session_id = s.id and a.round_number = s.turn_number
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'nickname', p.nickname,
        'character_id', m.character_id,
        'class_id', c.class_id,
        'character_level', c.level,
        'is_ready', m.is_ready
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

create or replace function public.submit_coop_expedition_action(
  p_session_id uuid,
  p_expected_version bigint,
  p_character_id uuid,
  p_action jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_round integer;
  v_version bigint;
  v_leader_id uuid;
  v_current_user_id uuid;
  v_member_count integer;
  v_action_count integer;
  v_next_user_id uuid;
  v_resolution_pending boolean;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  if p_session_id is null or p_expected_version is null or p_expected_version < 0
    or p_character_id is null or p_action is null
    or jsonb_typeof(p_action) <> 'object'
    or pg_column_size(p_action) > 16384
    or jsonb_typeof(p_action->'type') <> 'string'
    or p_action->>'type' not in ('move', 'ability', 'pass') then
    raise exception 'Ação cooperativa inválida.';
  end if;

  select s.room_id, s.turn_number, s.state_version, s.leader_user_id,
         s.current_turn_user_id, s.resolution_pending
    into v_room_id, v_round, v_version, v_leader_id,
         v_current_user_id, v_resolution_pending
  from public.coop_expedition_sessions s
  where s.id = p_session_id and s.status = 'active'
  for update;

  if v_room_id is null then raise exception 'Sessão cooperativa não encontrada ou encerrada.'; end if;
  if v_version <> p_expected_version then
    raise exception 'A sessão foi atualizada por outro jogador. Sincronize e tente novamente.';
  end if;
  if v_resolution_pending then raise exception 'A rodada já está aguardando a resolução dos monstros.'; end if;
  if v_current_user_id is distinct from v_user_id then
    raise exception 'Ainda não é sua vez de agir.';
  end if;
  if not exists (
    select 1 from public.coop_expedition_room_members m
    where m.room_id = v_room_id
      and m.user_id = v_user_id
      and m.character_id = p_character_id
      and m.is_ready
  ) then
    raise exception 'Você só pode agir com o herói que selecionou na sala.';
  end if;

  insert into public.coop_expedition_actions (
    session_id, round_number, actor_user_id, character_id, action_payload
  ) values (
    p_session_id, v_round, v_user_id, p_character_id, p_action
  );

  select count(*) into v_member_count
  from public.coop_expedition_room_members m
  where m.room_id = v_room_id and m.character_id is not null and m.is_ready;

  select count(*) into v_action_count
  from public.coop_expedition_actions a
  where a.session_id = p_session_id and a.round_number = v_round;

  if v_action_count = v_member_count then
    update public.coop_expedition_sessions
    set current_turn_user_id = null,
        resolution_pending = true,
        state_version = state_version + 1,
        updated_at = now()
    where id = p_session_id
    returning state_version into v_version;
    v_next_user_id := null;
    v_resolution_pending := true;
  else
    select m.user_id into v_next_user_id
    from public.coop_expedition_room_members m
    where m.room_id = v_room_id
      and m.character_id is not null
      and m.is_ready
      and not exists (
        select 1 from public.coop_expedition_actions a
        where a.session_id = p_session_id
          and a.round_number = v_round
          and a.actor_user_id = m.user_id
      )
    order by case when m.user_id = v_leader_id then 0 else 1 end, m.joined_at
    limit 1;

    update public.coop_expedition_sessions
    set current_turn_user_id = v_next_user_id,
        state_version = state_version + 1,
        updated_at = now()
    where id = p_session_id
    returning state_version into v_version;
    v_resolution_pending := false;
  end if;

  return jsonb_build_object(
    'session_id', p_session_id,
    'round_number', v_round,
    'state_version', v_version,
    'current_turn_user_id', v_next_user_id,
    'resolution_pending', v_resolution_pending,
    'submitted_count', v_action_count,
    'member_count', v_member_count
  );
end;
$function$;

create or replace function public.resolve_coop_expedition_round(
  p_session_id uuid,
  p_expected_version bigint,
  p_current_floor integer,
  p_state_snapshot jsonb,
  p_status text default 'active'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_round integer;
  v_version bigint;
  v_member_count integer;
  v_action_count integer;
  v_first_user_id uuid;
  v_new_version bigint;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  if p_session_id is null or p_expected_version is null or p_expected_version < 0
    or p_current_floor is null or p_current_floor < 1 or p_current_floor > 100
    or p_state_snapshot is null or jsonb_typeof(p_state_snapshot) <> 'object'
    or pg_column_size(p_state_snapshot) > 1048576
    or p_status not in ('active', 'completed', 'defeated') then
    raise exception 'Estado de resolução inválido ou maior que 1 MB.';
  end if;

  select s.room_id, s.turn_number, s.state_version
    into v_room_id, v_round, v_version
  from public.coop_expedition_sessions s
  where s.id = p_session_id
    and s.leader_user_id = v_user_id
    and s.status = 'active'
    and s.resolution_pending
  for update;

  if v_room_id is null then
    raise exception 'A rodada ainda não recebeu a ação de todos os jogadores ou você não é o líder.';
  end if;
  if v_version <> p_expected_version then
    raise exception 'A sessão mudou antes da resolução. Sincronize novamente.';
  end if;

  select count(*) into v_member_count
  from public.coop_expedition_room_members m
  where m.room_id = v_room_id and m.character_id is not null and m.is_ready;
  select count(*) into v_action_count
  from public.coop_expedition_actions a
  where a.session_id = p_session_id and a.round_number = v_round;
  if v_member_count < 2 or v_member_count > 3 or v_action_count <> v_member_count then
    raise exception 'Não é possível resolver a rodada: faltam ações dos jogadores.';
  end if;

  select m.user_id into v_first_user_id
  from public.coop_expedition_room_members m
  where m.room_id = v_room_id and m.character_id is not null and m.is_ready
  order by case when m.user_id = v_user_id then 0 else 1 end, m.joined_at
  limit 1;

  update public.coop_expedition_sessions s
  set current_floor = p_current_floor,
      turn_number = s.turn_number + 1,
      current_turn_user_id = case when p_status = 'active' then v_first_user_id else null end,
      resolution_pending = false,
      state_snapshot = p_state_snapshot,
      status = p_status,
      state_version = s.state_version + 1,
      updated_at = now()
  where s.id = p_session_id
    and s.state_version = p_expected_version
  returning s.state_version into v_new_version;

  if v_new_version is null then
    raise exception 'A sessão foi atualizada por outro jogador. Sincronize e tente novamente.';
  end if;

  delete from public.coop_expedition_actions
  where session_id = p_session_id and round_number = v_round;

  return v_new_version;
end;
$function$;

-- Impede que o RPC antigo de snapshot contorne a sequência de ações da rodada.
revoke all on function public.save_coop_expedition_session_snapshot(uuid, bigint, integer, integer, uuid, jsonb)
  from public, anon, authenticated;

revoke all on function public.get_my_coop_expedition_session() from public, anon;
revoke all on function public.submit_coop_expedition_action(uuid, bigint, uuid, jsonb) from public, anon;
revoke all on function public.resolve_coop_expedition_round(uuid, bigint, integer, jsonb, text) from public, anon;

grant execute on function public.get_my_coop_expedition_session() to authenticated;
grant execute on function public.submit_coop_expedition_action(uuid, bigint, uuid, jsonb) to authenticated;
grant execute on function public.resolve_coop_expedition_round(uuid, bigint, integer, jsonb, text) to authenticated;
