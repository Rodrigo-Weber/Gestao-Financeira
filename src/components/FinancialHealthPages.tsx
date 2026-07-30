import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CalendarDays, CalendarRange, CheckCircle2, CircleDollarSign, Landmark, PiggyBank, Plus, ShieldCheck, Sparkles, Target, TrendingUp, WalletCards } from "lucide-react";
import type { FinanceData } from "../types";
import { budgetPace, emergencyPlan, forecastSummary, goalPlan, incomeCommitment, monthlyReview, netWorth, recurringIncome, simulatePurchase, subscriptionInsights, unusualExpenses } from "../lib/health";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

type GoalInput = { name: string; targetAmount: number; currentAmount: number; targetDate?: string; priority: 1 | 2 | 3; kind: "goal" | "emergency" };
type FundInput = { name: string; targetAmount: number; currentAmount: number; dueMonth: number };
type AssetInput = { name: string; type: "property" | "vehicle" | "business" | "cash" | "other"; value: number };

export function TodayPage({ data, month, onNavigate }: { data: FinanceData; month: Date; onNavigate: (page: string) => void }) {
  const forecast = useMemo(() => forecastSummary(data), [data]);
  const worth = useMemo(() => netWorth(data), [data]);
  const reserve = useMemo(() => emergencyPlan(data), [data]);
  const review = useMemo(() => monthlyReview(data, month), [data, month]);
  const pace = useMemo(() => budgetPace(data, month), [data, month]);
  const nextItems = data.transactions.filter((item) => item.status !== "paid" && item.status !== "cancelled" && item.dueDate >= format(new Date(), "yyyy-MM-dd") && item.dueDate <= format(addDays(new Date(), 14), "yyyy-MM-dd")).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8);

  return <div className="page-stack health-page">
    <section className="page-title"><div><span className="eyebrow">Decisões rápidas</span><h1>Hoje</h1><p>As respostas mais importantes da sua vida financeira, sem procurar em várias telas.</p></div></section>
    <section className="today-answer-grid">
      <article className="health-answer green"><WalletCards size={20} /><small>Quanto tenho?</small><strong className="money">{brl.format(worth.accounts)}</strong><span>Saldo calculado das contas</span><button onClick={() => onNavigate("accounts")}>Ver contas</button></article>
      <article className={`health-answer ${forecast.days30 < 0 ? "coral" : "green"}`}><CircleDollarSign size={20} /><small>Quanto posso gastar?</small><strong className="money">{brl.format(Math.max(0, forecast.days30))}</strong><span>Projeção após 30 dias</span><button onClick={() => onNavigate("planning")}>Ver previsão</button></article>
      <article className="health-answer amber"><CalendarDays size={20} /><small>O que vence?</small><strong>{nextItems.length} itens</strong><span>Nos próximos 14 dias</span><button onClick={() => onNavigate("transactions")}>Organizar</button></article>
      <article className={review.score >= 70 ? "health-answer green" : "health-answer coral"}><TrendingUp size={20} /><small>Estou melhorando?</small><strong>{review.score}/100</strong><span>Nota da revisão mensal</span><button onClick={() => onNavigate("planning")}>Revisar mês</button></article>
      <article className="health-answer violet"><PiggyBank size={20} /><small>Reserva e patrimônio</small><strong className="money">{brl.format(worth.total)}</strong><span>Reserva cobre {reserve.coveredMonths} meses</span><button onClick={() => onNavigate("patrimony")}>Ver patrimônio</button></article>
    </section>
    <section className="today-grid">
      <article className="panel health-panel"><div className="panel-heading"><div><span className="eyebrow">Próximos 14 dias</span><h2>Calendário financeiro</h2></div><CalendarRange size={20} /></div><div className="calendar-list">{nextItems.map((item) => <div key={item.id}><span className="calendar-date"><b>{parseISO(item.dueDate).getDate()}</b><small>{parseISO(item.dueDate).toLocaleDateString("pt-BR", { month: "short" })}</small></span><div><strong>{item.description}</strong><small>{item.kind === "income" ? "Entrada esperada" : "Pagamento previsto"}</small></div><strong className={item.kind === "income" ? "positive" : "negative"}>{item.kind === "income" ? "+" : "−"} {brl.format(item.amount)}</strong></div>)}{!nextItems.length && <div className="empty-state"><CheckCircle2 size={24} /><strong>Nada urgente</strong><span>Nenhum vencimento nos próximos 14 dias.</span></div>}</div></article>
      <article className="panel health-panel"><div className="panel-heading"><div><span className="eyebrow">Ritmo do mês</span><h2>Orçamento versus tempo</h2></div></div><div className="pace-list">{pace.map((item) => <div key={item.categoryId}><div><strong>{item.name}</strong><small>{item.usedPercent}% usado • {item.elapsedPercent}% do mês</small></div><span className={`status-pill ${item.status === "normal" ? "paid" : item.status === "over" ? "overdue" : "pending"}`}>{item.status === "normal" ? "Normal" : item.status === "over" ? "Estourado" : "Atenção"}</span><div className={`progress ${item.status === "over" ? "danger" : ""}`}><span style={{ width: `${Math.min(100, item.usedPercent)}%` }} /></div></div>)}{!pace.length && <div className="empty-state"><Target size={24} /><strong>Defina seus limites</strong><span>Orçamentos transformam gasto em decisão.</span><button onClick={() => onNavigate("settings")}>Configurar</button></div>}</div></article>
    </section>
    {forecast.firstNegative && <div className="health-warning"><AlertTriangle size={20} /><div><strong>Risco de saldo negativo em {parseISO(forecast.firstNegative).toLocaleDateString("pt-BR")}</strong><span>Revise contas pendentes ou antecipe uma entrada.</span></div><button onClick={() => onNavigate("planning")}>Abrir plano</button></div>}
  </div>;
}

