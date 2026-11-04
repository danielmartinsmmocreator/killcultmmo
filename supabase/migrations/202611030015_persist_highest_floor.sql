-- Mantém no perfil do jogador o maior andar já alcançado em qualquer expedição.
alter table public.profiles
  add column if not exists highest_floor integer not null default 1
  check (highest_floor between 1 and 100);

-- Recupera o melhor progresso das expedições já registradas.
update public.profiles p
set highest_floor = greatest(
  p.highest_floor,
  coalesce((
    select max(e.current_floor)
    from public.expeditions e
    where e.user_id = p.id
  ), 1)
);

create or replace function public.sync_profile_highest_floor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set highest_floor = greatest(highest_floor, new.current_floor)
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists sync_expedition_highest_floor on public.expeditions;
create trigger sync_expedition_highest_floor
after insert or update of current_floor on public.expeditions
for each row
execute function public.sync_profile_highest_floor();
