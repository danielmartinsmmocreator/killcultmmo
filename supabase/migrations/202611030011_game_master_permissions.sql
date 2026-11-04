-- Permissão de Game Master separada do perfil editável pelo jogador.
-- A conta indicada recebe o papel durante a migration; nenhum cliente pode conceder esse papel.

create table if not exists public.game_master_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.game_master_accounts enable row level security;
revoke all on public.game_master_accounts from public, anon, authenticated;

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('danizelves@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'A conta danizelves@gmail.com não foi encontrada em auth.users. Crie a conta antes de aplicar esta migration.';
  end if;

  insert into public.game_master_accounts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.is_current_user_game_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_master_accounts gm
    where gm.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_current_user_game_master() from public, anon;
grant execute on function public.is_current_user_game_master() to authenticated;