export function PlanningPage({ data, month, onAddGoal, onAddFund }: { data: FinanceData; month: Date; onAddGoal: (input: GoalInput) => Promise<void>; onAddFund: (input: FundInput) => Promise<void> }) {
  const forecast = useMemo(() => forecastSummary(data), [data]);
  const reserve = useMemo(() => emergencyPlan(data), [data]);
  const subscriptions = useMemo(() => subscriptionInsights(data, month), [data, month]);
  const unusual = useMemo(() => unusualExpenses(data, month), [data, month]);
  const review = useMemo(() => monthlyReview(data, month), [data, month]);
  const recurring = useMemo(() => recurringIncome(data, month), [data, month]);
  const [purchaseAmount, setPurchaseAmount] = useState(1000);
  const [purchaseInstallments, setPurchaseInstallments] = useState(1);
  const purchase = useMemo(() => simulatePurchase(data, purchaseAmount, purchaseInstallments), [data, purchaseAmount, purchaseInstallments]);
  const [goal, setGoal] = useState<GoalInput>({ name: "", targetAmount: 0, currentAmount: 0, targetDate: "", priority: 2, kind: "goal" });
  const [fund, setFund] = useState<FundInput>({ name: "", targetAmount: 0, currentAmount: 0, dueMonth: 12 });

  return <div className="page-stack health-page">
    <section className="page-title"><div><span className="eyebrow">Proteção e objetivos</span><h1>Planejar</h1><p>Antecipe riscos, construa sua reserva e transforme objetivos em aportes mensais.</p></div></section>
    <section className="forecast-grid">
      {[["30 dias", forecast.days30], ["60 dias", forecast.days60], ["90 dias", forecast.days90]].map(([label, value]) => <article className={`forecast-card ${Number(value) < 0 ? "danger" : ""}`} key={String(label)}><small>Saldo em {label}</small><strong className="money">{brl.format(Number(value))}</strong><span>{Number(value) < 0 ? "Ação necessária" : "Caixa projetado positivo"}</span></article>)}
      <article className="panel forecast-chart"><div><span className="eyebrow">Previsão diária</span><h2>Próximos 90 dias</h2><p>Menor saldo: <b>{brl.format(forecast.lowest.balance)}</b>{forecast.firstNegative ? ` em ${parseISO(forecast.firstNegative).toLocaleDateString("pt-BR")}` : " • sem saldo negativo"}</p></div><ResponsiveContainer width="100%" height={190}><AreaChart data={forecast.series.filter((_, index) => index % 3 === 0)}><defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#15976e" stopOpacity={.3} /><stop offset="100%" stopColor="#15976e" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} /><YAxis tickFormatter={(value) => compact.format(value)} /><Tooltip formatter={(value) => brl.format(Number(value))} labelFormatter={(value) => parseISO(String(value)).toLocaleDateString("pt-BR")} /><Area dataKey="balance" stroke="#15976e" fill="url(#forecastFill)" /></AreaChart></ResponsiveContainer></article>
    </section>
    <section className="planning-grid">
      <article className="panel reserve-card"><div className="panel-heading"><div><span className="eyebrow">Proteção</span><h2>Reserva de emergência</h2></div><ShieldCheck size={22} /></div><div className="reserve-number"><strong className="money">{brl.format(reserve.accumulated)}</strong><span>de {brl.format(reserve.target)}</span></div><div className="progress large"><span style={{ width: `${reserve.progress}%` }} /></div><div className="health-stats"><div><small>Cobertura</small><strong>{reserve.coveredMonths} meses</strong></div><div><small>Aporte sugerido</small><strong className="money">{brl.format(reserve.monthlyContribution)}/mês</strong></div><div><small>Essencial mensal</small><strong className="money">{brl.format(reserve.monthlyEssential)}</strong></div></div></article>
      <article className="panel purchase-card"><div className="panel-heading"><div><span className="eyebrow">Antes de comprar</span><h2>Simulador de compra</h2></div><Sparkles size={21} /></div><div className="form-grid"><label>Valor<input type="number" min="0" value={purchaseAmount} onChange={(event) => setPurchaseAmount(Number(event.target.value))} /></label><label>Parcelas<input type="number" min="1" max="48" value={purchaseInstallments} onChange={(event) => setPurchaseInstallments(Number(event.target.value))} /></label></div><div className={`purchase-result ${purchase.safe ? "safe" : "risk"}`}><strong>{purchase.safe ? "Compra cabe no plano" : "Compra pressiona seu caixa"}</strong><span>{purchaseInstallments}× de {brl.format(purchase.installment)} • saldo em 30 dias: {brl.format(purchase.cashAfter)}</span><small>Consome {purchase.goalPressure}% do aporte mensal previsto para metas.</small></div></article>
    </section>
    <section className="planning-grid">
      <article className="panel goals-card"><div className="panel-heading"><div><span className="eyebrow">Objetivos</span><h2>Metas financeiras</h2></div><Target size={21} /></div><div className="goal-list">{(data.goals ?? []).map((item) => {
        const plan = goalPlan(item);
        return <div key={item.id}><div><strong>{item.name}</strong><small>{plan.months} meses • aporte {brl.format(plan.monthly)}/mês</small></div><b>{plan.progress}%</b><div className="progress"><span style={{ width: `${plan.progress}%` }} /></div></div>;
      })}</div><form className="compact-form" onSubmit={(event) => { event.preventDefault(); void onAddGoal(goal).then(() => setGoal({ name: "", targetAmount: 0, currentAmount: 0, targetDate: "", priority: 2, kind: "goal" })); }}><input placeholder="Nome da meta" value={goal.name} onChange={(event) => setGoal({ ...goal, name: event.target.value })} required /><input type="number" min="1" placeholder="Valor alvo" value={goal.targetAmount || ""} onChange={(event) => setGoal({ ...goal, targetAmount: Number(event.target.value) })} required /><input type="number" min="0" placeholder="Já tenho" value={goal.currentAmount || ""} onChange={(event) => setGoal({ ...goal, currentAmount: Number(event.target.value) })} /><input type="date" value={goal.targetDate} onChange={(event) => setGoal({ ...goal, targetDate: event.target.value })} /><select value={goal.kind} onChange={(event) => setGoal({ ...goal, kind: event.target.value as GoalInput["kind"] })}><option value="goal">Meta</option><option value="emergency">Reserva</option></select><button className="primary-btn"><Plus size={16} /> Adicionar</button></form></article>
      <article className="panel goals-card"><div className="panel-heading"><div><span className="eyebrow">Despesas anuais</span><h2>Fundos planejados</h2></div><CalendarRange size={21} /></div><div className="goal-list">{(data.annualFunds ?? []).map((item) => {
        const remainingMonths = Math.max(1, (item.dueMonth - new Date().getMonth() - 1 + 12) % 12 || 12);
        const remaining = Math.max(0, item.targetAmount - item.currentAmount);
        const progress = Math.min(100, Math.round(item.currentAmount / item.targetAmount * 100));
        return <div key={item.id}><div><strong>{item.name}</strong><small>mês {item.dueMonth} • guardar {brl.format(remaining / remainingMonths)}/mês</small></div><b>{progress}%</b><div className="progress"><span style={{ width: `${progress}%` }} /></div></div>;
      })}</div><form className="compact-form" onSubmit={(event) => { event.preventDefault(); void onAddFund(fund).then(() => setFund({ name: "", targetAmount: 0, currentAmount: 0, dueMonth: 12 })); }}><input placeholder="IPVA, seguro, viagem..." value={fund.name} onChange={(event) => setFund({ ...fund, name: event.target.value })} required /><input type="number" min="1" placeholder="Valor anual" value={fund.targetAmount || ""} onChange={(event) => setFund({ ...fund, targetAmount: Number(event.target.value) })} required /><input type="number" min="0" placeholder="Já guardado" value={fund.currentAmount || ""} onChange={(event) => setFund({ ...fund, currentAmount: Number(event.target.value) })} /><input type="number" min="1" max="12" value={fund.dueMonth} onChange={(event) => setFund({ ...fund, dueMonth: Number(event.target.value) })} /><button className="primary-btn"><Plus size={16} /> Adicionar</button></form></article>
    </section>
    <section className="insight-grid">
      <article className="panel insight-card"><span className="eyebrow">Assinaturas detectadas</span><h2>{brl.format(subscriptions.reduce((sum, item) => sum + item.monthly, 0))}/mês</h2><p>{brl.format(subscriptions.reduce((sum, item) => sum + item.annual, 0))} por ano</p>{subscriptions.slice(0, 5).map((item) => <div key={item.key}><strong>{item.name}</strong><span>{brl.format(item.monthly)}</span></div>)}</article>
      <article className="panel insight-card"><span className="eyebrow">Gastos incomuns</span><h2>{unusual.length} alertas</h2><p>Comparação com a média móvel dos 3 meses anteriores.</p>{unusual.slice(0, 5).map((item) => <div key={item.id}><strong>{item.description}</strong><span>+{brl.format(item.excess)}</span></div>)}</article>
      <article className="panel insight-card"><span className="eyebrow">Revisão mensal guiada</span><h2>Nota {review.score}/100</h2><p>{review.budgetsOver} orçamentos estourados • {review.unusual} gastos incomuns</p><div><strong>Rendas recorrentes</strong><span>{recurring.filter((item) => item.recurring).length}</span></div><div><strong>Lembrete Registrato</strong><span>{new Date().getMonth() === 0 ? "Fazer auditoria" : "Janeiro"}</span></div></article>
    </section>
  </div>;
}

