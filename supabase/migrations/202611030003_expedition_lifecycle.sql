-- Registro seguro do ciclo de vida das expedições.
-- O navegador não recebe permissão de escrita direta nas tabelas.

create or replace function public.start_player_expedition(p_character_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expedition_id uuid;
  v_count integer;
  v_owned_count integer;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;

  if p_character_ids is null
    or cardinality(p_character_ids) < 1
    or cardinality(p_character_ids) > 3
    or array_position(p_character_ids, null) is not null then
    raise exception 'Selecione de 1 a 3 personagens válidos.';
  end if;

  select count(distinct selected_id)
    into v_count
  from unnest(p_character_ids) as selected(selected_id);

  if v_count <> cardinality(p_character_ids) then
    raise exception 'Não é permitido repetir personagens na equipe.';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  if exists (
    select 1 from public.expeditions
    where user_id = v_user_id and status = 'active'
  ) then
    raise exception 'Você já possui uma expedição ativa.';
  end if;

  select count(*)
    into v_owned_count
  from public.characters
  where user_id = v_user_id
    and id = any(p_character_ids);

  if v_owned_count <> cardinality(p_character_ids) then
    raise exception 'Um ou mais personagens não pertencem à sua conta.';
  end if;

  insert into public.expeditions (user_id)
  values (v_user_id)
  returning id into v_expedition_id;

  insert into public.expedition_members (expedition_id, user_id, character_id)
  select v_expedition_id, v_user_id, selected_id
  from unnest(p_character_ids) as selected(selected_id);

  return v_expedition_id;
end;
$$;

create or replace function public.update_player_expedition_progress(
  p_expedition_id uuid,
  p_current_floor integer
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
  if p_expedition_id is null or p_current_floor is null
    or p_current_floor < 1 or p_current_floor > 100 then
    raise exception 'Progresso da expedição inválido.';
  end if;

  update public.expeditions
  set current_floor = greatest(current_floor, p_current_floor),
      last_activity_at = now()
  where id = p_expedition_id
    and user_id = v_user_id
    and status = 'active';

  if not found then
    raise exception 'Expedição ativa não encontrada.';
  end if;
end;
$$;

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
    or p_result not in ('extraction', 'combat_defeat', 'completed') then
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

revoke all on function public.start_player_expedition(uuid[]) from public;
revoke all on function public.update_player_expedition_progress(uuid, integer) from public;
revoke all on function public.finish_player_expedition(uuid, text) from public;
grant execute on function public.start_player_expedition(uuid[]) to authenticated;
grant execute on function public.update_player_expedition_progress(uuid, integer) to authenticated;
grant execute on function public.finish_player_expedition(uuid, text) to authenticated;
