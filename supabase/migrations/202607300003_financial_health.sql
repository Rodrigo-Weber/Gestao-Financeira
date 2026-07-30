alter table public.debts
  add column if not exists connection_id uuid references public.financial_connections(id) on delete set null,
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists annual_cet numeric(10,6),
  add column if not exists total_installments integer,
  add column if not exists paid_installments integer,
  add column if not exists remaining_installments integer,
  add column if not exists contract_end_date date,
  add column if not exists source text not null default 'manual',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists imported_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists debts_external_id_idx
  on public.debts(user_id, external_provider, external_id)
  where external_provider is not null and external_id is not null;

create trigger debts_updated_at before update on public.debts
for each row execute function public.set_updated_at();

alter table public.categories
  add column if not exists spending_class text
    check (spending_class is null or spending_class in ('essential','fixed','flexible','eventual')),
  add column if not exists income_class text
    check (income_class is null or income_class in ('recurring','eventual'));

alter table public.profiles
  add column if not exists hide_values boolean not null default false,
  add column if not exists emergency_target_months numeric(4,1) not null default 6 check (emergency_target_months between 1 and 36),
  add column if not exists registrato_reminder_month smallint not null default 1 check (registrato_reminder_month between 1 and 12);

create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  target_date date,
  priority smallint not null default 2 check (priority between 1 and 3),
  kind text not null default 'goal' check (kind in ('goal','emergency')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.annual_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  due_month smallint not null check (due_month between 1 and 12),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'other' check (type in ('property','vehicle','business','cash','other')),
  value numeric(14,2) not null default 0 check (value >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference_month date not null,
  accounts_total numeric(14,2) not null default 0,
  investments_total numeric(14,2) not null default 0,
  assets_total numeric(14,2) not null default 0,
  debts_total numeric(14,2) not null default 0,
  net_worth numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, reference_month)
);

create table public.financial_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null,
  record_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.log_financial_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  old_json jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_json jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  owner_id uuid := coalesce((new_json ->> 'user_id')::uuid, (old_json ->> 'user_id')::uuid);
  target_id text := coalesce(new_json ->> 'id', old_json ->> 'id');
begin
  if tg_op = 'UPDATE'
    and (old_json - 'updated_at' - 'imported_at' - 'reported_balance_at')
      = (new_json - 'updated_at' - 'imported_at' - 'reported_balance_at')
  then
    return new;
  end if;
  insert into public.financial_audit_log(user_id, table_name, record_id, operation, old_data, new_data)
  values (owner_id, tg_table_name, target_id, tg_op, old_json, new_json);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger financial_goals_updated_at before update on public.financial_goals
for each row execute function public.set_updated_at();
create trigger annual_funds_updated_at before update on public.annual_funds
for each row execute function public.set_updated_at();
create trigger financial_assets_updated_at before update on public.financial_assets
for each row execute function public.set_updated_at();

do $$
declare table_name text;
begin
  foreach table_name in array array['financial_goals','annual_funds','financial_assets','financial_snapshots'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy "users_manage_own_%1$s" on public.%1$I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', table_name);
  end loop;
end $$;

alter table public.financial_audit_log enable row level security;
create policy "users_read_own_financial_audit_log" on public.financial_audit_log
for select using (user_id = auth.uid());

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'accounts','credit_cards','debts','transactions','investments',
    'financial_goals','annual_funds','financial_assets'
  ] loop
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.log_financial_change()',
      table_name
    );
  end loop;
end $$;

create index financial_goals_user_idx on public.financial_goals(user_id, active, priority);
create index annual_funds_user_idx on public.annual_funds(user_id, active, due_month);
create index financial_assets_user_idx on public.financial_assets(user_id, active);
create index financial_snapshots_user_idx on public.financial_snapshots(user_id, reference_month desc);
create index financial_audit_user_idx on public.financial_audit_log(user_id, created_at desc);
