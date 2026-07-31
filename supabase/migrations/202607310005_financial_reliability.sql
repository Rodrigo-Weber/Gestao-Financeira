-- Confiabilidade financeira, webhooks Pluggy e preferências de recorrência.
alter table public.financial_connections
  add column if not exists sync_lock_until timestamptz,
  add column if not exists webhook_last_event_at timestamptz;

alter table public.transactions
  add column if not exists provider_amount numeric(14,2),
  add column if not exists provider_type text,
  add column if not exists operation_type text,
  add column if not exists merchant jsonb,
  add column if not exists reconciliation_notes text;

alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check
  check (kind in ('income','expense','transfer','card_purchase','card_credit','invoice_payment','debt_payment'));

create table public.pluggy_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_name text not null,
  item_id text,
  account_id text,
  user_id uuid references auth.users(id) on delete cascade,
  connection_id uuid references public.financial_connections(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','success','error','ignored')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  payload jsonb not null,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.recurring_pattern_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  alias text,
  status text not null default 'detected' check (status in ('detected','confirmed','ignored','cancelled')),
  kind text not null check (kind in ('income','expense')),
  expected_amount numeric(14,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, fingerprint)
);

create table public.financial_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.financial_connections(id) on delete set null,
  entity_type text not null check (entity_type in ('account','card','invoice')),
  entity_id uuid not null,
  reported_amount numeric(14,2) not null,
  calculated_amount numeric(14,2) not null,
  difference numeric(14,2) generated always as (reported_amount - calculated_amount) stored,
  status text not null default 'pending' check (status in ('matched','pending','reviewed','accepted')),
  notes text,
  checked_at timestamptz not null default now(),
  unique(user_id, entity_type, entity_id)
);

create table public.external_change_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.financial_connections(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  external_id text,
  operation text not null check (operation in ('created','updated','deleted')),
  old_data jsonb,
  new_data jsonb,
  sync_run_id uuid references public.financial_sync_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create trigger recurring_pattern_preferences_updated_at before update on public.recurring_pattern_preferences
for each row execute function public.set_updated_at();

alter table public.pluggy_webhook_events enable row level security;
alter table public.recurring_pattern_preferences enable row level security;
alter table public.financial_reconciliations enable row level security;
alter table public.external_change_log enable row level security;

create policy "users_read_own_pluggy_webhook_events" on public.pluggy_webhook_events
for select using (user_id = auth.uid());
create policy "users_manage_own_recurring_pattern_preferences" on public.recurring_pattern_preferences
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users_manage_own_financial_reconciliations" on public.financial_reconciliations
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users_read_own_external_change_log" on public.external_change_log
for select using (user_id = auth.uid());

create index pluggy_webhook_events_pending_idx on public.pluggy_webhook_events(status, next_attempt_at);
create index recurring_pattern_preferences_user_idx on public.recurring_pattern_preferences(user_id, status);
create index financial_reconciliations_user_idx on public.financial_reconciliations(user_id, status);
create index external_change_log_user_idx on public.external_change_log(user_id, created_at desc);
