-- Snapshot transacional para permitir retomar a mesma batalha após recarregar o navegador.
alter table public.expeditions
  add column if not exists state_snapshot jsonb,
  add column if not exists snapshot_version integer not null default 1;

create or replace function public.get_active_player_expedition()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expedition public.expeditions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;

  select e.* into v_expedition
  from public.expeditions e
  where e.user_id = v_user_id and e.status = 'active'
  order by e.started_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('active', false);
  end if;

  if v_expedition.last_activity_at <= now() - interval '10 minutes' then
    update public.expeditions
    set status = 'defeated',
        result = 'inactive_defeat',
        ended_at = now(),
        last_activity_at = now()
    where id = v_expedition.id;

    return jsonb_build_object(
      'active', false,
      'expired', true,
      'expedition_id', v_expedition.id,
      'current_floor', v_expedition.current_floor
    );
  end if;

  return jsonb_build_object(
    'active', true,
    'expedition_id', v_expedition.id,
    'current_floor', v_expedition.current_floor,
    'state_snapshot', v_expedition.state_snapshot,
    'snapshot_version', v_expedition.snapshot_version,
    'last_activity_at', v_expedition.last_activity_at
  );
end;
$$;

create or replace function public.save_player_expedition_snapshot(
  p_expedition_id uuid,
  p_current_floor integer,
  p_state_snapshot jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;
  if p_expedition_id is null
    or p_current_floor is null or p_current_floor < 1 or p_current_floor > 100
    or p_state_snapshot is null
    or jsonb_typeof(p_state_snapshot) <> 'object'
    or pg_column_size(p_state_snapshot) > 1048576 then
    raise exception 'Snapshot da expedição inválido ou maior que 1 MB.';
  end if;

  update public.expeditions
  set current_floor = greatest(current_floor, p_current_floor),
      state_snapshot = p_state_snapshot,
      snapshot_version = 1,
      last_activity_at = now()
  where id = p_expedition_id
    and user_id = v_user_id
    and status = 'active'
    and last_activity_at > now() - interval '10 minutes';

  if not found then
    raise exception 'Expedição encerrada ou expirada. Não foi possível salvar o estado.';
  end if;
end;
$$;

revoke all on function public.get_active_player_expedition() from public, anon;
revoke all on function public.save_player_expedition_snapshot(uuid, integer, jsonb) from public, anon;
grant execute on function public.get_active_player_expedition() to authenticated;
grant execute on function public.save_player_expedition_snapshot(uuid, integer, jsonb) to authenticated;
