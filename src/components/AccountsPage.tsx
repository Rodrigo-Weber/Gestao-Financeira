import { Building2, CircleDollarSign, Plus, RefreshCw, Wallet } from "lucide-react";
import type { Account, FinanceData } from "../types";
import { accountBalance } from "../lib/finance";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function AccountsPage({ data, onAdd, onAdjust }: { data: FinanceData; onAdd: () => void; onAdjust: (account: Account) => void }) {
  const balances = Object.fromEntries(data.accounts.map((account) => [account.id, accountBalance(data, account.id)]));
  const total = data.accounts.reduce((sum, item) => sum + balances[item.id], 0);
  return <div className="page-stack"><section className="page-title"><div><span className="eyebrow">Onde está seu dinheiro</span><h1>Contas e carteiras</h1><p>Organize saldos bancários e dinheiro em espécie.</p></div><button className="primary-btn" onClick={onAdd}><Plus size={18} /> Nova conta</button></section>
    <section className="accounts-hero"><div><small>Patrimônio disponível</small><strong>{brl.format(total)}</strong><span>em {data.accounts.length} contas ativas</span></div><span className="hero-wallet"><Wallet size={28} /></span></section>
    <section className="accounts-grid">{data.accounts.map((account) => <article className="account-card" key={account.id}><div className="account-card-head"><span className="round-icon" style={{ color: account.color, background: `${account.color}18` }}>{account.type === "cash" ? <CircleDollarSign size={20} /> : <Building2 size={20} />}</span><span className="status-pill paid">Ativa</span></div><small>{account.institution}</small><h2>{account.name}</h2><strong>{brl.format(balances[account.id])}</strong><small>Saldo inicial: {brl.format(account.initialBalance)}</small><button className="account-adjust" onClick={() => onAdjust(account)}><RefreshCw size={14} /> Ajustar saldo</button><div className="account-line" style={{ background: account.color }} /></article>)}</section>
  </div>;
}
