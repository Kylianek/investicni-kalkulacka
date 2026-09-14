-- Spusť tento skript v Supabase: SQL Editor -> New query -> Run.
-- Jedna tabulka, jeden řádek na uživatele, celý stav appky jako JSON -
-- stejná struktura, jakou appka jinak drží v localStorage prohlížeče.
-- Row Level Security zaručuje, že každý uživatel vidí a upravuje jen svůj
-- vlastní řádek.

create table if not exists public.app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

drop policy if exists "app_data: owner only" on public.app_data;
create policy "app_data: owner only" on public.app_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
