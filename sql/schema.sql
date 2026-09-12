-- Spusť tento skript v Supabase: SQL Editor -> New query -> Run.
-- Vytvoří tabulky pro nemovitosti, úvěry a nastavení + zapne Row Level Security,
-- takže každý přihlášený uživatel uvidí a bude moci upravovat pouze svoje vlastní řádky.

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  rent numeric not null default 0,
  payment numeric not null default 0,
  market_value numeric not null default 0,
  acquisition_price numeric not null default 0,
  growth_rate numeric not null default 0,        -- 0.05 = 5 % ročně
  acquisition_date date,
  tax_exempt_years integer not null default 10,  -- časový test: 5 nebo 10 let
  has_lien boolean not null default false,
  lien_bank text,
  created_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank text not null,
  amount numeric not null default 0,
  interest_rate numeric not null default 0,      -- 0.05 = 5 %
  fixation_years integer not null default 5,
  start_date date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  inflation_rate numeric not null default 0.03   -- 0.03 = 3 % ročně
);

alter table public.properties enable row level security;
alter table public.loans enable row level security;
alter table public.settings enable row level security;

drop policy if exists "properties: owner only" on public.properties;
create policy "properties: owner only" on public.properties
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "loans: owner only" on public.loans;
create policy "loans: owner only" on public.loans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "settings: owner only" on public.settings;
create policy "settings: owner only" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
