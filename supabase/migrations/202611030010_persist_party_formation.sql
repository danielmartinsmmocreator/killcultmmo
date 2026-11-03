-- Persistência da última formação escolhida na base de operações.
alter table public.profiles
  add column if not exists party_formation jsonb;

create or replace function public.save_player_party_formation(p_formation jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_distinct_classes integer;
  v_distinct_positions integer;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;

  if p_formation is null
    or jsonb_typeof(p_formation) <> 'object'
    or p_formation ->> 'version' is distinct from '1'
    or jsonb_typeof(p_formation -> 'heroes') <> 'array' then
    raise exception 'Formação inválida.';
  end if;

  v_count := jsonb_array_length(p_formation -> 'heroes');
  if v_count < 1 or v_count > 3 then
    raise exception 'A formação deve conter de 1 a 3 heróis.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_formation -> 'heroes') as entry(value)
    where jsonb_typeof(entry.value) <> 'object'
      or entry.value ->> 'classId' is null
      or entry.value ->> 'classId' not in ('warrior', 'mage', 'cleric', 'assassin', 'archer')
      or jsonb_typeof(entry.value -> 'position') <> 'object'
      or jsonb_typeof(entry.value #> '{position,col}') is distinct from 'number'
      or jsonb_typeof(entry.value #> '{position,row}') is distinct from 'number'
      or (entry.value #>> '{position,col}') !~ '^[0-5]$'
      or (entry.value #>> '{position,row}') !~ '^[3-5]$'
  ) then
    raise exception 'A formação contém herói ou posição inválida.';
  end if;

  select count(distinct entry.value ->> 'classId'),
         count(distinct (entry.value #>> '{position,col}') || ',' || (entry.value #>> '{position,row}'))
  into v_distinct_classes, v_distinct_positions
  from jsonb_array_elements(p_formation -> 'heroes') as entry(value);

  if v_distinct_classes <> v_count or v_distinct_positions <> v_count then
    raise exception 'A formação não pode repetir heróis ou posições.';
  end if;

  update public.profiles
  set party_formation = p_formation,
      updated_at = now()
  where id = v_user_id;

  if not found then
    raise exception 'Perfil do jogador não encontrado.';
  end if;
end;
$$;

revoke all on function public.save_player_party_formation(jsonb) from public, anon;
grant execute on function public.save_player_party_formation(jsonb) to authenticated;
