-- KillCult MMO: fundação das guildas, membros, permissões e cofre comunitário.
-- Executar no Supabase SQL Editor após as migrations anteriores.

create table public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null,
  description text not null default '',
  leader_user_id uuid not null references public.profiles(id) on delete restrict,
  bank_view_access text not null default 'all_members'
    check (bank_view_access in ('leader_admins', 'all_members')),
  bank_deposit_access text not null default 'all_members'
    check (bank_deposit_access in ('leader_admins', 'all_members')),
  bank_withdraw_access text not null default 'leader_admins'
    check (bank_withdraw_access in ('leader_admins', 'all_members')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guilds_name_length check (char_length(trim(name)) between 3 and 24),
  constraint guilds_tag_format check (tag = upper(tag) and tag ~ '^[A-Z0-9]{2,5}$')
);

create unique index guilds_name_lower_unique on public.guilds (lower(name));
create unique index guilds_tag_unique on public.guilds (tag);

create table public.guild_members (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (guild_id, user_id),
  unique (user_id)
);

create index guild_members_guild_role_idx on public.guild_members (guild_id, role);

create table public.guild_invites (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (guild_id, invited_user_id)
);

create index guild_invites_recipient_idx on public.guild_invites (invited_user_id, status);

create table public.guild_bank_items (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  item_definition_id text not null references public.item_catalog(definition_id),
  obtained_at_floor integer check (obtained_at_floor is null or obtained_at_floor >= 1),
  deposited_by uuid not null references public.profiles(id) on delete restrict,
  deposited_at timestamptz not null default now()
);

create index guild_bank_items_guild_idx on public.guild_bank_items (guild_id, deposited_at);

create table public.guild_bank_logs (
  id bigint generated always as identity primary key,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('deposit', 'withdraw')),
  item_definition_id text not null references public.item_catalog(definition_id),
  created_at timestamptz not null default now()
);

create index guild_bank_logs_guild_idx on public.guild_bank_logs (guild_id, created_at desc);

alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
alter table public.guild_invites enable row level security;
alter table public.guild_bank_items enable row level security;
alter table public.guild_bank_logs enable row level security;

create or replace function public.current_guild_role(p_guild_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select gm.role
  from public.guild_members gm
  where gm.guild_id = p_guild_id and gm.user_id = auth.uid()
  limit 1;
$$;

create policy "Guild members can read their guild"
  on public.guilds for select to authenticated
  using (public.current_guild_role(id) is not null);

create policy "Guild members can read roster"
  on public.guild_members for select to authenticated
  using (public.current_guild_role(guild_id) is not null);

create policy "Players can read received guild invites"
  on public.guild_invites for select to authenticated
  using (invited_user_id = (select auth.uid()));

create policy "Members with bank access can view guild items"
  on public.guild_bank_items for select to authenticated
  using (
    public.current_guild_role(guild_id) in ('leader', 'admin')
    or (
      public.current_guild_role(guild_id) = 'member'
      and exists (
        select 1 from public.guilds g
        where g.id = guild_bank_items.guild_id
          and g.bank_view_access = 'all_members'
      )
    )
  );

create policy "Guild leaders and admins can read bank logs"
  on public.guild_bank_logs for select to authenticated
  using (public.current_guild_role(guild_id) in ('leader', 'admin'));

create or replace function public.get_my_guild_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;

  select gm.guild_id into v_guild_id
  from public.guild_members gm
  where gm.user_id = v_user_id;

  if v_guild_id is null then
    select jsonb_build_object(
      'guild', null,
      'invites', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', gi.id,
          'guild_id', gi.guild_id,
          'guild_name', g.name,
          'guild_tag', g.tag,
          'invited_by_nickname', inviter.nickname,
          'created_at', gi.created_at
        ) order by gi.created_at desc)
        from public.guild_invites gi
        join public.guilds g on g.id = gi.guild_id
        join public.profiles inviter on inviter.id = gi.invited_by
        where gi.invited_user_id = v_user_id and gi.status = 'pending'
      ), '[]'::jsonb)
    ) into v_result;
    return v_result;
  end if;

  select jsonb_build_object(
    'guild', jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'tag', g.tag,
      'description', g.description,
      'leader_user_id', g.leader_user_id,
      'created_at', g.created_at,
      'bank_view_access', g.bank_view_access,
      'bank_deposit_access', g.bank_deposit_access,
      'bank_withdraw_access', g.bank_withdraw_access,
      'member_count', (select count(*) from public.guild_members count_members where count_members.guild_id = g.id),
      'global_level', coalesce((
        select sum(c.level)
        from public.guild_members members
        join public.characters c on c.user_id = members.user_id
        where members.guild_id = g.id
      ), 0),
      'my_role', mine.role,
      'members', coalesce((
        select jsonb_agg(jsonb_build_object(
          'user_id', gm.user_id,
          'nickname', p.nickname,
          'role', gm.role,
          'global_level', coalesce((select sum(c.level) from public.characters c where c.user_id = gm.user_id), 0),
          'joined_at', gm.joined_at
        ) order by case gm.role when 'leader' then 0 when 'admin' then 1 else 2 end, lower(p.nickname))
        from public.guild_members gm
        join public.profiles p on p.id = gm.user_id
        where gm.guild_id = g.id
      ), '[]'::jsonb),
      'invites', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', gi.id,
          'nickname', p.nickname,
          'created_at', gi.created_at
        ) order by gi.created_at desc)
        from public.guild_invites gi
        join public.profiles p on p.id = gi.invited_user_id
        where gi.guild_id = g.id and gi.status = 'pending'
      ), '[]'::jsonb)
    )
  ) into v_result
  from public.guilds g
  join public.guild_members mine on mine.guild_id = g.id and mine.user_id = v_user_id
  where g.id = v_guild_id;

  return v_result;
