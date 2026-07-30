import { useMemo, useState } from "react";
import { CalendarDays, CreditCard, Landmark, Sparkles, TrendingDown, UserRound } from "lucide-react";
import type { FinanceData } from "../types";
import { simulateDebtPayoff } from "../lib/finance";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function CardsPage({ data, month, onAdd }: { data: FinanceData; month: string; onAdd: () => void }) {
  return <div className="page-stack"><section className="page-title"><div><span className="eyebrow">Seus limites</span><h1>Cartões</h1><p>Acompanhe faturas e utilização sem contar gastos duas vezes.</p></div><button className="primary-btn" onClick={onAdd}>+ Novo cartão</button></section>
    <section className="cards-grid">{data.cards.map((card) => {
      const used = data.transactions.filter((item) => item.cardId === card.id && item.kind === "card_purchase" && item.competenceDate.startsWith(month)).reduce((sum, item) => sum + item.amount, 0);
      return <article className="card-detail" key={card.id} style={{ "--card-color": card.color } as React.CSSProperties}><div className="physical-card"><div><span>Weber</span><CreditCard size={25} /></div><strong>•••• •••• •••• {card.lastDigits}</strong><div><small>{card.name}</small><small>{card.brand}</small></div></div><div className="card-stats"><div><small>Fatura atual</small><strong>{brl.format(used)}</strong></div><div><small>Limite disponível</small><strong>{brl.format(card.limit - used)}</strong></div><div className="progress large"><span style={{ width: `${Math.min(100, used / card.limit * 100)}%` }} /></div><div className="card-dates"><span><CalendarDays size={16} /> Fecha dia <strong>{card.closingDay}</strong></span><span>Pagamento dia <strong>{card.dueDay}</strong></span></div></div></article>;
    })}</section></div>;
}

export function DebtsPage({ data, onAdd }: { data: FinanceData; onAdd: () => void }) {
  const [extra, setExtra] = useState(300);
  const snowball = useMemo(() => simulateDebtPayoff(data.debts, extra, "snowball"), [data.debts, extra]);
  const avalanche = useMemo(() => simulateDebtPayoff(data.debts, extra, "avalanche"), [data.debts, extra]);
  const total = data.debts.reduce((sum, item) => sum + item.outstandingBalance, 0);
  return <div className="page-stack"><section className="page-title"><div><span className="eyebrow">Plano de liberdade</span><h1>Dívidas e empréstimos</h1><p>Priorize pagamentos e veja quando cada compromisso termina.</p></div><button className="primary-btn" onClick={onAdd}>+ Nova dívida</button></section>
    <section className="debt-hero"><div><span className="round-icon coral"><TrendingDown size={21} /></span><div><small>Saldo devedor total</small><strong>{brl.format(total)}</strong><span>em {data.debts.length} compromissos ativos</span></div></div><div><small>Pagamento mínimo mensal</small><strong>{brl.format(data.debts.reduce((sum, item) => sum + item.minimumPayment, 0))}</strong></div></section>
    <section className="debt-layout"><div className="panel debt-list"><div className="panel-heading"><div><span className="eyebrow">Compromissos</span><h2>Suas dívidas</h2></div></div>{data.debts.map((debt) => <div className="debt-row" key={debt.id}><span className="round-icon soft">{debt.type === "person" ? <UserRound size={19} /> : <Landmark size={19} />}</span><div className="debt-main"><strong>{debt.name}</strong><small>{debt.creditor} • vence dia {debt.dueDay}</small><div className="progress"><span style={{ width: `${debt.outstandingBalance / debt.originalAmount * 100}%` }} /></div><span>{Math.round((1 - debt.outstandingBalance / debt.originalAmount) * 100)}% quitado</span></div><div className="debt-values"><small>Saldo</small><strong>{brl.format(debt.outstandingBalance)}</strong><span>{debt.monthlyInterest}% a.m.</span></div></div>)}</div>
      <article className="panel simulator"><div className="sim-icon"><Sparkles size={20} /></div><span className="eyebrow">Simulador inteligente</span><h2>Quite mais rápido</h2><p>Quanto você consegue pagar além das parcelas por mês?</p><div className="money-input dark"><span>R$</span><input type="number" value={extra} min={0} step={50} onChange={(e) => setExtra(Number(e.target.value))} /></div><div className="strategy-card recommended"><span>Recomendado</span><strong>Maior juros primeiro</strong><p>Termina em <b>{avalanche.months} meses</b></p><small>Juros estimados: {brl.format(avalanche.interest)}</small><div className="order">{avalanche.order.join(" → ")}</div></div><div className="strategy-card"><strong>Menor saldo primeiro</strong><p>Termina em <b>{snowball.months} meses</b></p><small>Juros estimados: {brl.format(snowball.interest)}</small></div></article>
    </section></div>;
}
