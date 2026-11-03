-- Alocação atômica e validada de atributos.
-- Execute esta migration uma única vez no SQL Editor do Supabase.

create or replace function public.allocate_character_attribute(
  p_character_id uuid,
  p_attribute text,
  p_points integer default 1
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
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  if p_attribute not in ('strength', 'vitality', 'defense') then
    raise exception 'Atributo inválido.';
  end if;

  if p_points is null or p_points < 1 or p_points > 100 then
    raise exception 'Quantidade de pontos inválida.';
  end if;

  return query
  update public.characters as character
  set
    strength = character.strength + case when p_attribute = 'strength' then p_points else 0 end,
    vitality = character.vitality + case when p_attribute = 'vitality' then p_points else 0 end,
    defense = character.defense + case when p_attribute = 'defense' then p_points else 0 end,
    unspent_attribute_points = character.unspent_attribute_points - p_points,
    updated_at = now()
  where character.id = p_character_id
    and character.user_id = auth.uid()
    and character.unspent_attribute_points >= p_points
  returning
    character.id,
    character.class_id,
    character.level,
    character.xp,
    character.unspent_attribute_points,
    character.strength,
    character.vitality,
    character.defense;

  if not found then
    raise exception 'Personagem não encontrado ou pontos insuficientes.';
  end if;
end;
$$;

revoke all on function public.allocate_character_attribute(uuid, text, integer) from public;
grant execute on function public.allocate_character_attribute(uuid, text, integer) to authenticated;
