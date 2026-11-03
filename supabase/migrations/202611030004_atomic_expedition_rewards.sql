-- Consolidação atômica das recompensas da extração.
-- O catálogo valida IDs existentes; não torna o combate client-side anti-cheat.

create table if not exists public.item_catalog (
  definition_id text primary key
);

insert into public.item_catalog (definition_id)
values
  ('tier-1-chest-common'),
  ('tier-1-chest-rare'),
  ('tier-1-boots-common'),
  ('tier-1-boots-rare'),
  ('tier-1-helmet-common'),
  ('tier-1-helmet-rare'),
  ('tier-1-warrior-weapon-1-common'),
  ('tier-1-warrior-weapon-1-rare'),
  ('tier-1-warrior-weapon-1-epic'),
  ('tier-1-warrior-weapon-2-common'),
  ('tier-1-warrior-weapon-2-rare'),
  ('tier-1-warrior-weapon-2-epic'),
  ('tier-1-warrior-offhand-common'),
  ('tier-1-warrior-offhand-rare'),
  ('tier-1-warrior-offhand-epic'),
  ('tier-1-assassin-weapon-1-common'),
  ('tier-1-assassin-weapon-1-rare'),
  ('tier-1-assassin-weapon-1-epic'),
  ('tier-1-assassin-weapon-2-common'),
  ('tier-1-assassin-weapon-2-rare'),
  ('tier-1-assassin-weapon-2-epic'),
  ('tier-1-assassin-offhand-epic'),
  ('tier-1-mage-weapon-1-common'),
  ('tier-1-mage-weapon-1-rare'),
  ('tier-1-mage-weapon-1-epic'),
  ('tier-1-mage-weapon-2-common'),
  ('tier-1-mage-weapon-2-rare'),
  ('tier-1-mage-weapon-2-epic'),
  ('tier-1-mage-offhand-common'),
  ('tier-1-mage-offhand-rare'),
  ('tier-1-mage-offhand-epic'),
  ('tier-1-cleric-weapon-1-common'),
  ('tier-1-cleric-weapon-1-rare'),
  ('tier-1-cleric-weapon-1-epic'),
  ('tier-1-cleric-weapon-2-common'),
  ('tier-1-cleric-weapon-2-rare'),
  ('tier-1-cleric-weapon-2-epic'),
  ('tier-1-cleric-offhand-common'),
  ('tier-1-cleric-offhand-rare'),
  ('tier-1-cleric-offhand-epic'),
  ('tier-1-archer-weapon-1-common'),
  ('tier-1-archer-weapon-1-rare'),
  ('tier-1-archer-weapon-1-epic'),
  ('tier-1-archer-weapon-2-common'),
  ('tier-1-archer-weapon-2-rare'),
  ('tier-1-archer-weapon-2-epic'),
  ('tier-2-chest-common'),
  ('tier-2-chest-rare'),
  ('tier-2-boots-common'),
  ('tier-2-boots-rare'),
  ('tier-2-helmet-common'),
  ('tier-2-helmet-rare'),
  ('tier-2-warrior-weapon-1-common'),
  ('tier-2-warrior-weapon-1-rare'),
  ('tier-2-warrior-weapon-1-epic'),
  ('tier-2-warrior-weapon-2-common'),
  ('tier-2-warrior-weapon-2-rare'),
  ('tier-2-warrior-weapon-2-epic'),
  ('tier-2-warrior-offhand-common'),
  ('tier-2-warrior-offhand-rare'),
  ('tier-2-warrior-offhand-epic'),
  ('tier-2-assassin-weapon-1-common'),
  ('tier-2-assassin-weapon-1-rare'),
  ('tier-2-assassin-weapon-1-epic'),
  ('tier-2-assassin-weapon-2-common'),
  ('tier-2-assassin-weapon-2-rare'),
  ('tier-2-assassin-weapon-2-epic'),
  ('tier-2-assassin-offhand-epic'),
  ('tier-2-mage-weapon-1-common'),
  ('tier-2-mage-weapon-1-rare'),
  ('tier-2-mage-weapon-1-epic'),
  ('tier-2-mage-weapon-2-common'),
  ('tier-2-mage-weapon-2-rare'),
  ('tier-2-mage-weapon-2-epic'),
  ('tier-2-mage-offhand-common'),
  ('tier-2-mage-offhand-rare'),
  ('tier-2-mage-offhand-epic'),
  ('tier-2-cleric-weapon-1-common'),
  ('tier-2-cleric-weapon-1-rare'),
  ('tier-2-cleric-weapon-1-epic'),
  ('tier-2-cleric-weapon-2-common'),
  ('tier-2-cleric-weapon-2-rare'),
  ('tier-2-cleric-weapon-2-epic'),
  ('tier-2-cleric-offhand-common'),
  ('tier-2-cleric-offhand-rare'),
  ('tier-2-cleric-offhand-epic'),
  ('tier-2-archer-weapon-1-common'),
  ('tier-2-archer-weapon-1-rare'),
  ('tier-2-archer-weapon-1-epic'),
  ('tier-2-archer-weapon-2-common'),
  ('tier-2-archer-weapon-2-rare'),
  ('tier-2-archer-weapon-2-epic'),
  ('tier-3-chest-common'),
  ('tier-3-chest-rare'),
  ('tier-3-boots-common'),
  ('tier-3-boots-rare'),
  ('tier-3-helmet-common'),
  ('tier-3-helmet-rare'),
  ('tier-3-warrior-weapon-1-common'),
  ('tier-3-warrior-weapon-1-rare'),
  ('tier-3-warrior-weapon-1-epic'),
  ('tier-3-warrior-weapon-2-common'),
  ('tier-3-warrior-weapon-2-rare'),
  ('tier-3-warrior-weapon-2-epic'),
  ('tier-3-warrior-offhand-common'),
  ('tier-3-warrior-offhand-rare'),
  ('tier-3-warrior-offhand-epic'),
  ('tier-3-assassin-weapon-1-common'),
  ('tier-3-assassin-weapon-1-rare'),
  ('tier-3-assassin-weapon-1-epic'),
  ('tier-3-assassin-weapon-2-common'),
  ('tier-3-assassin-weapon-2-rare'),
  ('tier-3-assassin-weapon-2-epic'),
  ('tier-3-assassin-offhand-epic'),
  ('tier-3-mage-weapon-1-common'),
  ('tier-3-mage-weapon-1-rare'),
  ('tier-3-mage-weapon-1-epic'),
  ('tier-3-mage-weapon-2-common'),
  ('tier-3-mage-weapon-2-rare'),
  ('tier-3-mage-weapon-2-epic'),
  ('tier-3-mage-offhand-common'),
  ('tier-3-mage-offhand-rare'),
  ('tier-3-mage-offhand-epic'),
  ('tier-3-cleric-weapon-1-common'),
  ('tier-3-cleric-weapon-1-rare'),
  ('tier-3-cleric-weapon-1-epic'),
  ('tier-3-cleric-weapon-2-common'),
  ('tier-3-cleric-weapon-2-rare'),
  ('tier-3-cleric-weapon-2-epic'),
  ('tier-3-cleric-offhand-common'),
  ('tier-3-cleric-offhand-rare'),
  ('tier-3-cleric-offhand-epic'),
  ('tier-3-archer-weapon-1-common'),
  ('tier-3-archer-weapon-1-rare'),
  ('tier-3-archer-weapon-1-epic'),
  ('tier-3-archer-weapon-2-common'),
  ('tier-3-archer-weapon-2-rare'),
  ('tier-3-archer-weapon-2-epic'),
  ('tier-4-chest-common'),
  ('tier-4-chest-rare'),
  ('tier-4-boots-common'),
  ('tier-4-boots-rare'),
  ('tier-4-helmet-common'),
  ('tier-4-helmet-rare'),
  ('tier-4-warrior-weapon-1-common'),
  ('tier-4-warrior-weapon-1-rare'),
  ('tier-4-warrior-weapon-1-epic'),
  ('tier-4-warrior-weapon-2-common'),
  ('tier-4-warrior-weapon-2-rare'),
  ('tier-4-warrior-weapon-2-epic'),
  ('tier-4-warrior-offhand-common'),
  ('tier-4-warrior-offhand-rare'),
  ('tier-4-warrior-offhand-epic'),
  ('tier-4-assassin-weapon-1-common'),
  ('tier-4-assassin-weapon-1-rare'),
  ('tier-4-assassin-weapon-1-epic'),
  ('tier-4-assassin-weapon-2-common'),
  ('tier-4-assassin-weapon-2-rare'),
  ('tier-4-assassin-weapon-2-epic'),
  ('tier-4-assassin-offhand-epic'),
  ('tier-4-mage-weapon-1-common'),
  ('tier-4-mage-weapon-1-rare'),
  ('tier-4-mage-weapon-1-epic'),
  ('tier-4-mage-weapon-2-common'),
  ('tier-4-mage-weapon-2-rare'),
  ('tier-4-mage-weapon-2-epic'),
  ('tier-4-mage-offhand-common'),
  ('tier-4-mage-offhand-rare'),
  ('tier-4-mage-offhand-epic'),
  ('tier-4-cleric-weapon-1-common'),
  ('tier-4-cleric-weapon-1-rare'),
  ('tier-4-cleric-weapon-1-epic'),
  ('tier-4-cleric-weapon-2-common'),
  ('tier-4-cleric-weapon-2-rare'),
  ('tier-4-cleric-weapon-2-epic'),
  ('tier-4-cleric-offhand-common'),
  ('tier-4-cleric-offhand-rare'),
  ('tier-4-cleric-offhand-epic'),
  ('tier-4-archer-weapon-1-common'),
  ('tier-4-archer-weapon-1-rare'),
  ('tier-4-archer-weapon-1-epic'),
  ('tier-4-archer-weapon-2-common'),
  ('tier-4-archer-weapon-2-rare'),
  ('tier-4-archer-weapon-2-epic'),
  ('tier-5-chest-common'),
  ('tier-5-chest-rare'),
  ('tier-5-boots-common'),
  ('tier-5-boots-rare'),
  ('tier-5-helmet-common'),
  ('tier-5-helmet-rare'),
  ('tier-5-warrior-weapon-1-common'),
  ('tier-5-warrior-weapon-1-rare'),
  ('tier-5-warrior-weapon-1-epic'),
  ('tier-5-warrior-weapon-2-common'),
  ('tier-5-warrior-weapon-2-rare'),
  ('tier-5-warrior-weapon-2-epic'),
  ('tier-5-warrior-offhand-common'),
  ('tier-5-warrior-offhand-rare'),
  ('tier-5-warrior-offhand-epic'),
  ('tier-5-assassin-weapon-1-common'),
  ('tier-5-assassin-weapon-1-rare'),
  ('tier-5-assassin-weapon-1-epic'),
  ('tier-5-assassin-weapon-2-common'),
  ('tier-5-assassin-weapon-2-rare'),
  ('tier-5-assassin-weapon-2-epic'),
  ('tier-5-assassin-offhand-epic'),
  ('tier-5-mage-weapon-1-common'),
  ('tier-5-mage-weapon-1-rare'),
  ('tier-5-mage-weapon-1-epic'),
  ('tier-5-mage-weapon-2-common'),
  ('tier-5-mage-weapon-2-rare'),
  ('tier-5-mage-weapon-2-epic'),
  ('tier-5-mage-offhand-common'),
  ('tier-5-mage-offhand-rare'),
  ('tier-5-mage-offhand-epic'),
  ('tier-5-cleric-weapon-1-common'),
  ('tier-5-cleric-weapon-1-rare'),
  ('tier-5-cleric-weapon-1-epic'),
  ('tier-5-cleric-weapon-2-common'),
  ('tier-5-cleric-weapon-2-rare'),
  ('tier-5-cleric-weapon-2-epic'),
  ('tier-5-cleric-offhand-common'),
  ('tier-5-cleric-offhand-rare'),
  ('tier-5-cleric-offhand-epic'),
  ('tier-5-archer-weapon-1-common'),
  ('tier-5-archer-weapon-1-rare'),
  ('tier-5-archer-weapon-1-epic'),
  ('tier-5-archer-weapon-2-common'),
  ('tier-5-archer-weapon-2-rare'),
  ('tier-5-archer-weapon-2-epic'),
  ('tier-6-chest-common'),
  ('tier-6-chest-rare'),
  ('tier-6-boots-common'),
  ('tier-6-boots-rare'),
  ('tier-6-helmet-common'),
  ('tier-6-helmet-rare'),
  ('tier-6-warrior-weapon-1-common'),
  ('tier-6-warrior-weapon-1-rare'),
  ('tier-6-warrior-weapon-1-epic'),
  ('tier-6-warrior-weapon-2-common'),
  ('tier-6-warrior-weapon-2-rare'),
  ('tier-6-warrior-weapon-2-epic'),
  ('tier-6-warrior-offhand-common'),
  ('tier-6-warrior-offhand-rare'),
  ('tier-6-warrior-offhand-epic'),
  ('tier-6-assassin-weapon-1-common'),
  ('tier-6-assassin-weapon-1-rare'),
  ('tier-6-assassin-weapon-1-epic'),
  ('tier-6-assassin-weapon-2-common'),
  ('tier-6-assassin-weapon-2-rare'),
  ('tier-6-assassin-weapon-2-epic'),
  ('tier-6-assassin-offhand-epic'),
  ('tier-6-mage-weapon-1-common'),
  ('tier-6-mage-weapon-1-rare'),
  ('tier-6-mage-weapon-1-epic'),
  ('tier-6-mage-weapon-2-common'),
  ('tier-6-mage-weapon-2-rare'),
  ('tier-6-mage-weapon-2-epic'),
  ('tier-6-mage-offhand-common'),
  ('tier-6-mage-offhand-rare'),
  ('tier-6-mage-offhand-epic'),
  ('tier-6-cleric-weapon-1-common'),
  ('tier-6-cleric-weapon-1-rare'),
  ('tier-6-cleric-weapon-1-epic'),
  ('tier-6-cleric-weapon-2-common'),
  ('tier-6-cleric-weapon-2-rare'),
  ('tier-6-cleric-weapon-2-epic'),
  ('tier-6-cleric-offhand-common'),
  ('tier-6-cleric-offhand-rare'),
  ('tier-6-cleric-offhand-epic'),
  ('tier-6-archer-weapon-1-common'),
  ('tier-6-archer-weapon-1-rare'),
  ('tier-6-archer-weapon-1-epic'),
  ('tier-6-archer-weapon-2-common'),
  ('tier-6-archer-weapon-2-rare'),
  ('tier-6-archer-weapon-2-epic'),
  ('tier-7-chest-common'),
  ('tier-7-chest-rare'),
  ('tier-7-boots-common'),
  ('tier-7-boots-rare'),
  ('tier-7-helmet-common'),
  ('tier-7-helmet-rare'),
  ('tier-7-warrior-weapon-1-common'),
  ('tier-7-warrior-weapon-1-rare'),
  ('tier-7-warrior-weapon-1-epic'),
  ('tier-7-warrior-weapon-2-common'),
  ('tier-7-warrior-weapon-2-rare'),
  ('tier-7-warrior-weapon-2-epic'),
  ('tier-7-warrior-offhand-common'),
  ('tier-7-warrior-offhand-rare'),
  ('tier-7-warrior-offhand-epic'),
  ('tier-7-assassin-weapon-1-common'),
  ('tier-7-assassin-weapon-1-rare'),
  ('tier-7-assassin-weapon-1-epic'),
  ('tier-7-assassin-weapon-2-common'),
  ('tier-7-assassin-weapon-2-rare'),
  ('tier-7-assassin-weapon-2-epic'),
  ('tier-7-assassin-offhand-epic'),
  ('tier-7-mage-weapon-1-common'),
  ('tier-7-mage-weapon-1-rare'),
  ('tier-7-mage-weapon-1-epic'),
  ('tier-7-mage-weapon-2-common'),
  ('tier-7-mage-weapon-2-rare'),
  ('tier-7-mage-weapon-2-epic'),
  ('tier-7-mage-offhand-common'),
  ('tier-7-mage-offhand-rare'),
  ('tier-7-mage-offhand-epic'),
  ('tier-7-cleric-weapon-1-common'),
  ('tier-7-cleric-weapon-1-rare'),
  ('tier-7-cleric-weapon-1-epic'),
  ('tier-7-cleric-weapon-2-common'),
  ('tier-7-cleric-weapon-2-rare'),
  ('tier-7-cleric-weapon-2-epic'),
  ('tier-7-cleric-offhand-common'),
  ('tier-7-cleric-offhand-rare'),
  ('tier-7-cleric-offhand-epic'),
  ('tier-7-archer-weapon-1-common'),
  ('tier-7-archer-weapon-1-rare'),
  ('tier-7-archer-weapon-1-epic'),
  ('tier-7-archer-weapon-2-common'),
  ('tier-7-archer-weapon-2-rare'),
  ('tier-7-archer-weapon-2-epic'),
  ('tier-8-chest-common'),
  ('tier-8-chest-rare'),
  ('tier-8-boots-common'),
  ('tier-8-boots-rare'),
  ('tier-8-helmet-common'),
  ('tier-8-helmet-rare'),
  ('tier-8-warrior-weapon-1-common'),
  ('tier-8-warrior-weapon-1-rare'),
  ('tier-8-warrior-weapon-1-epic'),
  ('tier-8-warrior-weapon-2-common'),
  ('tier-8-warrior-weapon-2-rare'),
  ('tier-8-warrior-weapon-2-epic'),
  ('tier-8-warrior-offhand-common'),
  ('tier-8-warrior-offhand-rare'),
  ('tier-8-warrior-offhand-epic'),
  ('tier-8-assassin-weapon-1-common'),
  ('tier-8-assassin-weapon-1-rare'),
  ('tier-8-assassin-weapon-1-epic'),
  ('tier-8-assassin-weapon-2-common'),
  ('tier-8-assassin-weapon-2-rare'),
  ('tier-8-assassin-weapon-2-epic'),
  ('tier-8-assassin-offhand-epic'),
  ('tier-8-mage-weapon-1-common'),
  ('tier-8-mage-weapon-1-rare'),
  ('tier-8-mage-weapon-1-epic'),
  ('tier-8-mage-weapon-2-common'),
  ('tier-8-mage-weapon-2-rare'),
  ('tier-8-mage-weapon-2-epic'),
  ('tier-8-mage-offhand-common'),
  ('tier-8-mage-offhand-rare'),
  ('tier-8-mage-offhand-epic'),
  ('tier-8-cleric-weapon-1-common'),
  ('tier-8-cleric-weapon-1-rare'),
  ('tier-8-cleric-weapon-1-epic'),
  ('tier-8-cleric-weapon-2-common'),
  ('tier-8-cleric-weapon-2-rare'),
  ('tier-8-cleric-weapon-2-epic'),
  ('tier-8-cleric-offhand-common'),
  ('tier-8-cleric-offhand-rare'),
  ('tier-8-cleric-offhand-epic'),
  ('tier-8-archer-weapon-1-common'),
  ('tier-8-archer-weapon-1-rare'),
  ('tier-8-archer-weapon-1-epic'),
  ('tier-8-archer-weapon-2-common'),
  ('tier-8-archer-weapon-2-rare'),
  ('tier-8-archer-weapon-2-epic'),
  ('tier-9-chest-common'),
  ('tier-9-chest-rare'),
  ('tier-9-boots-common'),
  ('tier-9-boots-rare'),
  ('tier-9-helmet-common'),
  ('tier-9-helmet-rare'),
  ('tier-9-warrior-weapon-1-common'),
  ('tier-9-warrior-weapon-1-rare'),
  ('tier-9-warrior-weapon-1-epic'),
  ('tier-9-warrior-weapon-2-common'),
  ('tier-9-warrior-weapon-2-rare'),
  ('tier-9-warrior-weapon-2-epic'),
  ('tier-9-warrior-offhand-common'),
  ('tier-9-warrior-offhand-rare'),
  ('tier-9-warrior-offhand-epic'),
  ('tier-9-assassin-weapon-1-common'),
  ('tier-9-assassin-weapon-1-rare'),
  ('tier-9-assassin-weapon-1-epic'),
  ('tier-9-assassin-weapon-2-common'),
  ('tier-9-assassin-weapon-2-rare'),
  ('tier-9-assassin-weapon-2-epic'),
  ('tier-9-assassin-offhand-epic'),
  ('tier-9-mage-weapon-1-common'),
  ('tier-9-mage-weapon-1-rare'),
  ('tier-9-mage-weapon-1-epic'),
  ('tier-9-mage-weapon-2-common'),
  ('tier-9-mage-weapon-2-rare'),
  ('tier-9-mage-weapon-2-epic'),
  ('tier-9-mage-offhand-common'),
  ('tier-9-mage-offhand-rare'),
  ('tier-9-mage-offhand-epic'),
  ('tier-9-cleric-weapon-1-common'),
  ('tier-9-cleric-weapon-1-rare'),
  ('tier-9-cleric-weapon-1-epic'),
  ('tier-9-cleric-weapon-2-common'),
  ('tier-9-cleric-weapon-2-rare'),
  ('tier-9-cleric-weapon-2-epic'),
  ('tier-9-cleric-offhand-common'),
  ('tier-9-cleric-offhand-rare'),
  ('tier-9-cleric-offhand-epic'),
  ('tier-9-archer-weapon-1-common'),
  ('tier-9-archer-weapon-1-rare'),
  ('tier-9-archer-weapon-1-epic'),
  ('tier-9-archer-weapon-2-common'),
  ('tier-9-archer-weapon-2-rare'),
  ('tier-9-archer-weapon-2-epic'),
  ('cthulhu-tentacle'),
  ('seventh-fang'),
  ('medusa-eye'),
  ('cheshire-grin'),
  ('curupira-charm'),
  ('vizier-seal'),
  ('mad-scientist-seal'),
  ('oz-heart'),
  ('orochi-scale'),
  ('sisyphus-stone')
