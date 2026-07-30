import { useMemo, useState } from "react";
import { CheckCircle2, CircleDollarSign, Filter, Pencil, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import type { FinanceData, Transaction } from "../types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const status: Record<string, string> = { paid: "Pago", pending: "Pendente", overdue: "Atrasado", cancelled: "Cancelado" };

export function TransactionsPage({ data, month, onAdd, onMarkPaid, onEdit, onDelete }: { data: FinanceData; month: string; onAdd: () => void; onMarkPaid: (id: string) => void; onEdit: (item: Transaction) => void; onDelete: (item: Transaction) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const items = useMemo(() => data.transactions.filter((item) => {
    const matchesQuery = item.description.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || item.status === filter;
    return item.dueDate.startsWith(month) && matchesQuery && matchesFilter;
  }).sort((a, b) => b.dueDate.localeCompare(a.dueDate)), [data.transactions, month, query, filter]);

  return <div className="page-stack">
    <section className="page-title"><div><span className="eyebrow">Histórico completo</span><h1>Transações</h1><p>Encontre, filtre e acompanhe cada movimento do seu dinheiro.</p></div><button className="primary-btn" onClick={onAdd}>+ Novo lançamento</button></section>
    <article className="panel table-panel">
      <div className="table-tools"><div className="search-box"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar transação..." autoFocus /></div><div className="filter-tabs"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas</button><button className={filter === "paid" ? "active" : ""} onClick={() => setFilter("paid")}>Pagas</button><button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>Pendentes</button></div><button className={`filter-button ${filter === "overdue" ? "active" : ""}`} onClick={() => setFilter(filter === "overdue" ? "all" : "overdue")}><SlidersHorizontal size={17} /> Atrasadas</button></div>
      <div className="transaction-table">
        <div className="table-head"><span>Transação</span><span>Categoria</span><span>Vencimento</span><span>Status</span><span>Valor</span><span /></div>
        {items.map((item) => <TransactionRow key={item.id} item={item} data={data} onMarkPaid={onMarkPaid} onEdit={onEdit} onDelete={onDelete} />)}
        {!items.length && <div className="empty-state table-empty"><Filter size={28} /><strong>Nenhum lançamento encontrado</strong><span>Tente mudar os filtros ou registre uma nova transação.</span></div>}
      </div>
    </article>
  </div>;
}

function TransactionRow({ item, data, onMarkPaid, onEdit, onDelete }: { item: Transaction; data: FinanceData; onMarkPaid: (id: string) => void; onEdit: (item: Transaction) => void; onDelete: (item: Transaction) => void }) {
  const category = data.categories.find((value) => value.id === item.categoryId);
  const income = item.kind === "income";
  return <div className="table-row">
    <div className="transaction-name"><span className={`round-icon ${income ? "green" : "soft"}`}><CircleDollarSign size={18} /></span><div><strong>{item.description}</strong><small>{data.accounts.find((value) => value.id === item.accountId)?.name ?? data.cards.find((value) => value.id === item.cardId)?.name ?? "Sem conta"}</small></div></div>
    <span>{category ? <span className="category-chip"><i style={{ background: category.color }} />{category.name}</span> : "—"}</span>
    <span>{new Date(`${item.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}</span>
    <span><span className={`status-pill ${item.status}`}>{status[item.status]}</span></span>
    <strong className={income ? "positive" : ""}>{income ? "+" : "−"} {brl.format(item.amount)}</strong>
    <span className="transaction-row-actions">{item.status !== "paid" && item.status !== "cancelled" && <button className="icon-btn success" title="Marcar como pago" onClick={() => onMarkPaid(item.id)}><CheckCircle2 size={17} /></button>}<button className="icon-btn" title="Editar transação" onClick={() => onEdit(item)}><Pencil size={16} /></button><button className="icon-btn danger-button" title="Excluir transação" onClick={() => onDelete(item)}><Trash2 size={16} /></button></span>
  </div>;
}
