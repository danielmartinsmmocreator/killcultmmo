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
      turn_number = 1,
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
