-- KillCult MMO: jogadores derrotados aguardam no lobby enquanto os sobreviventes continuam.
-- A vida de cada personagem é lida do snapshot autoritativo publicado pelo líder.

create or replace function public.coop_character_is_alive(
  p_state_snapshot jsonb,
  p_character_id uuid
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_state_snapshot #> '{battle,units}') = 'array'
          then p_state_snapshot #> '{battle,units}'
        else '[]'::jsonb
      end
    ) as unit
    where unit->>'uid' = 'coop-' || p_character_id::text
      and case
        when coalesce(unit->>'hp', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (unit->>'hp')::numeric > 0
        else false
      end
  );
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
        'is_ready', m.is_ready,
        'is_eliminated', case
          when m.character_id is null or s.state_snapshot is null then false
          else not public.coop_character_is_alive(s.state_snapshot, m.character_id)
        end
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
  v_snapshot jsonb;
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
         s.current_turn_user_id, s.resolution_pending, s.state_snapshot
    into v_room_id, v_round, v_version, v_leader_id,
         v_current_user_id, v_resolution_pending, v_snapshot
  from public.coop_expedition_sessions s
  where s.id = p_session_id and s.status = 'active'
  for update;

  if v_room_id is null then raise exception 'Sessão cooperativa não encontrada ou encerrada.'; end if;
  if v_version <> p_expected_version then
    raise exception 'A sessão foi atualizada por outro jogador. Sincronize e tente novamente.';
  end if;
  if v_resolution_pending then raise exception 'A rodada já está aguardando a resolução dos monstros.'; end if;
  if v_current_user_id is distinct from v_user_id then raise exception 'Ainda não é sua vez de agir.'; end if;

  if not exists (
    select 1 from public.coop_expedition_room_members m
    where m.room_id = v_room_id
      and m.user_id = v_user_id
      and m.character_id = p_character_id
      and m.is_ready
  ) then
    raise exception 'Você só pode agir com o herói que selecionou na sala.';
  end if;
  if not public.coop_character_is_alive(v_snapshot, p_character_id) then
    raise exception 'Seu herói foi derrotado. Aguarde o grupo no menu cooperativo.';
  end if;

  insert into public.coop_expedition_actions (
    session_id, round_number, actor_user_id, character_id, action_payload
  ) values (p_session_id, v_round, v_user_id, p_character_id, p_action);

  select count(*) into v_member_count
  from public.coop_expedition_room_members m
  where m.room_id = v_room_id and m.character_id is not null and m.is_ready
    and public.coop_character_is_alive(v_snapshot, m.character_id);

  select count(*) into v_action_count
  from public.coop_expedition_actions a
  where a.session_id = p_session_id and a.round_number = v_round;

  if v_member_count < 1 then raise exception 'Não há heróis vivos para continuar.'; end if;

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
      and public.coop_character_is_alive(v_snapshot, m.character_id)
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
  v_previous_snapshot jsonb;
  v_member_count integer;
  v_action_count integer;
  v_alive_count integer;
  v_next_user_id uuid;
  v_new_version bigint;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  if p_session_id is null or p_expected_version is null or p_expected_version < 0
    or p_current_floor is null or p_current_floor < 1 or p_current_floor > 100
    or p_state_snapshot is null or jsonb_typeof(p_state_snapshot) <> 'object'
    or p_state_snapshot->>'version' is distinct from '1'
    or p_state_snapshot->>'cooperativeMode' is distinct from 'true'
    or jsonb_typeof(p_state_snapshot->'battle') is distinct from 'object'
    or jsonb_typeof(p_state_snapshot->'battle'->'units') is distinct from 'array'
    or pg_column_size(p_state_snapshot) > 1048576
    or p_status not in ('active', 'completed', 'defeated') then
    raise exception 'Estado de resolução inválido ou maior que 1 MB.';
  end if;

  select s.room_id, s.turn_number, s.state_version, s.state_snapshot
    into v_room_id, v_round, v_version, v_previous_snapshot
  from public.coop_expedition_sessions s
  where s.id = p_session_id
    and s.leader_user_id = v_user_id
    and s.status = 'active'
    and s.resolution_pending
  for update;

  if v_room_id is null then
    raise exception 'A rodada ainda não recebeu todas as ações ou você não é o líder atual.';
  end if;
  if v_version <> p_expected_version then
    raise exception 'A sessão mudou antes da resolução. Sincronize novamente.';
  end if;

  select count(*) into v_member_count
  from public.coop_expedition_room_members m
  where m.room_id = v_room_id and m.character_id is not null and m.is_ready
    and public.coop_character_is_alive(v_previous_snapshot, m.character_id);

  select count(*) into v_action_count
  from public.coop_expedition_actions a
  where a.session_id = p_session_id and a.round_number = v_round;

  if v_member_count < 1 or v_member_count > 3 or v_action_count <> v_member_count then
    raise exception 'Não é possível resolver a rodada: faltam ações dos heróis vivos.';
  end if;

  select count(*) into v_alive_count
  from public.coop_expedition_room_members m
  where m.room_id = v_room_id and m.character_id is not null and m.is_ready
    and public.coop_character_is_alive(p_state_snapshot, m.character_id);

  select m.user_id into v_next_user_id
  from public.coop_expedition_room_members m
  where m.room_id = v_room_id and m.character_id is not null and m.is_ready
    and public.coop_character_is_alive(p_state_snapshot, m.character_id)
  order by case when m.user_id = v_user_id then 0 else 1 end, m.joined_at
  limit 1;

  if v_alive_count = 0 and p_status <> 'defeated' then
    raise exception 'Todos os heróis caíram; a expedição precisa ser encerrada como derrota.';
  end if;
  if v_alive_count > 0 and p_status = 'defeated' then
    raise exception 'Ainda há heróis vivos; a expedição não pode ser encerrada como derrota.';
  end if;
  if (p_status = 'defeated') is distinct from (p_state_snapshot->'battle'->>'outcome' = 'defeat') then
    raise exception 'O resultado do snapshot não corresponde ao status informado.';
  end if;

  update public.coop_expedition_sessions s
  set current_floor = p_current_floor,
      turn_number = s.turn_number + 1,
      current_turn_user_id = case
        when p_status = 'active' and p_state_snapshot->'battle'->>'outcome' = 'ongoing'
          then v_next_user_id
        else null
      end,
      leader_user_id = case
        when p_status = 'active' and v_next_user_id is not null then v_next_user_id
        else s.leader_user_id
      end,
      resolution_pending = false,
      state_snapshot = p_state_snapshot,
      status = p_status,
      state_version = s.state_version + 1,
      updated_at = now()
  where s.id = p_session_id and s.state_version = p_expected_version
  returning s.state_version into v_new_version;

  if v_new_version is null then
    raise exception 'A sessão foi atualizada por outro jogador. Sincronize e tente novamente.';
  end if;

  delete from public.coop_expedition_actions
  where session_id = p_session_id and round_number = v_round;

  return v_new_version;
