-- Detalhes de limite e faturas retornados pela Pluggy.
-- Execute depois das migrations 001-003.
alter table public.credit_cards
  add column if not exists used_limit numeric(14,2),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.card_invoices
  alter column closing_date drop not null,
  add column if not exists minimum_payment numeric(14,2),
  add column if not exists paid_amount numeric(14,2) not null default 0,
  add column if not exists allows_installments boolean,
  add column if not exists currency_code text not null default 'BRL',
  add column if not exists payments jsonb not null default '[]'::jsonb,
  add column if not exists finance_charges jsonb not null default '[]'::jsonb;

create index if not exists card_invoices_card_due_idx
  on public.card_invoices(user_id, card_id, due_date desc);
