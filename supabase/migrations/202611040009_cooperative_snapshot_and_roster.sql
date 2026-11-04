-- KillCult MMO: inicialização segura do tabuleiro compartilhado e dados de combate dos heróis.
-- O líder publica o snapshot inicial uma única vez; todos os membros recebem o mesmo roster,
-- incluindo atributos permanentes e equipamentos realmente equipados.

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

create or replace function public.initialize_coop_expedition_snapshot(
  p_session_id uuid,
  p_expected_version bigint,
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
  v_ready_count integer;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;

  if p_session_id is null
    or p_expected_version is null
    or p_expected_version < 0
    or p_state_snapshot is null
    or jsonb_typeof(p_state_snapshot) <> 'object'
    or p_state_snapshot->>'version' is distinct from '1'
    or p_state_snapshot->>'cooperativeMode' is distinct from 'true'
    or jsonb_typeof(p_state_snapshot->'battle') is distinct from 'object'
    or pg_column_size(p_state_snapshot) > 1048576 then
    raise exception 'Snapshot inicial inválido ou maior que 1 MB.';
  end if;

  select s.room_id
    into v_room_id
  from public.coop_expedition_sessions s
  where s.id = p_session_id
    and s.leader_user_id = v_user_id
    and s.status = 'active'
    and s.state_snapshot is null
    and s.state_version = p_expected_version
  for update;

  if v_room_id is null then
    raise exception 'A sessão já foi inicializada, mudou ou você não é o líder.';
  end if;

  select count(*)
    into v_ready_count
  from public.coop_expedition_room_members m
  where m.room_id = v_room_id
    and m.is_ready
    and m.character_id is not null;

  if v_ready_count < 2 or v_ready_count > 3 then
    raise exception 'O grupo precisa ter de 2 a 3 personagens prontos.';
  end if;

  update public.coop_expedition_sessions s
  set state_snapshot = p_state_snapshot,
      current_floor = 1,
      turn_number = 1,
      state_version = s.state_version + 1,
      updated_at = now()
  where s.id = p_session_id
    and s.state_snapshot is null
    and s.state_version = p_expected_version
  returning s.state_version into v_new_version;

  if v_new_version is null then
    raise exception 'O snapshot inicial foi publicado por outro processo. Sincronize a sessão.';
  end if;

  return v_new_version;
end;
$function$;

revoke all on function public.get_my_coop_expedition_session() from public, anon;
grant execute on function public.get_my_coop_expedition_session() to authenticated;

revoke all on function public.initialize_coop_expedition_snapshot(uuid, bigint, jsonb) from public, anon;
grant execute on function public.initialize_coop_expedition_snapshot(uuid, bigint, jsonb) to authenticated;
