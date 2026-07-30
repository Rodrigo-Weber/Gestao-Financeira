import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, CalendarClock, CheckCircle2, ChevronRight, CreditCard, Gauge, PiggyBank, Target, TrendingDown, Wallet, WalletCards } from "lucide-react";
import type { FinanceData } from "../types";
import { accountBalance, calculateSummary, cashFlowSeries, categorySpend, monthTransactions } from "../lib/finance";

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
  const monthItems = useMemo(() => monthTransactions(data.transactions, month), [data.transactions, month]);
  const totalIncome = summary.realizedIncome + summary.pendingIncome;
  const totalExpense = summary.realizedExpense + summary.pendingExpense;
  const savingsRate = totalIncome ? Math.round((totalIncome - totalExpense) / totalIncome * 100) : 0;
  const budgetOverview = data.budgets.filter((item) => item.month === monthKey).map((budget) => {
    const category = data.categories.find((item) => item.id === budget.categoryId);
    const spent = categories.find((item) => item.name === category?.name)?.value ?? 0;
    return { name: category?.name ?? "Categoria", color: category?.color ?? "#8c9792", spent, limit: budget.limit, percent: budget.limit ? Math.round(spent / budget.limit * 100) : 0 };
  }).sort((a, b) => b.percent - a.percent).slice(0, 4);
  const accountAllocation = data.accounts.map((account) => ({
    name: account.name,
    value: Math.max(0, accountBalance(data, account.id)),
    fill: account.color,
  })).sort((a, b) => b.value - a.value).slice(0, 4);
  const paidCount = monthItems.filter((item) => item.status === "paid").length;
  const attentionCount = monthItems.filter((item) => item.status === "overdue").length;
  const pendingCount = monthItems.filter((item) => item.status === "pending").length;
  const statusData = [
    { name: "Pagas", value: paidCount, color: "#15976e" },
    { name: "Pendentes", value: pendingCount, color: "#e6a93f" },
    { name: "Atrasadas", value: attentionCount, color: "#e76f51" },
  ].filter((item) => item.value > 0);
  const resolvedPercent = monthItems.length ? Math.round(paidCount / monthItems.length * 100) : 100;

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

    <section className="financial-pulse" aria-label="Indicadores rápidos">
      <div><span className="pulse-icon green"><Gauge size={17} /></span><span><small>Taxa de economia</small><strong className={savingsRate < 0 ? "negative" : ""}>{savingsRate}%</strong></span></div>
      <div><span className="pulse-icon blue"><Target size={17} /></span><span><small>Orçamentos no limite</small><strong>{budgetOverview.filter((item) => item.percent <= 100).length} de {budgetOverview.length || 0}</strong></span></div>
      <div><span className="pulse-icon amber"><CalendarClock size={17} /></span><span><small>Contas por resolver</small><strong>{pendingCount + attentionCount}</strong></span></div>
      <div><span className="pulse-icon violet"><WalletCards size={17} /></span><span><small>Contas conectadas</small><strong>{data.accounts.length}</strong></span></div>
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
              <PieChart><Pie data={categories} innerRadius={56} outerRadius={77} paddingAngle={3} dataKey="value" stroke="none">{categories.map((entry) => <Cell fill={entry.color} key={entry.name} />)}</Pie><Tooltip formatter={(value) => brl.format(Number(value))} /></PieChart>
            </ResponsiveContainer>
            <div className="donut-label"><small>Total</small><strong>{short.format(categoryTotal)}</strong></div>
          </div>
          <div className="category-list">{categories.slice(0, 4).map((item) => <div key={item.name}><span className="category-color" style={{ background: item.color }} /><span>{item.name}</span><strong>{brl.format(item.value)}</strong><small>{categoryTotal ? Math.round(item.value / categoryTotal * 100) : 0}%</small></div>)}</div>
        </div>
      </article>
    </section>

    <section className="analytics-grid">
      <article className="panel budget-overview">
        <div className="panel-heading"><div><span className="eyebrow">Planejado x realizado</span><h2>Saúde dos orçamentos</h2></div><button className="text-action" onClick={() => onNavigate("settings")}>Ajustar limites</button></div>
        <div className="budget-overview-list">
          {budgetOverview.map((item) => <div key={item.name}>
            <div><span><i style={{ background: item.color }} />{item.name}</span><strong>{brl.format(item.spent)} <small>/ {brl.format(item.limit)}</small></strong></div>
            <div className={`progress large ${item.percent > 100 ? "danger" : ""}`}><span style={{ width: `${Math.min(100, item.percent)}%`, background: item.color }} /></div>
            <small className={item.percent > 100 ? "danger-text" : ""}>{item.percent}% usado</small>
          </div>)}
          {!budgetOverview.length && <div className="compact-empty"><Target size={22} /><span>Defina limites para acompanhar seus gastos.</span></div>}
        </div>
      </article>

      <article className="panel allocation-panel">
        <div className="panel-heading"><div><span className="eyebrow">Dinheiro disponível</span><h2>Saldo por conta</h2></div><button className="text-action" onClick={() => onNavigate("accounts")}>Ver contas</button></div>
        <div className="allocation-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={accountAllocation} layout="vertical" margin={{ left: 2, right: 26, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#edf1ef" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={92} axisLine={false} tickLine={false} tick={{ fill: "#66746e", fontSize: 10 }} />
              <Tooltip formatter={(value) => brl.format(Number(value))} cursor={{ fill: "#f7faf8" }} />
              <Bar dataKey="value" radius={[0, 7, 7, 0]} barSize={16}>{accountAllocation.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel status-panel">
        <div className="panel-heading"><div><span className="eyebrow">Ritmo do mês</span><h2>Compromissos</h2></div></div>
        <div className="status-content">
          <div className="status-donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={statusData} dataKey="value" innerRadius={46} outerRadius={62} paddingAngle={4} stroke="none">{statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie></PieChart>
            </ResponsiveContainer>
            <div><strong>{resolvedPercent}%</strong><small>resolvido</small></div>
          </div>
          <div className="status-legend">
            {[{ label: "Pagas", value: paidCount, color: "#15976e" }, { label: "Pendentes", value: pendingCount, color: "#e6a93f" }, { label: "Atrasadas", value: attentionCount, color: "#e76f51" }].map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{item.value}</strong></div>)}
          </div>
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