end;
$$;

create or replace function public.create_guild(p_name text, p_tag text, p_description text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_tag text := upper(trim(coalesce(p_tag, '')));
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  if exists (select 1 from public.guild_members gm where gm.user_id = v_user_id) then
    raise exception 'Você já participa de uma guilda.';
  end if;
  if char_length(v_name) not between 3 and 24 then raise exception 'O nome deve ter de 3 a 24 caracteres.'; end if;
  if v_tag !~ '^[A-Z0-9]{2,5}$' then raise exception 'A tag deve ter de 2 a 5 letras ou números.'; end if;
  insert into public.guilds (name, tag, description, leader_user_id)
  values (v_name, v_tag, left(trim(coalesce(p_description, '')), 240), v_user_id)
  returning id into v_guild_id;
  insert into public.guild_members (guild_id, user_id, role) values (v_guild_id, v_user_id, 'leader');
  return v_guild_id;
exception
  when unique_violation then raise exception 'Esse nome ou tag já está sendo utilizado.';
end;
$$;

create or replace function public.invite_guild_member(p_nickname text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
  v_target_id uuid;
  v_invite_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  select gm.guild_id into v_guild_id from public.guild_members gm
  where gm.user_id = v_user_id and gm.role in ('leader', 'admin');
  if v_guild_id is null then raise exception 'Somente líder ou administrador pode convidar.'; end if;
  select p.id into v_target_id from public.profiles p
  where lower(p.nickname) = lower(trim(coalesce(p_nickname, '')));
  if v_target_id is null then raise exception 'Jogador não encontrado.'; end if;
  if v_target_id = v_user_id then raise exception 'Você não pode convidar a si mesmo.'; end if;
  if exists (select 1 from public.guild_members gm where gm.user_id = v_target_id) then
    raise exception 'Esse jogador já participa de uma guilda.';
  end if;
  insert into public.guild_invites (guild_id, invited_user_id, invited_by, status)
  values (v_guild_id, v_target_id, v_user_id, 'pending')
  on conflict (guild_id, invited_user_id) do update
    set invited_by = excluded.invited_by, status = 'pending', created_at = now(), responded_at = null
  returning id into v_invite_id;
  return v_invite_id;
end;
$$;

create or replace function public.respond_guild_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  select gi.guild_id into v_guild_id from public.guild_invites gi
  where gi.id = p_invite_id and gi.invited_user_id = v_user_id and gi.status = 'pending'
  for update;
  if v_guild_id is null then raise exception 'Convite não encontrado ou expirado.'; end if;
  if p_accept then
    if exists (select 1 from public.guild_members gm where gm.user_id = v_user_id) then
      raise exception 'Você já participa de uma guilda.';
    end if;
    insert into public.guild_members (guild_id, user_id, role) values (v_guild_id, v_user_id, 'member');
    update public.guild_invites set status = 'accepted', responded_at = now()
    where id = p_invite_id;
    update public.guild_invites set status = 'cancelled', responded_at = now()
    where invited_user_id = v_user_id and status = 'pending' and id <> p_invite_id;
  else
    update public.guild_invites set status = 'declined', responded_at = now() where id = p_invite_id;
  end if;
end;
$$;

create or replace function public.set_guild_member_role(p_target_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Cargo inválido.'; end if;
  select gm.guild_id into v_guild_id from public.guild_members gm
  where gm.user_id = v_user_id and gm.role = 'leader';
  if v_guild_id is null then raise exception 'Somente o líder pode alterar administradores.'; end if;
  update public.guild_members set role = p_role
  where guild_id = v_guild_id and user_id = p_target_user_id and role <> 'leader';
  if not found then raise exception 'Membro não encontrado.'; end if;
end;
$$;

create or replace function public.remove_guild_member(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
  v_target_role text;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  select guild_id into v_guild_id from public.guild_members where user_id = v_user_id;
  select role into v_target_role from public.guild_members
  where guild_id = v_guild_id and user_id = p_target_user_id;
  if v_target_role is null then raise exception 'Membro não encontrado.'; end if;
  if v_target_role = 'leader' then raise exception 'A liderança não pode ser removida.'; end if;
  if not exists (
    select 1 from public.guild_members
    where guild_id = v_guild_id and user_id = v_user_id
      and (role = 'leader' or (role = 'admin' and v_target_role = 'member'))
  ) then raise exception 'Você não tem permissão para remover esse membro.'; end if;
  delete from public.guild_members where guild_id = v_guild_id and user_id = p_target_user_id;
end;
$$;

create or replace function public.leave_guild()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_guild_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  select guild_id, role into v_guild_id, v_role from public.guild_members where user_id = v_user_id;
  if v_guild_id is null then raise exception 'Você não participa de uma guilda.'; end if;
  if v_role = 'leader' then raise exception 'Transfira a liderança antes de sair da guilda.'; end if;
  delete from public.guild_members where guild_id = v_guild_id and user_id = v_user_id;
end;
$$;

create or replace function public.transfer_guild_leadership(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  select guild_id into v_guild_id from public.guild_members
  where user_id = v_user_id and role = 'leader';
  if v_guild_id is null then raise exception 'Somente o líder pode transferir a liderança.'; end if;
  if not exists (select 1 from public.guild_members where guild_id = v_guild_id and user_id = p_target_user_id) then
    raise exception 'O novo líder precisa ser membro da guilda.';
  end if;
  update public.guild_members set role = 'admin' where guild_id = v_guild_id and user_id = v_user_id;
  update public.guild_members set role = 'leader' where guild_id = v_guild_id and user_id = p_target_user_id;
  update public.guilds set leader_user_id = p_target_user_id, updated_at = now() where id = v_guild_id;
end;
$$;

create or replace function public.update_guild_bank_permissions(
  p_view_access text,
  p_deposit_access text,
  p_withdraw_access text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  if p_view_access not in ('leader_admins', 'all_members')
    or p_deposit_access not in ('leader_admins', 'all_members')
    or p_withdraw_access not in ('leader_admins', 'all_members') then
    raise exception 'Configuração de acesso inválida.';
  end if;
  select guild_id into v_guild_id from public.guild_members
  where user_id = v_user_id and role = 'leader';
  if v_guild_id is null then raise exception 'Somente o líder pode configurar o cofre.'; end if;
  update public.guilds
  set bank_view_access = p_view_access,
      bank_deposit_access = p_deposit_access,
      bank_withdraw_access = p_withdraw_access,
      updated_at = now()
  where id = v_guild_id;
end;
$$;

create or replace function public.deposit_guild_bank_item(p_inventory_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
  v_role text;
  v_view_access text;
  v_deposit_access text;
  v_definition_id text;
  v_floor integer;
  v_bank_item_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  select gm.guild_id, gm.role, g.bank_deposit_access
    into v_guild_id, v_role, v_deposit_access
  from public.guild_members gm join public.guilds g on g.id = gm.guild_id
  where gm.user_id = v_user_id;
  if v_guild_id is null then raise exception 'Você não participa de uma guilda.'; end if;
  if v_deposit_access = 'leader_admins' and v_role not in ('leader', 'admin') then
    raise exception 'Você não tem permissão para depositar no cofre.';
  end if;
  select i.item_definition_id, i.obtained_at_floor into v_definition_id, v_floor
  from public.inventory i
  where i.id = p_inventory_item_id and i.user_id = v_user_id
  for update;
  if not found then raise exception 'Item não encontrado no inventário permanente.'; end if;
  if exists (select 1 from public.equipped_items e where e.inventory_item_id = p_inventory_item_id) then
    raise exception 'Remova o item do personagem antes de depositá-lo.';
  end if;
  delete from public.inventory where id = p_inventory_item_id and user_id = v_user_id;
  insert into public.guild_bank_items (guild_id, item_definition_id, obtained_at_floor, deposited_by)
  values (v_guild_id, v_definition_id, v_floor, v_user_id)
  returning id into v_bank_item_id;
  insert into public.guild_bank_logs (guild_id, actor_user_id, action, item_definition_id)
  values (v_guild_id, v_user_id, 'deposit', v_definition_id);
  return v_bank_item_id;
end;
$$;

create or replace function public.withdraw_guild_bank_item(p_bank_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
  v_role text;
  v_withdraw_access text;
  v_definition_id text;
  v_floor integer;
  v_inventory_item_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária.'; end if;
  select gm.guild_id, gm.role, g.bank_withdraw_access
    into v_guild_id, v_role, v_withdraw_access
  from public.guild_members gm join public.guilds g on g.id = gm.guild_id
  where gm.user_id = v_user_id;
  if v_guild_id is null then raise exception 'Você não participa de uma guilda.'; end if;
  if v_withdraw_access = 'leader_admins' and v_role not in ('leader', 'admin') then
    raise exception 'Você não tem permissão para retirar itens do cofre.';
  end if;
  select bi.item_definition_id, bi.obtained_at_floor
    into v_definition_id, v_floor
  from public.guild_bank_items bi
  where bi.id = p_bank_item_id and bi.guild_id = v_guild_id
  for update;
  if not found then raise exception 'Item não encontrado no cofre.'; end if;
  insert into public.inventory (user_id, item_definition_id, obtained_at_floor)
  values (v_user_id, v_definition_id, v_floor)
  returning id into v_inventory_item_id;
  delete from public.guild_bank_items where id = p_bank_item_id and guild_id = v_guild_id;
  insert into public.guild_bank_logs (guild_id, actor_user_id, action, item_definition_id)
  values (v_guild_id, v_user_id, 'withdraw', v_definition_id);
  return v_inventory_item_id;
end;
$$;

revoke all on function public.current_guild_role(uuid) from public, anon;
grant execute on function public.current_guild_role(uuid) to authenticated;

revoke all on function public.get_my_guild_data() from public, anon;
revoke all on function public.create_guild(text, text, text) from public, anon;
revoke all on function public.invite_guild_member(text) from public, anon;
revoke all on function public.respond_guild_invite(uuid, boolean) from public, anon;
revoke all on function public.set_guild_member_role(uuid, text) from public, anon;
revoke all on function public.remove_guild_member(uuid) from public, anon;
revoke all on function public.leave_guild() from public, anon;
revoke all on function public.transfer_guild_leadership(uuid) from public, anon;
revoke all on function public.update_guild_bank_permissions(text, text, text) from public, anon;
revoke all on function public.deposit_guild_bank_item(uuid) from public, anon;
revoke all on function public.withdraw_guild_bank_item(uuid) from public, anon;

grant execute on function public.get_my_guild_data() to authenticated;
grant execute on function public.create_guild(text, text, text) to authenticated;
grant execute on function public.invite_guild_member(text) to authenticated;
grant execute on function public.respond_guild_invite(uuid, boolean) to authenticated;
grant execute on function public.set_guild_member_role(uuid, text) to authenticated;
grant execute on function public.remove_guild_member(uuid) to authenticated;
grant execute on function public.leave_guild() to authenticated;
grant execute on function public.transfer_guild_leadership(uuid) to authenticated;
grant execute on function public.update_guild_bank_permissions(text, text, text) to authenticated;
grant execute on function public.deposit_guild_bank_item(uuid) to authenticated;
grant execute on function public.withdraw_guild_bank_item(uuid) to authenticated;
