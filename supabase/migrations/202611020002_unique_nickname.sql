-- KillCult MMO: nickname publico e unico, sem diferenciar maiusculas/minusculas.
alter table public.profiles
  add column if not exists nickname text;

-- Compatibilidade com contas que eventualmente ja existam antes desta migracao.
update public.profiles
set nickname = coalesce(
  nullif(trim(display_name), ''),
  'jogador_' || substr(id::text, 1, 8)
)
where nickname is null or trim(nickname) = '';

alter table public.profiles
  alter column nickname set not null;

alter table public.profiles
  add constraint profiles_nickname_format
  check (nickname = trim(nickname) and char_length(nickname) between 3 and 20);

create unique index if not exists profiles_nickname_lower_unique
  on public.profiles (lower(nickname));

-- Mantem o nome de exibicao sincronizado com o nickname informado no cadastro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_nickname text;
begin
  requested_nickname := nullif(trim(new.raw_user_meta_data ->> 'nickname'), '');

  if requested_nickname is null
     or char_length(requested_nickname) < 3
     or char_length(requested_nickname) > 20 then
    raise exception 'Nickname invalido. Use de 3 a 20 caracteres.';
  end if;

  insert into public.profiles (id, display_name, nickname)
  values (new.id, requested_nickname, requested_nickname);

  insert into public.player_wallet (user_id) values (new.id);

  insert into public.characters (user_id, class_id)
  values
    (new.id, 'warrior'),
    (new.id, 'mage'),
    (new.id, 'cleric'),
    (new.id, 'assassin'),
    (new.id, 'archer');

  return new;
end;
$$;
