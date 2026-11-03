-- KillCult MMO: estrutura inicial persistente
-- Executar uma única vez no Supabase SQL Editor.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  class_id text not null check (class_id in ('warrior', 'mage', 'cleric', 'assassin', 'archer')),
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  unspent_attribute_points integer not null default 0 check (unspent_attribute_points >= 0),
  strength integer not null default 0 check (strength >= 0),
  vitality integer not null default 0 check (vitality >= 0),
  defense integer not null default 0 check (defense >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, class_id),
  unique (id, user_id)
);

create table public.player_wallet (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  gold bigint not null default 0 check (gold >= 0),
  updated_at timestamptz not null default now()
);

-- Somente itens consolidados após extração entram no inventário persistente.
create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_definition_id text not null,
  obtained_at_floor integer check (obtained_at_floor is null or obtained_at_floor >= 1),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.equipped_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null,
  inventory_item_id uuid not null,
  slot text not null check (slot in ('chest', 'boots', 'helmet', 'amulet', 'weapon', 'off-hand', 'ring')),
  created_at timestamptz not null default now(),
  unique (character_id, slot),
  unique (inventory_item_id),
  foreign key (character_id, user_id) references public.characters(id, user_id) on delete cascade,
  foreign key (inventory_item_id, user_id) references public.inventory(id, user_id) on delete cascade
);

create table public.expeditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'extracted', 'defeated')),
  result text check (result is null or result in ('extraction', 'combat_defeat', 'inactive_defeat', 'completed')),
  current_floor integer not null default 1 check (current_floor between 1 and 100),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at timestamptz,
  temporary_gold bigint not null default 0 check (temporary_gold >= 0),
  temporary_loot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (status = 'active' and ended_at is null and result is null)
    or
    (status <> 'active' and ended_at is not null and result is not null)
  )
);

create unique index one_active_expedition_per_user
  on public.expeditions(user_id) where status = 'active';

create table public.expedition_members (
  expedition_id uuid not null references public.expeditions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (expedition_id, character_id),
  foreign key (character_id, user_id) references public.characters(id, user_id) on delete cascade
);

create index characters_user_id_idx on public.characters(user_id);
create index inventory_user_id_idx on public.inventory(user_id);
create index expeditions_user_status_idx on public.expeditions(user_id, status);
create index expeditions_activity_idx on public.expeditions(last_activity_at) where status = 'active';

-- Cria perfil, carteira e os cinco heróis fixos para cada nova conta Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'jogador'), '@', 1)
    )
  );

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS: cada jogador só pode ler e alterar seus próprios dados.
alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.player_wallet enable row level security;
alter table public.inventory enable row level security;
alter table public.equipped_items enable row level security;
alter table public.expeditions enable row level security;
alter table public.expedition_members enable row level security;

create policy "Players can read own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Players can update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Players can read own characters"
  on public.characters for select to authenticated
  using (user_id = (select auth.uid()));

-- Progressão/atributos serão alterados por operações validadas no servidor.
create policy "Players can read own wallet"
  on public.player_wallet for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Players can read own inventory"
  on public.inventory for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Players can read own equipment"
  on public.equipped_items for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Players can read own expeditions"
  on public.expeditions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Players can read own expedition members"
  on public.expedition_members for select to authenticated
  using (user_id = (select auth.uid()));

-- Não há políticas de escrita direta para moedas, itens, personagens ou expedições.
-- Essas operações serão expostas por funções de servidor com validação de regras.
