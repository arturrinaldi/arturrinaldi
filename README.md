# Gestão de Cookies e Biscoitos (PC + Celular)

Agora o projeto suporta **banco online com Supabase**, para você registrar vendas no celular e enxergar no PC em tempo real.

## Funcionalidades

- Cadastro de produtos (cookie/biscoito, sabor, preço, estoque).
- Baixa de estoque por venda individual e por **botão rápido `+1 venda`** no mobile.
- Registro de compra de ingredientes para controle de gastos.
- Cards de receita, gasto, lucro e itens com estoque baixo.
- Gráficos de lucro/gasto mensal e produtos mais vendidos.

## Rodar localmente

```bash
python3 -m http.server 4173
```

Acesse: `http://localhost:4173`.

## Configurar banco online (Supabase)

1. Crie um projeto no Supabase.
2. Rode este SQL no `SQL Editor`:

```sql
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  flavor text not null,
  price numeric not null,
  stock int not null default 0,
  created_at timestamptz default now()
);

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cost numeric not null,
  quantity text not null,
  date date not null,
  created_at timestamptz default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  quantity int not null,
  unit_price numeric not null,
  total numeric not null,
  date date not null,
  created_at timestamptz default now()
);
```

3. Em `app.js`, preencha:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. No Supabase, habilite RLS e crie políticas de acesso para seu uso privado (ou deixe sem RLS enquanto estiver em ambiente de testes).

> Sem configurar Supabase, o sistema entra em fallback local para demonstração.

## Deploy na Vercel

- Framework preset: **Other**
- Build command: vazio
- Output directory: `/`

Depois de deployado, use a mesma URL no PC e no celular para operar o mesmo banco online.
