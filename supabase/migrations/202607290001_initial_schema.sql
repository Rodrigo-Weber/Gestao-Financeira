create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'BRL',
  timezone text not null default 'America/Bahia',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution text,
  type text not null check (type in ('checking','cash','savings')),
  initial_balance numeric(14,2) not null default 0,
  color text not null default '#15976e',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'CircleDollarSign',
  color text not null default '#15976e',
  kind text not null check (kind in ('income','expense')),
  created_at timestamptz not null default now(),
  unique(user_id, name, kind)
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  last_digits text check (last_digits is null or last_digits ~ '^[0-9]{4}$'),
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  color text not null default '#6f5bd5',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  creditor text not null,
  type text not null check (type in ('person','loan','installment')),
  original_amount numeric(14,2) not null check (original_amount >= 0),
  outstanding_balance numeric(14,2) not null check (outstanding_balance >= 0),
  monthly_interest numeric(8,4) not null default 0 check (monthly_interest >= 0),
  minimum_payment numeric(14,2) not null default 0 check (minimum_payment >= 0),
  due_day smallint not null check (due_day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.installment_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  total_amount numeric(14,2) not null,
  total_installments integer not null check (total_installments > 1),
  created_at timestamptz not null default now()
);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  frequency text not null check (frequency in ('weekly','monthly','yearly')),
  interval_count integer not null default 1 check (interval_count > 0),
  starts_on date not null,
  ends_on date,
  next_run_on date not null,
  active boolean not null default true,
  template jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.card_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete cascade,
  reference_month date not null,
  closing_date date not null,
  due_date date not null,
  status text not null default 'open' check (status in ('open','closed','paid','overdue')),
  total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(card_id, reference_month)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  kind text not null check (kind in ('income','expense','transfer','card_purchase','invoice_payment','debt_payment')),
  status text not null default 'pending' check (status in ('paid','pending','overdue','cancelled')),
  due_date date not null,
  paid_date date,
  competence_date date not null,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  destination_account_id uuid references public.accounts(id) on delete set null,
  card_id uuid references public.credit_cards(id) on delete set null,
  invoice_id uuid references public.card_invoices(id) on delete set null,
  debt_id uuid references public.debts(id) on delete set null,
  installment_group_id uuid references public.installment_groups(id) on delete set null,
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  installment_number integer,
  installment_total integer,
  notes text,
  attachment_path text,
  payment_method text check (payment_method is null or payment_method in ('pix','debit','credit')),
  source text not null default 'manual' check (source in ('manual','chat','audio','ocr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind <> 'transfer') or (account_id is not null and destination_account_id is not null and account_id <> destination_account_id)),
  check ((installment_total is null and installment_number is null) or (installment_total > 1 and installment_number between 1 and installment_total))
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  spending_limit numeric(14,2) not null check (spending_limit > 0),
  created_at timestamptz not null default now(),
  unique(user_id, category_id, month)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  original_name text,
  kind text not null default 'receipt' check (kind in ('receipt')),
  created_at timestamptz not null default now(),
  unique(user_id, storage_path)
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);

create index transactions_user_due_idx on public.transactions(user_id, due_date);
create index transactions_user_competence_idx on public.transactions(user_id, competence_date);
create index transactions_card_idx on public.transactions(card_id, competence_date) where card_id is not null;
create index debts_user_active_idx on public.debts(user_id, active);
create index ai_requests_created_idx on public.ai_requests(created_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_updated_at before update on public.transactions
for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger conversations_updated_at before update on public.ai_conversations
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.accounts (user_id, name, institution, type, color)
  values (new.id, 'Conta principal', 'Minha conta', 'checking', '#15976e');

  insert into public.categories (user_id, name, icon, color, kind) values
    (new.id, 'Salário', 'Wallet', '#33c99a', 'income'),
    (new.id, 'Renda extra', 'CircleDollarSign', '#5dbea2', 'income'),
    (new.id, 'Casa', 'House', '#7467e8', 'expense'),
    (new.id, 'Alimentação', 'Utensils', '#ef8f4d', 'expense'),
    (new.id, 'Transporte', 'Car', '#48a4d8', 'expense'),
    (new.id, 'Lazer', 'Sparkles', '#d65f98', 'expense'),
    (new.id, 'Saúde', 'Heart', '#e25c5c', 'expense'),
    (new.id, 'Educação', 'BookOpen', '#c49b36', 'expense'),
    (new.id, 'Outros', 'Shapes', '#7f8c86', 'expense');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','accounts','categories','credit_cards','debts','installment_groups',
    'recurring_rules','card_invoices','transactions','budgets','attachments',
    'ai_conversations','ai_requests'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    if table_name = 'profiles' then
      execute format('create policy "users_manage_own_%1$s" on public.%1$I for all using (id = auth.uid()) with check (id = auth.uid())', table_name);
    else
      execute format('create policy "users_manage_own_%1$s" on public.%1$I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', table_name);
    end if;
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608;

create policy "users_read_own_receipts" on storage.objects
for select using (bucket_id = 'receipts' and split_part(name, '/', 1) = auth.uid()::text);
create policy "users_upload_own_receipts" on storage.objects
for insert with check (bucket_id = 'receipts' and split_part(name, '/', 1) = auth.uid()::text);
create policy "users_delete_own_receipts" on storage.objects
for delete using (bucket_id = 'receipts' and split_part(name, '/', 1) = auth.uid()::text);

revoke all on public.ai_requests from anon, authenticated;
