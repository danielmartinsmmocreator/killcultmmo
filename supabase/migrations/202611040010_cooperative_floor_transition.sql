-- Avanço de andar cooperativo: somente o líder pode publicar o próximo encontro.
create or replace function public.advance_coop_expedition_floor(
  p_session_id uuid,
  p_expected_version bigint,
  p_current_floor integer,
  p_state_snapshot jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_new_version bigint;
  v_first_user_id uuid;
  v_previous_floor integer;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;
  if p_session_id is null or p_expected_version is null
    or p_current_floor is null or p_current_floor < 2 or p_current_floor > 100
    or p_state_snapshot is null
    or jsonb_typeof(p_state_snapshot) <> 'object'
    or p_state_snapshot->>'version' is distinct from '1'
    or p_state_snapshot->>'cooperativeMode' is distinct from 'true'
    or p_state_snapshot->'battle'->>'outcome' is distinct from 'ongoing'
    or (p_state_snapshot->>'floorIndex')::integer is distinct from (p_current_floor - 1)
    or pg_column_size(p_state_snapshot) > 1048576 then
    raise exception 'Snapshot do próximo andar inválido.';
  end if;

  select s.room_id, s.current_floor
    into v_room_id, v_previous_floor
  from public.coop_expedition_sessions s
  where s.id = p_session_id
    and s.leader_user_id = v_user_id
    and s.status = 'active'
    and s.resolution_pending = false
    and s.state_version = p_expected_version
    and s.state_snapshot->'battle'->>'outcome' = 'victory'
    and s.current_floor + 1 = p_current_floor
  for update;

  if v_room_id is null then
    raise exception 'A sessão não está pronta para avançar ou você não é o líder.';
  end if;

  select m.user_id into v_first_user_id
  from public.coop_expedition_room_members m
  where m.room_id = v_room_id and m.is_ready and m.character_id is not null
  order by case when m.user_id = v_user_id then 0 else 1 end, m.joined_at
  limit 1;

  update public.coop_expedition_sessions s
  set current_floor = p_current_floor,
      -- turn_number é global à sessão: não reiniciar para evitar colisão no índice das ações.
      current_turn_user_id = v_first_user_id,
      resolution_pending = false,
      state_snapshot = p_state_snapshot,
      state_version = s.state_version + 1,
      updated_at = now()
  where s.id = p_session_id
    and s.state_version = p_expected_version
  returning s.state_version into v_new_version;

  if v_new_version is null then
    raise exception 'A sessão mudou durante o avanço. Sincronize e tente novamente.';
  end if;
  return v_new_version;
end;
$function$;

revoke all on function public.advance_coop_expedition_floor(uuid, bigint, integer, jsonb) from public, anon;
grant execute on function public.advance_coop_expedition_floor(uuid, bigint, integer, jsonb) to authenticated;


-- A ordem de replay das ações precisa ser idêntica à ordem de turno do servidor.
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
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;

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
      ) order by case when m.user_id = s.leader_user_id then 0 else 1 end, m.joined_at)
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
        'character_xp', c.xp,
        'unspent_attribute_points', c.unspent_attribute_points,
        'strength', c.strength,
        'vitality', c.vitality,
        'defense', c.defense,
        'equipment', coalesce((
          select jsonb_agg(jsonb_build_object(
            'slot', ei.slot,
            'item_definition_id', i.item_definition_id
          ) order by ei.slot)
          from public.equipped_items ei
          join public.inventory i on i.id = ei.inventory_item_id
          where ei.character_id = c.id
        ), '[]'::jsonb),
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

revoke all on function public.get_my_coop_expedition_session() from public, anon;
grant execute on function public.get_my_coop_expedition_session() to authenticated;


-- Uma vitória pausa a sessão até o líder publicar o próximo andar.
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
      current_turn_user_id = case when p_status = 'active' and p_state_snapshot->'battle'->>'outcome' = 'ongoing' then v_first_user_id else null end,
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

revoke all on function public.resolve_coop_expedition_round(uuid, bigint, integer, jsonb, text) from public, anon;
grant execute on function public.resolve_coop_expedition_round(uuid, bigint, integer, jsonb, text) to authenticated;
