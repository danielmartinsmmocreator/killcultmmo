-- Permite registrar ataques normais como uma ação explícita no turno cooperativo.
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
    or p_action->>'type' not in ('move', 'attack', 'ability', 'pass') then
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

revoke all on function public.submit_coop_expedition_action(uuid, bigint, uuid, jsonb) from public, anon;
grant execute on function public.submit_coop_expedition_action(uuid, bigint, uuid, jsonb) to authenticated;
