-- KillCult MMO: chat persistente e em tempo real das guildas.
-- Executar no Supabase SQL Editor após a migration da fundação das guildas.

create table public.guild_chat_messages (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  sender_user_id uuid references public.profiles(id) on delete set null,
  sender_nickname text not null default 'Jogador',
  sender_role text not null default 'member'
    check (sender_role in ('leader', 'admin', 'member')),
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index guild_chat_messages_guild_created_idx
  on public.guild_chat_messages (guild_id, created_at desc);

alter table public.guild_chat_messages enable row level security;

create policy "Guild members can read guild chat"
  on public.guild_chat_messages for select to authenticated
  using (public.current_guild_role(guild_id) is not null);

create policy "Guild members can send guild chat messages"
  on public.guild_chat_messages for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and public.current_guild_role(guild_id) is not null
  );

create or replace function public.prepare_guild_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_nickname text;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;

  select gm.role, p.nickname
    into v_role, v_nickname
  from public.guild_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.guild_id = new.guild_id
    and gm.user_id = auth.uid();

  if v_role is null then
    raise exception 'Somente membros da guilda podem enviar mensagens.';
  end if;

  new.sender_user_id := auth.uid();
  new.sender_nickname := coalesce(v_nickname, 'Jogador');
  new.sender_role := v_role;
  new.content := trim(new.content);
  if char_length(new.content) not between 1 and 500 then
    raise exception 'A mensagem deve ter entre 1 e 500 caracteres.';
  end if;
  return new;
end;
$$;

create trigger guild_chat_messages_prepare
  before insert on public.guild_chat_messages
  for each row execute function public.prepare_guild_chat_message();

revoke all on function public.prepare_guild_chat_message() from public, anon, authenticated;
grant select, insert on public.guild_chat_messages to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'guild_chat_messages'
  ) then
    alter publication supabase_realtime add table public.guild_chat_messages;
  end if;
end;
$$;