export function PatrimonyPage({ data, onAddAsset }: { data: FinanceData; onAddAsset: (input: AssetInput) => Promise<void> }) {
  const worth = useMemo(() => netWorth(data), [data]);
  const commitment = useMemo(() => incomeCommitment(data), [data]);
  const [asset, setAsset] = useState<AssetInput>({ name: "", type: "other", value: 0 });
  const allocation = [
    { name: "Contas", value: Math.max(0, worth.accounts), color: "#15976e" },
    { name: "Investimentos", value: worth.investments, color: "#6f5bd5" },
    { name: "Outros ativos", value: worth.assets, color: "#d7a93b" },
  ].filter((item) => item.value > 0);
  const snapshotData = (data.snapshots ?? []).map((item) => ({ month: item.referenceMonth.slice(0, 7), value: item.netWorth }));

  return <div className="page-stack health-page">
    <section className="page-title"><div><span className="eyebrow">Tudo que você construiu</span><h1>Patrimônio</h1><p>Ativos, investimentos e dívidas reunidos em uma visão líquida.</p></div></section>
    <section className="patrimony-hero"><div><small>Patrimônio líquido</small><strong className="money">{brl.format(worth.total)}</strong><span>ativos menos todas as dívidas</span></div><div className="patrimony-totals"><span>Contas <b>{brl.format(worth.accounts)}</b></span><span>Investimentos <b>{brl.format(worth.investments)}</b></span><span>Outros ativos <b>{brl.format(worth.assets)}</b></span><span>Dívidas <b className="negative">− {brl.format(worth.debts)}</b></span></div></section>
    <section className="patrimony-grid">
      <article className="panel allocation-card"><div className="panel-heading"><div><span className="eyebrow">Distribuição</span><h2>Onde está seu patrimônio</h2></div></div><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={allocation} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86}>{allocation.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value) => brl.format(Number(value))} /></PieChart></ResponsiveContainer><div className="allocation-legend">{allocation.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<b>{brl.format(item.value)}</b></span>)}</div></article>
      <article className="panel allocation-card"><div className="panel-heading"><div><span className="eyebrow">Evolução mensal</span><h2>Patrimônio líquido</h2></div></div>{snapshotData.length ? <ResponsiveContainer width="100%" height={250}><LineChart data={snapshotData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis tickFormatter={(value) => compact.format(value)} /><Tooltip formatter={(value) => brl.format(Number(value))} /><Line type="monotone" dataKey="value" stroke="#15976e" strokeWidth={3} dot={{ fill: "#15976e" }} /></LineChart></ResponsiveContainer> : <div className="empty-state"><TrendingUp size={24} /><strong>Primeiro retrato pendente</strong><span>Será criado na próxima sincronização Pluggy.</span></div>}</article>
    </section>
    <article className="panel investment-section"><div className="panel-heading"><div><span className="eyebrow">Carteira importada</span><h2>Investimentos</h2><p>Saldo líquido informado pela instituição.</p></div><PiggyBank size={22} /></div><div className="investment-grid">{(data.investments ?? []).filter((item) => item.status !== "TOTAL_WITHDRAWAL").map((item) => <div className="investment-card" key={item.id}><span className="round-icon violet"><TrendingUp size={18} /></span><div><strong>{item.name}</strong><small>{item.institution} • {item.subtype || item.type}</small></div><strong className="money">{brl.format(item.balance)}</strong><span>{item.amountProfit != null ? `${item.amountProfit >= 0 ? "+" : ""}${brl.format(item.amountProfit)} resultado` : item.annualRate != null ? `${item.annualRate}% a.a.` : "Posição atual"}</span></div>)}{!(data.investments ?? []).length && <div className="empty-state"><PiggyBank size={24} /><strong>Nenhum investimento</strong><span>Sincronize a Pluggy ou cadastre outros ativos.</span></div>}</div></article>
    <section className="planning-grid">
      <article className="panel goals-card"><div className="panel-heading"><div><span className="eyebrow">Outros bens</span><h2>Ativos manuais</h2></div><Landmark size={21} /></div><div className="goal-list">{(data.assets ?? []).map((item) => <div key={item.id}><div><strong>{item.name}</strong><small>{item.type}</small></div><b>{brl.format(item.value)}</b></div>)}</div><form className="compact-form asset-form" onSubmit={(event) => { event.preventDefault(); void onAddAsset(asset).then(() => setAsset({ name: "", type: "other", value: 0 })); }}><input placeholder="Imóvel, veículo..." value={asset.name} onChange={(event) => setAsset({ ...asset, name: event.target.value })} required /><select value={asset.type} onChange={(event) => setAsset({ ...asset, type: event.target.value as AssetInput["type"] })}><option value="property">Imóvel</option><option value="vehicle">Veículo</option><option value="business">Negócio</option><option value="cash">Dinheiro</option><option value="other">Outro</option></select><input type="number" min="0" placeholder="Valor atual" value={asset.value || ""} onChange={(event) => setAsset({ ...asset, value: Number(event.target.value) })} required /><button className="primary-btn"><Plus size={16} /> Adicionar</button></form></article>
      <article className="panel commitment-card"><span className="eyebrow">Comprometimento da renda</span><h2>{commitment.percent}% comprometida</h2><p>Despesas fixas e pagamentos mínimos de dívidas.</p><div className="progress large"><span style={{ width: `${Math.min(100, commitment.percent)}%` }} /></div><div className="health-stats"><div><small>Renda</small><strong>{brl.format(commitment.income)}</strong></div><div><small>Fixos + dívidas</small><strong>{brl.format(commitment.committed)}</strong></div><div><small>Margem livre</small><strong>{brl.format(commitment.free)}</strong></div></div><small className="indicator-help">Até 35% costuma oferecer folga. Acima de 50% exige atenção ao caixa.</small></article>
    </section>
    <article className="panel debt-diagnosis"><div className="panel-heading"><div><span className="eyebrow">Diagnóstico</span><h2>Custo das dívidas</h2></div></div><div className="diagnosis-grid">{data.debts.map((debt) => {
      const monthlyInterest = debt.outstandingBalance * debt.monthlyInterest / 100;
      const remaining = debt.remainingInstallments ?? Math.max(1, Math.ceil(debt.outstandingBalance / Math.max(1, debt.minimumPayment)));
      const futureInterest = monthlyInterest * remaining / 2;
      return <div key={debt.id}><strong>{debt.name}</strong><span>Saldo {brl.format(debt.outstandingBalance)}</span><span>Custo futuro estimado {brl.format(futureInterest)}</span><span>Pagamento extra reduz juros e prazo</span></div>;
    })}</div></article>
  </div>;
}

export type { AssetInput, FundInput, GoalInput };
