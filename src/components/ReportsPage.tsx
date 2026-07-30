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
  return <div className="page-stack"><section className="page-title"><div><span className="eyebrow">Leve seus dados com você</span><h1>Relatórios</h1><p>Exporte um retrato claro e completo da sua vida financeira.</p></div></section>
    <section className="report-summary"><div><small>Saldo projetado</small><strong>{brl.format(summary.projectedBalance)}</strong></div><div><small>Receitas do mês</small><strong>{brl.format(summary.realizedIncome + summary.pendingIncome)}</strong></div><div><small>Despesas do mês</small><strong>{brl.format(summary.realizedExpense + summary.pendingExpense)}</strong></div><div><small>Dívidas em aberto</small><strong>{brl.format(data.debts.reduce((sum, item) => sum + item.outstandingBalance, 0))}</strong></div></section>
    <section className="export-grid">
      <article className="export-card"><span className="export-icon pdf"><FileText size={27} /></span><div><h2>Relatório visual</h2><p>Resumo mensal pronto para ler, guardar ou compartilhar.</p><ul><li>Fluxo realizado e projetado</li><li>Principais categorias</li><li>Últimas transações</li></ul></div><button className="primary-btn" onClick={() => exportPdf(scopedData, month)}><FileDown size={18} /> Exportar PDF</button></article>
      <article className="export-card"><span className="export-icon excel"><FileSpreadsheet size={27} /></span><div><h2>Planilha completa</h2><p>Abas separadas, valores numéricos e totais para análise.</p><ul><li>Resumo consolidado</li><li>Todas as transações</li><li>Dívidas e empréstimos</li></ul></div><button className="primary-btn" onClick={() => exportExcel(scopedData, month)}><FileDown size={18} /> Exportar Excel</button></article>
      <article className="export-card"><span className="export-icon csv"><Sheet size={27} /></span><div><h2>Dados em CSV</h2><p>Formato universal para importar em qualquer ferramenta.</p><ul><li>Codificação UTF-8</li><li>Compatível com Excel</li><li>Valores preservados</li></ul></div><button className="secondary-btn" onClick={() => exportCsv(scopedData)}><FileDown size={18} /> Exportar CSV</button></article>
    </section>
    <article className="panel budget-report"><div className="panel-heading"><div><span className="eyebrow">Limites mensais</span><h2>Orçamentos por categoria</h2></div></div><div className="budget-list">{scopedData.budgets.map((budget) => {
      const category = data.categories.find((item) => item.id === budget.categoryId);
      const spent = categories.find((item) => item.name === category?.name)?.value ?? 0;
      const percent = Math.round(spent / budget.limit * 100);
      return <div key={budget.id}><div><span><i style={{ background: category?.color }} />{category?.name}</span><strong>{brl.format(spent)} <small>de {brl.format(budget.limit)}</small></strong></div><div className={`progress large ${percent >= 100 ? "danger" : ""}`}><span style={{ width: `${Math.min(100, percent)}%`, background: category?.color }} /></div><small>{percent}% utilizado</small></div>;
    })}</div></article>
  </div>;
}
