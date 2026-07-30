import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileDown, FileSpreadsheet, FileText, Sheet } from "lucide-react";
import type { FinanceData } from "../types";
import { calculateSummary, categorySpend } from "../lib/finance";
import { exportCsv, exportExcel, exportPdf } from "../lib/reports";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ReportsPage({ data, month }: { data: FinanceData; month: Date }) {
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const scopedData = { ...data, transactions: data.transactions.filter((item) => item.dueDate.startsWith(monthKey)), budgets: data.budgets.filter((item) => item.month === monthKey) };
  const summary = calculateSummary(data, month);
  const categories = categorySpend(data, month);
  const incomeTotal = summary.realizedIncome + summary.pendingIncome;
  const expenseTotal = summary.realizedExpense + summary.pendingExpense;
  const comparison = [
    { name: "Receitas", realizado: summary.realizedIncome, previsto: summary.pendingIncome },
    { name: "Despesas", realizado: summary.realizedExpense, previsto: summary.pendingExpense },
  ];
  const statusBreakdown = [
    { name: "Pagas", value: scopedData.transactions.filter((item) => item.status === "paid").length, color: "#15976e" },
    { name: "Pendentes", value: scopedData.transactions.filter((item) => item.status === "pending").length, color: "#e6a93f" },
    { name: "Atrasadas", value: scopedData.transactions.filter((item) => item.status === "overdue").length, color: "#e76f51" },
  ].filter((item) => item.value > 0);
  const balanceRatio = incomeTotal ? Math.round((incomeTotal - expenseTotal) / incomeTotal * 100) : 0;
  return <div className="page-stack"><section className="page-title"><div><span className="eyebrow">Leve seus dados com você</span><h1>Relatórios</h1><p>Exporte um retrato claro e completo da sua vida financeira.</p></div></section>
    <section className="report-summary"><div><small>Saldo projetado</small><strong>{brl.format(summary.projectedBalance)}</strong></div><div><small>Receitas do mês</small><strong>{brl.format(summary.realizedIncome + summary.pendingIncome)}</strong></div><div><small>Despesas do mês</small><strong>{brl.format(summary.realizedExpense + summary.pendingExpense)}</strong></div><div><small>Dívidas em aberto</small><strong>{brl.format(data.debts.reduce((sum, item) => sum + item.outstandingBalance, 0))}</strong></div></section>
    <section className="report-visual-grid">
      <article className="panel report-chart-card">
        <div className="panel-heading"><div><span className="eyebrow">Comparativo mensal</span><h2>Receitas e despesas</h2></div><span className={`chart-insight ${balanceRatio < 0 ? "negative" : ""}`}>{balanceRatio >= 0 ? "+" : ""}{balanceRatio}% de margem</span></div>
        <div className="report-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparison} margin={{ left: -10, right: 8, top: 18 }}>
              <CartesianGrid stroke="#edf1ef" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#66746e", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} tick={{ fill: "#87918d", fontSize: 10 }} />
              <Tooltip formatter={(value, name) => [brl.format(Number(value)), name === "realizado" ? "Realizado" : "Pendente"]} cursor={{ fill: "#f7faf8" }} />
              <Bar dataKey="realizado" stackId="total" fill="#15976e" radius={[0, 0, 0, 0]} barSize={52} />
              <Bar dataKey="previsto" stackId="total" fill="#a9decb" radius={[8, 8, 0, 0]} barSize={52} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="inline-legend"><span><i className="realized" />Realizado</span><span><i className="planned" />Pendente</span></div>
      </article>

      <article className="panel report-chart-card category-ranking">
        <div className="panel-heading"><div><span className="eyebrow">Concentração dos gastos</span><h2>Maiores categorias</h2></div></div>
        <div className="report-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categories.slice(0, 5)} layout="vertical" margin={{ left: 10, right: 32, top: 10, bottom: 0 }}>
              <CartesianGrid stroke="#edf1ef" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={92} axisLine={false} tickLine={false} tick={{ fill: "#66746e", fontSize: 10 }} />
              <Tooltip formatter={(value) => brl.format(Number(value))} cursor={{ fill: "#f7faf8" }} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18}>{categories.slice(0, 5).map((item) => <Cell key={item.name} fill={item.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel report-status-card">
        <div className="panel-heading"><div><span className="eyebrow">Andamento</span><h2>Status dos lançamentos</h2></div></div>
        <div className="report-status-content">
          <div className="report-status-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusBreakdown} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={4} stroke="none">{statusBreakdown.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
          <div className="status-legend">{statusBreakdown.map((item) => <div key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><strong>{item.value}</strong></div>)}</div>
        </div>
      </article>
    </section>
    <article className="panel budget-report"><div className="panel-heading"><div><span className="eyebrow">Limites mensais</span><h2>Orçamentos por categoria</h2></div></div><div className="budget-list">{scopedData.budgets.map((budget) => {
      const category = data.categories.find((item) => item.id === budget.categoryId);
      const spent = categories.find((item) => item.name === category?.name)?.value ?? 0;
      const percent = Math.round(spent / budget.limit * 100);
      return <div key={budget.id}><div><span><i style={{ background: category?.color }} />{category?.name}</span><strong>{brl.format(spent)} <small>de {brl.format(budget.limit)}</small></strong></div><div className={`progress large ${percent >= 100 ? "danger" : ""}`}><span style={{ width: `${Math.min(100, percent)}%`, background: category?.color }} /></div><small>{percent}% utilizado</small></div>;
    })}</div></article>
    <div className="section-heading"><div><span className="eyebrow">Seus dados, seu formato</span><h2>Exportações</h2></div><p>Arquivos prontos para análise, arquivo pessoal ou compartilhamento.</p></div>
    <section className="export-grid">
      <article className="export-card"><span className="export-icon pdf"><FileText size={27} /></span><div><h2>Relatório visual</h2><p>Resumo mensal pronto para ler, guardar ou compartilhar.</p><ul><li>Fluxo realizado e projetado</li><li>Principais categorias</li><li>Últimas transações</li></ul></div><button className="primary-btn" onClick={() => exportPdf(scopedData, month)}><FileDown size={18} /> Exportar PDF</button></article>
      <article className="export-card"><span className="export-icon excel"><FileSpreadsheet size={27} /></span><div><h2>Planilha completa</h2><p>Abas separadas, valores numéricos e totais para análise.</p><ul><li>Resumo consolidado</li><li>Todas as transações</li><li>Dívidas e empréstimos</li></ul></div><button className="primary-btn" onClick={() => exportExcel(scopedData, month)}><FileDown size={18} /> Exportar Excel</button></article>
      <article className="export-card"><span className="export-icon csv"><Sheet size={27} /></span><div><h2>Dados em CSV</h2><p>Formato universal para importar em qualquer ferramenta.</p><ul><li>Codificação UTF-8</li><li>Compatível com Excel</li><li>Valores preservados</li></ul></div><button className="secondary-btn" onClick={() => exportCsv(scopedData)}><FileDown size={18} /> Exportar CSV</button></article>
    </section>
  </div>;
}
