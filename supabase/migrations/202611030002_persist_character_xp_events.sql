-- Eventos de XP idempotentes e cálculo da progressão no banco.
-- A função evita duplicidade e não aceita XP/nível final enviado pelo navegador.
-- Observação: enquanto o combate for executado no cliente, os dados-base do monstro
-- ainda podem ser forjados; a autoridade anti-cheat completa exige combate no servidor.

create table public.character_progression_events (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null,
  character_id uuid not null,
  event_kind text not null check (event_kind in ('kill', 'death')),
  xp_delta integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id),
  foreign key (character_id, user_id)
    references public.characters(id, user_id) on delete cascade
);

create index character_progression_events_character_idx
  on public.character_progression_events(character_id, created_at desc);

alter table public.character_progression_events enable row level security;
revoke all on public.character_progression_events from anon, authenticated;

create or replace function public.apply_character_xp_event(
  p_character_id uuid,
  p_event_id uuid,
  p_event_kind text,
  p_monster_max_hp integer default null,
  p_monster_damage integer default null,
  p_monster_rank text default null
)
returns table (
  id uuid,
  class_id text,
  level integer,
  xp integer,
  unspent_attribute_points integer,
  strength integer,
  vitality integer,
  defense integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_character public.characters%rowtype;
  v_xp_delta integer;
  v_required integer;
  v_new_xp integer;
  v_new_level integer;
  v_new_points integer;
  v_inserted_event_id uuid;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;

  if p_character_id is null or p_event_id is null then
    raise exception 'Identificação do evento inválida.';
  end if;

  if p_event_kind is null or p_event_kind not in ('kill', 'death') then
    raise exception 'Tipo de evento inválido.';
  end if;

  select character.*
    into v_character
  from public.characters as character
  where character.id = p_character_id
    and character.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Personagem não encontrado.';
  end if;

  if p_event_kind = 'kill' then
    if p_monster_max_hp is null or p_monster_max_hp < 1 or p_monster_max_hp > 100000
      or p_monster_damage is null or p_monster_damage < 0 or p_monster_damage > 10000
      or p_monster_rank is null
      or p_monster_rank not in ('normal', 'mini-boss', 'boss') then
      raise exception 'Dados de monstro inválidos.';
    end if;

    v_xp_delta := greatest(
      10,
      round(
        (p_monster_max_hp + p_monster_damage * 3)::numeric
        * case p_monster_rank
            when 'boss' then 2.5
            when 'mini-boss' then 1.5
            else 1
          end
      )::integer
    );
  else
    v_xp_delta := -least(
      v_character.xp,
      ceil(round(100 * power(1.02::numeric, v_character.level - 1)) * 0.1)::integer
    );
    if v_xp_delta = 0 then
      return query select v_character.id, v_character.class_id, v_character.level,
        v_character.xp, v_character.unspent_attribute_points,
        v_character.strength, v_character.vitality, v_character.defense;
      return;
    end if;
  end if;

  insert into public.character_progression_events (
    user_id, event_id, character_id, event_kind, xp_delta
  )
  values (v_user_id, p_event_id, p_character_id, p_event_kind, v_xp_delta)
  on conflict (user_id, event_id) do nothing
  returning event_id into v_inserted_event_id;

  if v_inserted_event_id is null then
    return query select character.id, character.class_id, character.level,
      character.xp, character.unspent_attribute_points,
      character.strength, character.vitality, character.defense
    from public.characters as character
    where character.id = p_character_id and character.user_id = v_user_id;
    return;
  end if;

  v_new_xp := greatest(0, v_character.xp + v_xp_delta);
  v_new_level := v_character.level;
  v_new_points := v_character.unspent_attribute_points;

  while v_new_level < 999 loop
    v_required := round(100 * power(1.02::numeric, v_new_level - 1))::integer;
    exit when v_new_xp < v_required;
    v_new_xp := v_new_xp - v_required;
    v_new_level := v_new_level + 1;
    v_new_points := v_new_points + 3;
  end loop;

  return query
  update public.characters as character
  set
    xp = v_new_xp,
    level = v_new_level,
    unspent_attribute_points = v_new_points,
    updated_at = now()
  where character.id = p_character_id
    and character.user_id = v_user_id
  returning character.id, character.class_id, character.level,
    character.xp, character.unspent_attribute_points,
    character.strength, character.vitality, character.defense;
end;
$$;

revoke all on function public.apply_character_xp_event(uuid, uuid, text, integer, integer, text) from public;
grant execute on function public.apply_character_xp_event(uuid, uuid, text, integer, integer, text) to authenticated;