end;
$function$;

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
  v_next_user_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  if p_session_id is null or p_expected_version is null
    or p_current_floor is null or p_current_floor < 2 or p_current_floor > 100
    or p_state_snapshot is null
    or jsonb_typeof(p_state_snapshot) <> 'object'
    or p_state_snapshot->>'version' is distinct from '1'
    or p_state_snapshot->>'cooperativeMode' is distinct from 'true'
    or jsonb_typeof(p_state_snapshot->'battle') is distinct from 'object'
    or jsonb_typeof(p_state_snapshot->'battle'->'units') is distinct from 'array'
    or p_state_snapshot->'battle'->>'outcome' is distinct from 'ongoing'
    or (p_state_snapshot->>'floorIndex')::integer is distinct from (p_current_floor - 1)
    or pg_column_size(p_state_snapshot) > 1048576 then
    raise exception 'Snapshot do próximo andar inválido.';
  end if;

  select s.room_id into v_room_id
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
    raise exception 'A sessão não está pronta para avançar ou você não é o líder atual.';
  end if;

  select m.user_id into v_next_user_id
  from public.coop_expedition_room_members m
  where m.room_id = v_room_id and m.is_ready and m.character_id is not null
    and public.coop_character_is_alive(p_state_snapshot, m.character_id)
  order by case when m.user_id = v_user_id then 0 else 1 end, m.joined_at
  limit 1;

  if v_next_user_id is null then
    raise exception 'Não há personagens vivos para avançar ao próximo andar.';
  end if;

  update public.coop_expedition_sessions s
  set current_floor = p_current_floor,
      turn_number = s.turn_number,
      current_turn_user_id = v_next_user_id,
      leader_user_id = v_next_user_id,
      resolution_pending = false,
      state_snapshot = p_state_snapshot,
      state_version = s.state_version + 1,
      updated_at = now()
  where s.id = p_session_id and s.state_version = p_expected_version
  returning s.state_version into v_new_version;

  if v_new_version is null then
    raise exception 'A sessão mudou durante o avanço. Sincronize e tente novamente.';
  end if;
  return v_new_version;
end;
$function$;

revoke all on function public.get_my_coop_expedition_session() from public, anon;
grant execute on function public.get_my_coop_expedition_session() to authenticated;

revoke all on function public.submit_coop_expedition_action(uuid, bigint, uuid, jsonb) from public, anon;
grant execute on function public.submit_coop_expedition_action(uuid, bigint, uuid, jsonb) to authenticated;

revoke all on function public.resolve_coop_expedition_round(uuid, bigint, integer, jsonb, text) from public, anon;
grant execute on function public.resolve_coop_expedition_round(uuid, bigint, integer, jsonb, text) to authenticated;

revoke all on function public.advance_coop_expedition_floor(uuid, bigint, integer, jsonb) from public, anon;
grant execute on function public.advance_coop_expedition_floor(uuid, bigint, integer, jsonb) to authenticated;
