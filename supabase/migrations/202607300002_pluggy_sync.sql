create table public.financial_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'pluggy' check (provider in ('pluggy')),
  external_item_id text not null,
  display_name text,
  status text not null default 'active' check (status in ('active','syncing','error','disconnected')),
  products text[] not null default '{}',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider, external_item_id)
);

create table public.financial_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.financial_connections(id) on delete cascade,
  status text not null default 'running' check (status in ('running','success','partial','error')),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.accounts
  add column if not exists connection_id uuid references public.financial_connections(id) on delete set null,
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists reported_balance numeric(14,2),
  add column if not exists reported_balance_at timestamptz,
  add column if not exists imported_at timestamptz;

alter table public.credit_cards
  add column if not exists connection_id uuid references public.financial_connections(id) on delete set null,
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists available_limit numeric(14,2),
  add column if not exists reported_balance numeric(14,2),
  add column if not exists reported_balance_at timestamptz,
  add column if not exists imported_at timestamptz;

alter table public.card_invoices
  add column if not exists connection_id uuid references public.financial_connections(id) on delete set null,
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists imported_at timestamptz;

alter table public.transactions
  add column if not exists connection_id uuid references public.financial_connections(id) on delete set null,
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists external_account_id text,
  add column if not exists provider_status text,
  add column if not exists provider_category text,
  add column if not exists provider_created_at timestamptz,
  add column if not exists provider_updated_at timestamptz,
  add column if not exists imported_at timestamptz;

alter table public.transactions
  drop constraint if exists transactions_source_check;

alter table public.transactions
  add constraint transactions_source_check
  check (source in ('manual','chat','audio','ocr','pluggy'));

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.financial_connections(id) on delete set null,
  external_provider text not null default 'pluggy',
  external_id text not null,
  name text not null,
  institution text,
  type text not null default 'other',
  balance numeric(14,2) not null default 0,
  quantity numeric(24,8),
  unit_value numeric(18,8),
  annual_rate numeric(10,6),
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, external_provider, external_id)
);

create unique index accounts_external_id_idx
  on public.accounts(user_id, external_provider, external_id)
  where external_provider is not null and external_id is not null;

create unique index credit_cards_external_id_idx
  on public.credit_cards(user_id, external_provider, external_id)
  where external_provider is not null and external_id is not null;

create unique index card_invoices_external_id_idx
  on public.card_invoices(user_id, external_provider, external_id)
  where external_provider is not null and external_id is not null;

create unique index transactions_external_id_idx
  on public.transactions(user_id, external_provider, external_id)
  where external_provider is not null and external_id is not null;

create index financial_connections_user_idx on public.financial_connections(user_id, status);
create index financial_sync_runs_connection_idx on public.financial_sync_runs(connection_id, started_at desc);
create index investments_user_idx on public.investments(user_id, type);

create trigger financial_connections_updated_at before update on public.financial_connections
for each row execute function public.set_updated_at();

create trigger investments_updated_at before update on public.investments
for each row execute function public.set_updated_at();

alter table public.financial_connections enable row level security;
alter table public.financial_sync_runs enable row level security;
alter table public.investments enable row level security;

create policy "users_manage_own_financial_connections" on public.financial_connections
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users_manage_own_financial_sync_runs" on public.financial_sync_runs
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users_manage_own_investments" on public.investments
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
