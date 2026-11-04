-- Operações atômicas de economia e redistribuição de atributos na base.
-- O saldo usado é exclusivamente a carteira permanente (player_wallet).

create or replace function public.reset_character_attributes(p_character_id uuid)
returns table (gold_remaining bigint, points_returned integer, reset_cost bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level integer;
  v_strength integer;
  v_vitality integer;
  v_defense integer;
  v_unspent integer;
  v_cost bigint;
  v_returned integer;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  select c.level, c.strength, c.vitality, c.defense, c.unspent_attribute_points
    into v_level, v_strength, v_vitality, v_defense, v_unspent
  from public.characters c
  where c.id = p_character_id and c.user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Personagem não encontrado.';
  end if;

  v_cost := v_level::bigint * 200;
  v_returned := v_strength + v_vitality + v_defense;

  update public.player_wallet w
  set gold = w.gold - v_cost, updated_at = now()
  where w.user_id = auth.uid() and w.gold >= v_cost;

  if not found then
    raise exception 'Ouro insuficiente para redefinir os atributos.';
  end if;

  update public.characters c
  set strength = 0,
      vitality = 0,
      defense = 0,
      unspent_attribute_points = v_unspent + v_returned,
      updated_at = now()
  where c.id = p_character_id and c.user_id = auth.uid();

  return query
  select w.gold, v_unspent + v_returned, v_cost
  from public.player_wallet w
  where w.user_id = auth.uid();
end;
$$;

create or replace function public.buy_character_attribute_point(p_character_id uuid)
returns table (gold_remaining bigint, unspent_attribute_points integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  perform 1
  from public.characters c
  where c.id = p_character_id and c.user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Personagem não encontrado.';
  end if;

  update public.player_wallet w
  set gold = w.gold - 10000, updated_at = now()
  where w.user_id = auth.uid() and w.gold >= 10000;

  if not found then
    raise exception 'Ouro insuficiente. São necessários 10.000 de ouro.';
  end if;

  update public.characters c
  set unspent_attribute_points = c.unspent_attribute_points + 1,
      updated_at = now()
  where c.id = p_character_id and c.user_id = auth.uid();

  return query
  select w.gold, c.unspent_attribute_points
  from public.player_wallet w
  join public.characters c on c.user_id = w.user_id
  where w.user_id = auth.uid() and c.id = p_character_id;
end;
$$;

revoke all on function public.reset_character_attributes(uuid) from public;
revoke all on function public.buy_character_attribute_point(uuid) from public;
grant execute on function public.reset_character_attributes(uuid) to authenticated;
grant execute on function public.buy_character_attribute_point(uuid) to authenticated;
