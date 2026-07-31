import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, Scale, WalletCards } from "lucide-react";
import { eachDayOfInterval, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { FinanceData } from "../types";
import { accountBalance, calculateSummary, categorySpend } from "../lib/finance";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ReconciliationPage({ data }: { data: FinanceData }) {
  const accounts = data.accounts.filter((item) => item.reportedBalance != null).map((account) => {
    const calculated = accountBalance(data, account.id);
    return { id: account.id, name: account.name, type: "Conta", reported: account.reportedBalance!, calculated, difference: account.reportedBalance! - calculated, updatedAt: account.lastSyncedAt };
  });
  const invoices = (data.cardInvoices ?? []).map((invoice) => {
    const transactions = data.transactions.filter((item) => item.invoiceId === invoice.id && item.status !== "cancelled");
    const calculated = transactions.reduce((sum, item) => sum + (item.kind === "card_credit" ? -item.amount : item.kind === "card_purchase" ? item.amount : 0), 0);
    return { id: invoice.id, name: `${data.cards.find((item) => item.id === invoice.cardId)?.name ?? "Cartão"} • ${invoice.dueDate.slice(0, 7)}`, type: "Fatura", reported: invoice.total, calculated, difference: invoice.total - calculated, updatedAt: invoice.dueDate };
  });
  const rows = [...accounts, ...invoices];
  const divergences = rows.filter((item) => Math.abs(item.difference) >= .01);
  return <div className="page-stack"><section className="page-title"><div><span className="eyebrow">Qualidade dos dados</span><h1>Central de conciliação</h1><p>Compare o valor informado pela instituição com o valor reconstruído a partir das transações importadas.</p></div></section>
    <section className="metrics-grid"><article className="metric-card emerald"><div className="metric-top"><span>Itens conciliados</span><span className="metric-icon"><CheckCircle2 size={18} /></span></div><strong>{rows.length - divergences.length}</strong><small>diferença menor que um centavo</small></article><article className="metric-card"><div className="metric-top"><span>Para revisar</span><span className="metric-icon"><AlertTriangle size={18} /></span></div><strong>{divergences.length}</strong><small>contas ou faturas divergentes</small></article><article className="metric-card navy"><div className="metric-top"><span>Diferença absoluta</span><span className="metric-icon"><Scale size={18} /></span></div><strong>{brl.format(divergences.reduce((sum, item) => sum + Math.abs(item.difference), 0))}</strong><small>não altera automaticamente seus dados</small></article></section>
    <section className="panel reconciliation-panel"><div className="panel-heading"><div><span className="eyebrow">Conferência</span><h2>Instituição x sistema</h2></div></div><div className="reconciliation-list">{rows.map((row) => <div className="reconciliation-row" key={`${row.type}-${row.id}`}><span className="round-icon soft">{row.type === "Conta" ? <WalletCards size={18} /> : <CreditCard size={18} />}</span><div><strong>{row.name}</strong><small>{row.type}{row.updatedAt ? ` • referência ${new Date(row.updatedAt).toLocaleString("pt-BR")}` : ""}</small></div><div><small>Informado</small><strong>{brl.format(row.reported)}</strong></div><div><small>Calculado</small><strong>{brl.format(row.calculated)}</strong></div><span className={`reconciliation-diff ${Math.abs(row.difference) < .01 ? "matched" : "diverged"}`}>{Math.abs(row.difference) < .01 ? "Conciliado" : brl.format(row.difference)}</span></div>)}{!rows.length && <div className="empty-state"><Scale size={25} /><strong>Sem dados externos para conciliar</strong><span>Sincronize uma conexão Pluggy para começar.</span></div>}</div></section>
    <section className="panel change-history"><div className="panel-heading"><div><span className="eyebrow">Rastreabilidade</span><h2>Alterações recebidas da instituição</h2></div></div>{(data.externalChanges ?? []).slice(0, 12).map((change) => <div className="change-row" key={change.id}><span className={`status-pill ${change.operation}`}>{change.operation === "created" ? "Novo" : change.operation === "updated" ? "Atualizado" : "Removido"}</span><strong>{change.entityType}</strong><small>{change.externalId ? `ID externo ${change.externalId.slice(0, 8)}… • ` : ""}{new Date(change.createdAt).toLocaleString("pt-BR")}</small></div>)}{!data.externalChanges?.length && <div className="compact-empty"><span>O histórico será preenchido nas próximas sincronizações.</span></div>}</section>
  </div>;
}

export function CalendarPage({ data, month }: { data: FinanceData; month: Date }) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const itemsByDay = useMemo(() => new Map(days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    return [key, data.transactions.filter((item) => item.dueDate === key && item.status !== "cancelled")];
  })), [data.transactions, month.getFullYear(), month.getMonth()]);
  const comparisons = [1, 2, 3].map((offset) => {
    const date = subMonths(month, offset);
    const summary = calculateSummary(data, date);
    const categories = categorySpend(data, date);
    return { month: format(date, "MM/yyyy"), income: summary.realizedIncome + summary.pendingIncome, expense: summary.realizedExpense + summary.pendingExpense, top: categories[0]?.name ?? "—" };
  });
  return <div className="page-stack"><section className="page-title"><div><span className="eyebrow">Agenda financeira</span><h1>Calendário e comparativos</h1><p>Veja vencimentos concentrados e compare o ritmo financeiro com os últimos meses.</p></div></section>
    <section className="calendar-grid">{days.map((day) => { const key = format(day, "yyyy-MM-dd"); const items = itemsByDay.get(key) ?? []; return <article className={`calendar-day ${items.length ? "has-items" : ""}`} key={key}><strong>{format(day, "dd")}</strong><small>{items.length ? `${items.length} movimento${items.length > 1 ? "s" : ""}` : "—"}</small>{items.slice(0, 2).map((item) => <span className={item.kind === "income" || item.kind === "card_credit" ? "positive" : ""} key={item.id}>{item.description} <b>{brl.format(item.amount)}</b></span>)}</article>; })}</section>
    <section className="panel comparison-panel"><div className="panel-heading"><div><span className="eyebrow">Histórico recente</span><h2>Últimos três meses</h2></div></div>{comparisons.map((item) => <div className="comparison-row" key={item.month}><strong>{item.month}</strong><span><small>Receitas</small>{brl.format(item.income)}</span><span><small>Despesas</small>{brl.format(item.expense)}</span><span><small>Maior categoria</small>{item.top}</span></div>)}</section>
  </div>;
}
