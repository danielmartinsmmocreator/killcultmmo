-- Concede Game Master diretamente à conta autenticada pelo UUID confirmado.
insert into public.game_master_accounts (user_id)
select id
from auth.users
where id = 'b8de706e-d9e3-4ea5-802f-d67137c2d972'::uuid
on conflict (user_id) do nothing;

do $$
begin
  if not exists (
    select 1
    from public.game_master_accounts
    where user_id = 'b8de706e-d9e3-4ea5-802f-d67137c2d972'::uuid
  ) then
    raise exception 'A conta com o UUID informado não foi encontrada em auth.users.';
  end if;
end;
$$;