on conflict (definition_id) do nothing;

create table if not exists public.expedition_reward_claims (
  expedition_id uuid primary key references public.expeditions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  gold_credited bigint not null check (gold_credited >= 0),
  items_credited integer not null check (items_credited >= 0),
  created_at timestamptz not null default now()
);

alter table public.item_catalog enable row level security;
alter table public.expedition_reward_claims enable row level security;
revoke all on public.item_catalog from anon, authenticated;
revoke all on public.expedition_reward_claims from anon, authenticated;

create or replace function public.extract_player_expedition(
  p_expedition_id uuid,
  p_gold bigint,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_floor integer;
  v_status text;
  v_item_count integer;
  v_wallet_gold bigint;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;
  if p_expedition_id is null
    or p_gold is null or p_gold < 0 or p_gold > 1000000000
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) > 500 then
    raise exception 'Recompensas da extração inválidas.';
  end if;

  select e.current_floor, e.status
    into v_floor, v_status
  from public.expeditions e
  where e.id = p_expedition_id and e.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Expedição não encontrada.';
  end if;

  if exists (
    select 1 from public.expedition_reward_claims c
    where c.expedition_id = p_expedition_id and c.user_id = v_user_id
  ) then
    select w.gold into v_wallet_gold
    from public.player_wallet w where w.user_id = v_user_id;
    return jsonb_build_object('already_processed', true, 'gold', coalesce(v_wallet_gold, 0));
  end if;

  if v_status <> 'active' then
    raise exception 'Esta expedição já foi encerrada.';
  end if;
  if v_floor < 5 or (v_floor % 5 <> 0 and v_floor <> 100) then
    raise exception 'A extração só pode ocorrer em marcos de 5 andares.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(definition_id text, obtained_at_floor integer)
    left join public.item_catalog catalog
      on catalog.definition_id = item.definition_id
    where item.definition_id is null
       or catalog.definition_id is null
       or item.obtained_at_floor is null
       or item.obtained_at_floor < 1
       or item.obtained_at_floor > v_floor
  ) then
    raise exception 'A lista contém um item ou andar inválido.';
  end if;

  select count(*) into v_item_count
  from jsonb_to_recordset(p_items) as item(definition_id text, obtained_at_floor integer);

  update public.player_wallet
  set gold = gold + p_gold, updated_at = now()
  where user_id = v_user_id;

  if not found then
    raise exception 'Carteira do jogador não encontrada.';
  end if;

  insert into public.inventory (user_id, item_definition_id, obtained_at_floor)
  select v_user_id, item.definition_id, item.obtained_at_floor
  from jsonb_to_recordset(p_items) as item(definition_id text, obtained_at_floor integer);

  update public.expeditions
  set status = 'extracted',
      result = 'extraction',
      ended_at = now(),
      last_activity_at = now()
  where id = p_expedition_id and user_id = v_user_id and status = 'active';

  if not found then
    raise exception 'Não foi possível finalizar a expedição.';
  end if;

  insert into public.expedition_reward_claims
    (expedition_id, user_id, gold_credited, items_credited)
  values
    (p_expedition_id, v_user_id, p_gold, v_item_count);

  select w.gold into v_wallet_gold
  from public.player_wallet w where w.user_id = v_user_id;

  return jsonb_build_object(
    'already_processed', false,
    'gold_credited', p_gold,
    'items_credited', v_item_count,
    'wallet_gold', v_wallet_gold
  );
end;
$$;

revoke all on function public.extract_player_expedition(uuid, bigint, jsonb) from public;
revoke all on function public.extract_player_expedition(uuid, bigint, jsonb) from anon;
grant execute on function public.extract_player_expedition(uuid, bigint, jsonb) to authenticated;
