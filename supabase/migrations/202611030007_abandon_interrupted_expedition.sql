-- Explicitly abandons the authenticated player's active expedition.
create or replace function public.abandon_player_expedition()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expedition_id uuid;
  v_current_floor integer;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;
  perform 1 from public.profiles where id = v_user_id for update;
  update public.expeditions
  set status = 'defeated', result = 'inactive_defeat',
      ended_at = now(), last_activity_at = now()
  where id = (
    select e.id from public.expeditions e
    where e.user_id = v_user_id and e.status = 'active'
    order by e.started_at desc limit 1 for update
  )
  returning id, current_floor into v_expedition_id, v_current_floor;
  return jsonb_build_object(
    'abandoned', v_expedition_id is not null,
    'expedition_id', v_expedition_id,
    'current_floor', v_current_floor
  );
end;
$$;
revoke all on function public.abandon_player_expedition() from public, anon;
grant execute on function public.abandon_player_expedition() to authenticated;
