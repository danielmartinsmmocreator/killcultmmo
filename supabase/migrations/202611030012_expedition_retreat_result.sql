-- Registra desistências voluntárias separadamente de derrotas em combate.
alter table public.expeditions
  drop constraint if exists expeditions_result_check;

alter table public.expeditions
  add constraint expeditions_result_check
  check (result is null or result in ('extraction', 'combat_defeat', 'inactive_defeat', 'completed', 'retreat'));

create or replace function public.finish_player_expedition(
  p_expedition_id uuid,
  p_result text
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
    or p_result not in ('extraction', 'combat_defeat', 'completed', 'retreat') then
    raise exception 'Resultado da expedição inválido.';
  end if;

  update public.expeditions
  set status = case when p_result in ('extraction', 'completed') then 'extracted' else 'defeated' end,
      result = p_result,
      ended_at = now(),
      last_activity_at = now()
  where id = p_expedition_id
    and user_id = v_user_id
    and status = 'active';

  if not found then
    if exists (
      select 1 from public.expeditions
      where id = p_expedition_id
        and user_id = v_user_id
        and result = p_result
        and status <> 'active'
    ) then
      return;
    end if;
    raise exception 'Expedição ativa não encontrada ou já encerrada.';
  end if;
end;
$$;

revoke all on function public.finish_player_expedition(uuid, text) from public;
grant execute on function public.finish_player_expedition(uuid, text) to authenticated;
