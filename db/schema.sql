-- Extensões úteis no Supabase
create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text unique not null,
  senha text not null,
  level int not null default 1,
  total_xp int not null default 0,
  coins int not null default 0,
  partner_id uuid references users(id) on delete set null,
  forca int not null default 0,
  destreza int not null default 0,
  carisma int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists quests (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text not null,
  categoria text not null check (categoria in ('Força','Destreza','Carisma')),
  dificuldade text not null check (dificuldade in ('Easy','Medium','Hard','Boss')),
  recompensa_xp int not null,
  recompensa_coins int not null,
  status text not null check (status in ('Pendente','Aguardando_Validacao','Concluida','Rejeitada')),
  criado_por uuid not null references users(id) on delete cascade,
  atribuido_a uuid not null references users(id) on delete cascade,
  completed_by uuid references users(id) on delete set null,
  validated_by uuid references users(id) on delete set null,
  is_daily boolean not null default false,
  is_boss boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists quest_participants (
  quest_id uuid not null references quests(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (quest_id, user_id)
);

create table if not exists shop_items (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  preco int not null,
  descricao text not null,
  criado_por uuid not null references users(id) on delete cascade,
  comprado boolean not null default false,
  comprado_por uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Índices
create index if not exists idx_quests_status on quests(status);
create index if not exists idx_quests_assigned on quests(atribuido_a);
create index if not exists idx_shop_items_comprado on shop_items(comprado);
