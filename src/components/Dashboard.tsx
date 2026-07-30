import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, CalendarClock, CheckCircle2, ChevronRight, CreditCard, PiggyBank, TrendingDown, Wallet } from "lucide-react";
import type { FinanceData } from "../types";
import { calculateSummary, cashFlowSeries, categorySpend } from "../lib/finance";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const short = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function MetricCard({ label, value, helper, tone, icon }: { label: string; value: number; helper: string; tone: string; icon: React.ReactNode }) {
  return <article className={`metric-card ${tone}`}>
    <div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
    <strong>{brl.format(value)}</strong>
    <small>{helper}</small>
  </article>;
}

export function Dashboard({ data, month, userName, onAdd, onNavigate }: { data: FinanceData; month: Date; userName: string; onAdd: () => void; onNavigate: (page: string) => void }) {
  const summary = useMemo(() => calculateSummary(data, month), [data, month]);
  const categories = useMemo(() => categorySpend(data, month), [data, month]);
  const flow = useMemo(() => cashFlowSeries(data, month), [data, month]);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const upcoming = data.transactions.filter((item) => item.dueDate.startsWith(monthKey) && item.status !== "paid" && item.status !== "cancelled").sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4);
  const categoryTotal = categories.reduce((sum, item) => sum + item.value, 0);
  const card = data.cards[0];
  const cardUsed = data.transactions.filter((item) => item.cardId === card?.id && item.kind === "card_purchase" && item.competenceDate.startsWith(monthKey)).reduce((sum, item) => sum + item.amount, 0);

  return <div className="page-stack">
    <section className="welcome-row">
      <div><span className="eyebrow">Visão de {monthLabel}</span><h1>Olá, {userName.split(" ")[0]} <span>👋</span></h1><p>Seu dinheiro está sob controle. Veja o que merece atenção hoje.</p></div>
      <button className="primary-btn desktop-only" onClick={onAdd}>+ Novo lançamento</button>
    </section>

    <section className="metrics-grid">
      <MetricCard label="Saldo realizado" value={summary.realizedBalance} helper="Disponível agora" tone="emerald" icon={<Wallet size={19} />} />
      <MetricCard label="Saldo projetado" value={summary.projectedBalance} helper="Até o fim do mês" tone="navy" icon={<PiggyBank size={19} />} />
      <MetricCard label="Receitas" value={summary.realizedIncome + summary.pendingIncome} helper={`${brl.format(summary.pendingIncome)} a receber`} tone="light" icon={<ArrowUpRight size={19} />} />
      <MetricCard label="Despesas" value={summary.realizedExpense + summary.pendingExpense} helper={`${brl.format(summary.pendingExpense)} ainda previstas`} tone="light" icon={<ArrowDownRight size={19} />} />
    </section>

    <section className="dashboard-grid">
      <article className="panel flow-panel">
        <div className="panel-heading"><div><span className="eyebrow">Movimentação do mês</span><h2>Fluxo de caixa</h2></div><div className="chart-legend"><span className="income-dot">Entradas</span><span className="expense-dot">Saídas</span><span className="balance-dot">Saldo</span></div></div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={flow} margin={{ left: -20, right: 8, top: 16 }}>
              <defs>
                <linearGradient id="income" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#25b787" stopOpacity={.32} /><stop offset="1" stopColor="#25b787" stopOpacity={0} /></linearGradient>
                <linearGradient id="expense" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ef8f6a" stopOpacity={.22} /><stop offset="1" stopColor="#ef8f6a" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke="#edf1ef" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#87918d", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => short.format(value)} tick={{ fill: "#87918d", fontSize: 11 }} />
              <Tooltip formatter={(value) => brl.format(Number(value))} contentStyle={{ borderRadius: 12, border: "1px solid #e4e9e6" }} />
              <Area type="monotone" dataKey="entradas" stroke="#13956c" strokeWidth={2.5} fill="url(#income)" />
              <Area type="monotone" dataKey="saidas" stroke="#e27c54" strokeWidth={2.5} fill="url(#expense)" />
              <Line type="monotone" dataKey="saldo" stroke="#263e69" strokeWidth={2.6} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel category-panel">
        <div className="panel-heading"><div><span className="eyebrow">Onde você gastou</span><h2>Por categoria</h2></div><button className="text-action" onClick={() => onNavigate("transactions")}>Ver detalhes</button></div>
        <div className="category-content">
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={categories} innerRadius={56} outerRadius={77} paddingAngle={3} dataKey="value" stroke="none">{categories.map((entry) => <Cell fill={entry.color} key={entry.name} />)}</Pie></PieChart>
            </ResponsiveContainer>
            <div className="donut-label"><small>Total</small><strong>{short.format(categoryTotal)}</strong></div>
          </div>
          <div className="category-list">{categories.slice(0, 4).map((item) => <div key={item.name}><span className="category-color" style={{ background: item.color }} /><span>{item.name}</span><strong>{brl.format(item.value)}</strong><small>{categoryTotal ? Math.round(item.value / categoryTotal * 100) : 0}%</small></div>)}</div>
        </div>
      </article>
    </section>

    <section className="lower-grid">
      <article className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Fique de olho</span><h2>Próximos vencimentos</h2></div><button className="text-action" onClick={() => onNavigate("transactions")}>Ver todos <ChevronRight size={15} /></button></div>
        <div className="upcoming-list">{upcoming.map((item) => {
          const day = new Date(`${item.dueDate}T12:00:00`).getDate();
          return <div className="upcoming-item" key={item.id}><div className="date-box"><strong>{day}</strong><small>{month.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</small></div><div className="upcoming-info"><strong>{item.description}</strong><small>{item.kind === "invoice_payment" ? "Fatura de cartão" : item.kind === "debt_payment" ? "Dívida" : "Conta recorrente"}</small></div><strong>{brl.format(item.amount)}</strong><span className="status-pill pending"><CalendarClock size={13} /> Pendente</span></div>;
        })}{!upcoming.length && <div className="empty-state"><CheckCircle2 size={28} /><strong>Tudo em dia!</strong><span>Nenhuma conta pendente.</span></div>}</div>
      </article>

      <div className="side-stack">
        {card && <article className="mini-card credit-summary" style={{ "--card-color": card.color } as React.CSSProperties}>
          <div className="mini-card-top"><span><CreditCard size={18} /> Fatura atual</span><small>•••• {card.lastDigits}</small></div>
          <strong>{brl.format(cardUsed)}</strong><div className="progress"><span style={{ width: `${Math.min(100, cardUsed / card.limit * 100)}%` }} /></div>
          <div className="mini-card-bottom"><span>Limite disponível <strong>{brl.format(card.limit - cardUsed)}</strong></span><span>Vence dia <strong>{card.dueDay}</strong></span></div>
        </article>}
        <article className="mini-card debt-summary"><div><span className="round-icon coral"><TrendingDown size={19} /></span><div><small>Saldo das dívidas</small><strong>{brl.format(data.debts.reduce((sum, item) => sum + item.outstandingBalance, 0))}</strong></div></div><button onClick={() => onNavigate("debts")}><ChevronRight size={18} /></button></article>
      </div>
    </section>
  </div>;
}
