import { lazy, Suspense, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { addMonths, addYears, format, parseISO } from "date-fns";
import { Bell, Bot, ChevronDown, CreditCard, FileBarChart, LayoutDashboard, Menu, ReceiptText, Search, Settings, TrendingDown, WalletCards, X } from "lucide-react";
import { AuthScreen } from "./components/AuthScreen";
import { Dashboard } from "./components/Dashboard";
import { TransactionsPage } from "./components/TransactionsPage";
import { CardsPage, DebtsPage } from "./components/CardsDebtsPages";
import { AccountsPage } from "./components/AccountsPage";
import { BalanceAdjustmentModal } from "./components/BalanceAdjustmentModal";
import { ChatPanel, type SuggestedChanges } from "./components/ChatPanel";
import { QuickAddModal } from "./components/QuickAddModal";
import { EntityModal, type EntityKind, type EntityPayload } from "./components/EntityModal";
import { SettingsPage } from "./components/SettingsPage";
import { TransactionDeleteModal, TransactionEditModal, type TransactionEditValues } from "./components/TransactionActionModals";
import { demoData } from "./lib/demoData";
import { accountBalance, createInstallments } from "./lib/finance";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { Account, FinanceData, Transaction, TransactionDraft } from "./types";

type Page = "dashboard" | "transactions" | "accounts" | "cards" | "debts" | "reports" | "settings";
const ReportsPage = lazy(() => import("./components/ReportsPage").then((module) => ({ default: module.ReportsPage })));

const nav = [
  { id: "dashboard" as Page, label: "Visão geral", icon: LayoutDashboard },
  { id: "transactions" as Page, label: "Transações", icon: ReceiptText },
  { id: "accounts" as Page, label: "Contas", icon: WalletCards },
  { id: "cards" as Page, label: "Cartões", icon: CreditCard },
  { id: "debts" as Page, label: "Dívidas", icon: TrendingDown },
  { id: "reports" as Page, label: "Relatórios", icon: FileBarChart },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [demo, setDemo] = useState(!isSupabaseConfigured);
  const [data, setData] = useState<FinanceData>(demoData);
  const [displayName, setDisplayName] = useState("Rodrigo Weber");
  const [aiInstructions, setAiInstructions] = useState("");
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<TransactionDraft | null>(null);
  const [entityModal, setEntityModal] = useState<EntityKind | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editSuggestions, setEditSuggestions] = useState<Partial<TransactionEditValues> | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [toast, setToast] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: result }) => { setSession(result.session); setAuthReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthReady(true); });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && !demo) void loadFinanceData();
  }, [session, demo]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPage("transactions");
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  async function loadFinanceData() {
    if (!supabase) return;
    setLoadingData(true);
    const [accounts, categories, transactions, cards, debts, budgets, profile] = await Promise.all([
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("transactions").select("*").order("due_date", { ascending: false }),
      supabase.from("credit_cards").select("*").order("created_at"),
      supabase.from("debts").select("*").order("created_at"),
      supabase.from("budgets").select("*").order("month", { ascending: false }),
      supabase.from("profiles").select("display_name").eq("id", session!.user.id).maybeSingle(),
    ]);
    const error = [accounts, categories, transactions, cards, debts, budgets, profile].find((result) => result.error)?.error;
    if (error) { showToast("Não foi possível carregar os dados. Confira a migração do Supabase."); setLoadingData(false); return; }
    setData({
      accounts: (accounts.data ?? []).map((item) => ({ id: item.id, name: item.name, institution: item.institution ?? "", type: item.type, initialBalance: Number(item.initial_balance), color: item.color, active: item.active })),
      categories: (categories.data ?? []).map((item) => ({ id: item.id, name: item.name, icon: item.icon, color: item.color, kind: item.kind })),
      transactions: (transactions.data ?? []).map(fromDbTransaction),
      cards: (cards.data ?? []).map((item) => ({ id: item.id, name: item.name, brand: item.brand ?? "", lastDigits: item.last_digits ?? "", limit: Number(item.credit_limit), closingDay: item.closing_day, dueDay: item.due_day, color: item.color })),
      debts: (debts.data ?? []).map((item) => ({ id: item.id, name: item.name, creditor: item.creditor, type: item.type, originalAmount: Number(item.original_amount), outstandingBalance: Number(item.outstanding_balance), monthlyInterest: Number(item.monthly_interest), minimumPayment: Number(item.minimum_payment), dueDay: item.due_day })),
      budgets: (budgets.data ?? []).map((item) => ({ id: item.id, categoryId: item.category_id, month: item.month, limit: Number(item.spending_limit) })),
    });
    setDisplayName(profile.data?.display_name || session?.user.email?.split("@")[0] || "Usuário");
    setAiInstructions(typeof session?.user.user_metadata?.ai_instructions === "string" ? session.user.user_metadata.ai_instructions : "");
    setLoadingData(false);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }

  async function saveTransaction(value: Parameters<typeof createInstallments>[0]) {
    const card = value.cardId ? data.cards.find((item) => item.id === value.cardId) : undefined;
    const recurringRuleId = value.recurrence && value.recurrence !== "none" ? crypto.randomUUID() : undefined;
    const occurrenceCount = value.recurrence === "monthly" ? 12 : value.recurrence === "yearly" ? 3 : 1;
    const items = Array.from({ length: occurrenceCount }, (_, occurrence) => {
      const base = parseISO(value.date);
      const occurrenceDate = format(value.recurrence === "yearly" ? addYears(base, occurrence) : addMonths(base, occurrence), "yyyy-MM-dd");
      return createInstallments({
        ...value,
        date: occurrenceDate,
        card,
        recurringRuleId,
        attachmentPath: occurrence === 0 ? value.attachmentPath : undefined,
        status: occurrence === 0 ? value.status : "pending",
      });
    }).flat();
    const invoiceMutations: { existingId?: string; transaction: Transaction }[] = [];
    let currentTransactions = [...data.transactions];
    if (card) {
      for (const purchase of items) {
        const existing = currentTransactions.find((item) => item.kind === "invoice_payment" && item.cardId === card.id && item.dueDate === purchase.dueDate && item.status !== "cancelled");
        if (existing) {
          const updated = { ...existing, amount: Math.round((existing.amount + purchase.amount) * 100) / 100 };
          currentTransactions = currentTransactions.map((item) => item.id === existing.id ? updated : item);
          invoiceMutations.push({ existingId: existing.id, transaction: updated });
        } else {
          const invoice: Transaction = {
            id: crypto.randomUUID(), description: `Fatura ${card.name}`, amount: purchase.amount, kind: "invoice_payment",
            status: "pending", dueDate: purchase.dueDate, competenceDate: purchase.dueDate, accountId: data.accounts[0]?.id,
            cardId: card.id, source: "manual",
          };
          currentTransactions.unshift(invoice);
          invoiceMutations.push({ transaction: invoice });
        }
      }
    }
    setData((current) => ({ ...current, transactions: [...items, ...currentTransactions] }));
    setAddOpen(false);
    setDraft(null);
    showToast(items.length > 1 ? `${items.length} parcelas criadas com sucesso.` : "Lançamento salvo com sucesso.");
    if (supabase && session && !demo) {
      if (recurringRuleId) {
        const nextRun = items[1]?.competenceDate ?? items[0]?.competenceDate;
        const { error: ruleError } = await supabase.from("recurring_rules").insert({
          id: recurringRuleId, user_id: session.user.id, description: value.description,
          frequency: value.recurrence, starts_on: value.date, next_run_on: nextRun,
          template: { amount: value.amount, category_id: value.categoryId, account_id: value.accountId, card_id: value.cardId },
        });
        if (ruleError) showToast("Não foi possível criar a regra de repetição.");
      }
      const rows = items.map((item) => ({
        id: item.id, user_id: session.user.id, description: item.description, amount: item.amount, kind: item.kind, status: item.status,
        due_date: item.dueDate, competence_date: item.competenceDate, account_id: item.accountId || null, card_id: item.cardId || null,
        category_id: item.categoryId || null, installment_group_id: item.installmentGroupId || null, installment_number: item.installmentNumber || null,
        installment_total: item.installmentTotal || null, recurring_rule_id: item.recurringRuleId || null,
        source: item.source, attachment_path: item.attachmentPath || null,
      }));
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) showToast("O lançamento ficou apenas nesta sessão. Verifique o Supabase.");
      for (const mutation of invoiceMutations) {
        if (mutation.existingId) {
          await supabase.from("transactions").update({ amount: mutation.transaction.amount }).eq("id", mutation.existingId);
        } else {
          const invoice = mutation.transaction;
          await supabase.from("transactions").insert({
            id: invoice.id, user_id: session.user.id, description: invoice.description, amount: invoice.amount, kind: invoice.kind,
            status: invoice.status, due_date: invoice.dueDate, competence_date: invoice.competenceDate,
            account_id: invoice.accountId || null, card_id: invoice.cardId || null, source: invoice.source,
          });
        }
      }
    }
  }

  async function markPaid(id: string) {
    const paidDate = new Date().toISOString().slice(0, 10);
    setData((current) => ({ ...current, transactions: current.transactions.map((item) => item.id === id ? { ...item, status: "paid", paidDate } : item) }));
    showToast("Pagamento confirmado.");
    if (supabase && session && !demo) await supabase.from("transactions").update({ status: "paid", paid_date: paidDate }).eq("id", id);
  }

  function openTransactionEdit(transaction: Transaction, suggestions?: SuggestedChanges | null) {
    const categoryId = suggestions?.category
      ? data.categories.find((item) => item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(suggestions.category!.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()))?.id
      : undefined;
    setEditSuggestions(suggestions ? {
      description: suggestions.description ?? undefined,
      amount: suggestions.amount ?? undefined,
      dueDate: suggestions.date ?? undefined,
      status: suggestions.status ?? undefined,
      categoryId,
      notes: suggestions.notes ?? undefined,
    } : null);
    setEditingTransaction(transaction);
  }

  async function updateTransaction(id: string, values: TransactionEditValues): Promise<string | undefined> {
    const existing = data.transactions.find((item) => item.id === id);
    if (!existing) return "A transação não existe mais.";
    if (!Number.isFinite(values.amount) || values.amount <= 0) return "Informe um valor maior que zero.";
    const updated: Transaction = {
      ...existing,
      description: values.description,
      amount: values.amount,
      dueDate: existing.kind === "card_purchase" ? existing.dueDate : values.dueDate,
      status: values.status,
      paidDate: values.status === "paid" ? existing.paidDate ?? new Date().toISOString().slice(0, 10) : undefined,
      categoryId: values.categoryId,
      accountId: values.accountId,
      notes: values.notes,
    };
    if (supabase && session && !demo) {
      const { error } = await supabase.from("transactions").update({
        description: updated.description,
        amount: updated.amount,
        due_date: updated.dueDate,
        status: updated.status,
        paid_date: updated.paidDate ?? null,
        category_id: updated.categoryId ?? null,
        account_id: updated.accountId ?? null,
        notes: updated.notes ?? null,
      }).eq("id", id);
      if (error) return "Não foi possível editar a transação.";
    }
    let nextTransactions = data.transactions.map((item) => item.id === id ? updated : item);
    if (existing.kind === "card_purchase" && existing.cardId && existing.amount !== updated.amount) {
      const invoice = nextTransactions.find((item) => item.kind === "invoice_payment" && item.cardId === existing.cardId && item.dueDate === existing.dueDate && item.status !== "cancelled");
      if (invoice) {
        const invoiceAmount = Math.max(0, Math.round((invoice.amount - existing.amount + updated.amount) * 100) / 100);
        if (invoiceAmount === 0) {
          nextTransactions = nextTransactions.filter((item) => item.id !== invoice.id);
          if (supabase && session && !demo) await supabase.from("transactions").delete().eq("id", invoice.id);
        } else {
          nextTransactions = nextTransactions.map((item) => item.id === invoice.id ? { ...item, amount: invoiceAmount } : item);
          if (supabase && session && !demo) await supabase.from("transactions").update({ amount: invoiceAmount }).eq("id", invoice.id);
        }
      }
    }
    setData((current) => ({ ...current, transactions: nextTransactions }));
    setEditingTransaction(null);
    setEditSuggestions(null);
    showToast("Transação editada com confirmação.");
    return undefined;
  }

  async function deleteTransaction(id: string, password: string): Promise<string | undefined> {
    const existing = data.transactions.find((item) => item.id === id);
    if (!existing) return "A transação não existe mais.";
    if (!supabase || !session || demo || !session.user.email) return "Entre em sua conta para excluir transações.";
    const { error: passwordError } = await supabase.auth.signInWithPassword({ email: session.user.email, password });
    if (passwordError) return "Senha incorreta. A transação não foi excluída.";
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return "Não foi possível excluir a transação.";

    let nextTransactions = data.transactions.filter((item) => item.id !== id);
    if (existing.kind === "card_purchase" && existing.cardId) {
      const invoice = nextTransactions.find((item) => item.kind === "invoice_payment" && item.cardId === existing.cardId && item.dueDate === existing.dueDate && item.status !== "cancelled");
      if (invoice) {
        const invoiceAmount = Math.max(0, Math.round((invoice.amount - existing.amount) * 100) / 100);
        if (invoiceAmount === 0) {
          nextTransactions = nextTransactions.filter((item) => item.id !== invoice.id);
          await supabase.from("transactions").delete().eq("id", invoice.id);
        } else {
          nextTransactions = nextTransactions.map((item) => item.id === invoice.id ? { ...item, amount: invoiceAmount } : item);
          await supabase.from("transactions").update({ amount: invoiceAmount }).eq("id", invoice.id);
        }
      }
    }
    if (existing.attachmentPath) await supabase.storage.from("receipts").remove([existing.attachmentPath]);
    setData((current) => ({ ...current, transactions: nextTransactions }));
    setDeletingTransaction(null);
    showToast("Transação excluída após validar sua senha.");
    return undefined;
  }

  async function adjustBalance(account: Account, actualBalance: number) {
    const current = accountBalance(data, account.id);
    const difference = Math.round((actualBalance - current) * 100) / 100;
    if (Math.abs(difference) < 0.01) {
      setAdjustingAccount(null);
      showToast("O saldo já estava correto.");
      return;
    }
    await saveTransaction({
      description: `Ajuste de saldo — ${account.name}`,
      amount: Math.abs(difference),
      date: new Date().toISOString().slice(0, 10),
      kind: difference > 0 ? "income" : "expense",
      status: "paid",
      installments: 1,
      accountId: account.id,
      source: "manual",
      recurrence: "none",
    });
    setAdjustingAccount(null);
    showToast(`Saldo de ${account.name} ajustado.`);
  }

  function openDraft(value: TransactionDraft) {
    setDraft(value);
    setAddOpen(true);
  }

  async function saveEntity(kind: EntityKind, payload: EntityPayload) {
    const id = crypto.randomUUID();
    if (kind === "account") {
      const account = {
        id, name: String(payload.name), institution: String(payload.institution), type: String(payload.type || "checking") as "checking" | "cash" | "savings",
        initialBalance: Number(payload.initialBalance || 0), color: "#15976e", active: true,
      };
      setData((current) => ({ ...current, accounts: [...current.accounts, account] }));
      if (supabase && session && !demo) await supabase.from("accounts").insert({ id, user_id: session.user.id, name: account.name, institution: account.institution, type: account.type, initial_balance: account.initialBalance, color: account.color });
    }
    if (kind === "card") {
      const colors = ["#6f5bd5", "#d9782b", "#176a58", "#3e648f"];
      const card = {
        id, name: String(payload.name), brand: String(payload.brand), lastDigits: String(payload.lastDigits), limit: Number(payload.limit),
        closingDay: Number(payload.closingDay || 10), dueDay: Number(payload.dueDay || 17), color: colors[data.cards.length % colors.length],
      };
      setData((current) => ({ ...current, cards: [...current.cards, card] }));
      if (supabase && session && !demo) await supabase.from("credit_cards").insert({ id, user_id: session.user.id, name: card.name, brand: card.brand, last_digits: card.lastDigits, credit_limit: card.limit, closing_day: card.closingDay, due_day: card.dueDay, color: card.color });
    }
    if (kind === "debt") {
      const debt = {
        id, name: String(payload.name), creditor: String(payload.creditor), type: String(payload.type || "loan") as "person" | "loan" | "installment",
        originalAmount: Number(payload.amount), outstandingBalance: Number(payload.amount), monthlyInterest: Number(payload.interest || 0),
        minimumPayment: Number(payload.minimumPayment || 0), dueDay: Number(payload.dueDay || 10),
      };
      setData((current) => ({ ...current, debts: [...current.debts, debt] }));
      if (supabase && session && !demo) await supabase.from("debts").insert({ id, user_id: session.user.id, name: debt.name, creditor: debt.creditor, type: debt.type, original_amount: debt.originalAmount, outstanding_balance: debt.outstandingBalance, monthly_interest: debt.monthlyInterest, minimum_payment: debt.minimumPayment, due_day: debt.dueDay });
    }
    setEntityModal(null);
    showToast(`${kind === "account" ? "Conta" : kind === "card" ? "Cartão" : "Dívida"} adicionada com sucesso.`);
  }

  async function saveProfile(name: string, instructions: string) {
    if (!supabase || !session || demo) return;
    const { error } = await supabase.from("profiles").upsert({ id: session.user.id, display_name: name });
    if (error) { showToast("Não foi possível salvar o perfil."); return; }
    const { error: authError } = await supabase.auth.updateUser({ data: { ai_instructions: instructions.slice(0, 2000) } });
    if (authError) { showToast("Perfil salvo, mas as instruções da IA não foram atualizadas."); return; }
    setDisplayName(name);
    setAiInstructions(instructions.slice(0, 2000));
    showToast("Perfil atualizado.");
  }

  async function addCategory(value: { name: string; kind: "income" | "expense"; color: string }) {
    const id = crypto.randomUUID();
    const category = { id, name: value.name, kind: value.kind, color: value.color, icon: value.kind === "income" ? "CircleDollarSign" : "Shapes" };
    setData((current) => ({ ...current, categories: [...current.categories, category] }));
    if (supabase && session && !demo) {
      const { error } = await supabase.from("categories").insert({ id, user_id: session.user.id, ...value, icon: category.icon });
      if (error) { setData((current) => ({ ...current, categories: current.categories.filter((item) => item.id !== id) })); showToast(error.code === "23505" ? "Já existe uma categoria com esse nome." : "Não foi possível adicionar a categoria."); return; }
    }
    showToast("Categoria adicionada.");
  }

  async function deleteCategory(id: string) {
    const category = data.categories.find((item) => item.id === id);
    if (!category) return;
    setData((current) => ({
      ...current,
      categories: current.categories.filter((item) => item.id !== id),
      transactions: current.transactions.map((item) => item.categoryId === id ? { ...item, categoryId: undefined } : item),
      budgets: current.budgets.filter((item) => item.categoryId !== id),
    }));
    if (supabase && session && !demo) {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) { await loadFinanceData(); showToast("Não foi possível excluir a categoria."); return; }
    }
    showToast(`Categoria “${category.name}” excluída.`);
  }

  async function saveBudgets(month: string, values: { categoryId: string; limit: number }[]) {
    const next = values.map((value) => {
      const existing = data.budgets.find((item) => item.categoryId === value.categoryId && item.month === month);
      return { id: existing?.id ?? crypto.randomUUID(), categoryId: value.categoryId, month, limit: value.limit };
    });
    setData((current) => ({ ...current, budgets: [...current.budgets.filter((item) => item.month !== month), ...next] }));
    if (supabase && session && !demo) {
      const rows = next.map((item) => ({ id: item.id, user_id: session.user.id, category_id: item.categoryId, month: item.month, spending_limit: item.limit }));
      const retainedIds = new Set(next.map((item) => item.id));
      const removedIds = data.budgets.filter((item) => item.month === month && !retainedIds.has(item.id)).map((item) => item.id);
      const removed = removedIds.length ? await supabase.from("budgets").delete().in("id", removedIds) : { error: null };
      const saved = rows.length ? await supabase.from("budgets").upsert(rows, { onConflict: "user_id,category_id,month" }) : { error: null };
      if (removed.error || saved.error) { await loadFinanceData(); showToast("Não foi possível salvar os limites."); return; }
    }
    showToast("Limites mensais atualizados.");
  }

  async function signOut() {
    if (supabase && session) await supabase.auth.signOut();
    if (isSupabaseConfigured) {
      setDemo(false);
      setSession(null);
      setPage("dashboard");
    } else {
      showToast("Configure o Supabase para usar uma conta.");
    }
  }

  if (!authReady) return <div className="app-loading"><span className="brand-mark"><WalletCards /></span><strong>Weber Financeiro</strong><small>Preparando seus dados...</small></div>;
  if (isSupabaseConfigured && !session && !demo) return <AuthScreen onDemo={() => setDemo(true)} />;

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
      <div className="sidebar-brand"><div className="brand"><span className="brand-mark"><WalletCards size={21} /></span><span>Weber <strong>Financeiro</strong></span></div><button className="icon-btn mobile-only" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
      <nav>{nav.map((item) => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => { setPage(item.id); setMenuOpen(false); }}><item.icon size={19} /><span>{item.label}</span>{item.id === "debts" && <i>{data.debts.length}</i>}</button>)}</nav>
      <div className="sidebar-bottom"><button className={page === "settings" ? "active" : ""} onClick={() => { setPage("settings"); setMenuOpen(false); }}><Settings size={19} /><span>Configurações</span></button><div className="sidebar-help"><Bot size={22} /><strong>Precisa de ajuda?</strong><span>Converse com a Weber IA</span><button onClick={() => setChatOpen(true)}>Abrir assistente</button></div><div className="sidebar-user"><span>{displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><div><strong>{displayName}</strong><small>{demo ? "Modo demonstração" : session?.user.email}</small></div><ChevronDown size={16} /></div></div>
    </aside>
    {menuOpen && <button className="menu-overlay" onClick={() => setMenuOpen(false)} />}

    <main className="main-area">
      <header className="topbar">
        <button className="icon-btn mobile-only" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
        <label className="month-picker"><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label>
        <div className="topbar-actions"><button className="search-trigger" onClick={() => setPage("transactions")}><Search size={18} /><span>Buscar transação...</span><kbd>Ctrl K</kbd></button>{demo && <span className="demo-badge">Demonstração</span>}<button className="icon-btn notification" title="Ver pendências" onClick={() => setPage("transactions")}><Bell size={19} /><i /></button><button className="ai-button" onClick={() => setChatOpen(true)}><SparkIcon /><span>Weber IA</span></button></div>
      </header>
      <div className={`page-content ${loadingData ? "loading" : ""}`}>
        {page === "dashboard" && <Dashboard data={data} month={new Date(`${selectedMonth}-01T12:00:00`)} userName={displayName} onAdd={() => { setDraft(null); setAddOpen(true); }} onNavigate={(value) => setPage(value as Page)} />}
        {page === "transactions" && <TransactionsPage data={data} month={selectedMonth} onAdd={() => { setDraft(null); setAddOpen(true); }} onMarkPaid={markPaid} onEdit={(item) => openTransactionEdit(item)} onDelete={setDeletingTransaction} />}
        {page === "accounts" && <AccountsPage data={data} onAdd={() => setEntityModal("account")} onAdjust={setAdjustingAccount} />}
        {page === "cards" && <CardsPage data={data} month={selectedMonth} onAdd={() => setEntityModal("card")} />}
        {page === "debts" && <DebtsPage data={data} onAdd={() => setEntityModal("debt")} />}
        {page === "reports" && <Suspense fallback={<div className="route-loading">Preparando relatórios...</div>}><ReportsPage data={data} month={new Date(`${selectedMonth}-01T12:00:00`)} /></Suspense>}
        {page === "settings" && <SettingsPage data={data} displayName={displayName} aiInstructions={aiInstructions} email={session?.user.email} demo={demo} month={selectedMonth} onSaveProfile={saveProfile} onAddCategory={addCategory} onDeleteCategory={deleteCategory} onSaveBudgets={saveBudgets} onSignOut={signOut} />}
      </div>
    </main>

    <nav className="mobile-nav">{nav.slice(0, 4).map((item) => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}><item.icon size={20} /><span>{item.label}</span></button>)}<button className="mobile-add" onClick={() => { setDraft(null); setAddOpen(true); }}>+</button></nav>
    <ChatPanel key={session?.user.id ?? "demo"} cacheKey={`weber-financeiro:chat:${session?.user.id ?? "demo"}`} open={chatOpen} onClose={() => setChatOpen(false)} data={data} onDraft={openDraft} onEditTransaction={openTransactionEdit} onDeleteTransaction={setDeletingTransaction} />
    {chatOpen && <button className="chat-overlay" onClick={() => setChatOpen(false)} />}
    <QuickAddModal key={`${draft?.description ?? "manual"}-${addOpen}`} open={addOpen} accounts={data.accounts} categories={data.categories} cards={data.cards} draft={draft} onClose={() => { setAddOpen(false); setDraft(null); }} onSave={saveTransaction} />
    <EntityModal key={entityModal ?? "closed"} kind={entityModal} onClose={() => setEntityModal(null)} onSave={saveEntity} />
    <TransactionEditModal key={`edit-${editingTransaction?.id ?? "closed"}-${editSuggestions ? "suggested" : "manual"}`} transaction={editingTransaction} data={data} suggestions={editSuggestions} onClose={() => { setEditingTransaction(null); setEditSuggestions(null); }} onSave={updateTransaction} />
    <TransactionDeleteModal key={`delete-${deletingTransaction?.id ?? "closed"}`} transaction={deletingTransaction} email={session?.user.email} demo={demo} onClose={() => setDeletingTransaction(null)} onConfirm={deleteTransaction} />
    <BalanceAdjustmentModal key={`balance-${adjustingAccount?.id ?? "closed"}`} account={adjustingAccount} data={data} onClose={() => setAdjustingAccount(null)} onSave={adjustBalance} />
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function fromDbTransaction(item: Record<string, any>): Transaction {
  return {
    id: item.id, description: item.description, amount: Number(item.amount), kind: item.kind, status: item.status,
    dueDate: item.due_date, paidDate: item.paid_date ?? undefined, competenceDate: item.competence_date,
    categoryId: item.category_id ?? undefined, accountId: item.account_id ?? undefined, destinationAccountId: item.destination_account_id ?? undefined, cardId: item.card_id ?? undefined,
    debtId: item.debt_id ?? undefined, installmentGroupId: item.installment_group_id ?? undefined,
    installmentNumber: item.installment_number ?? undefined, installmentTotal: item.installment_total ?? undefined,
    recurringRuleId: item.recurring_rule_id ?? undefined, notes: item.notes ?? undefined, attachmentPath: item.attachment_path ?? undefined, source: item.source,
  };
}

function SparkIcon() {
  return <Bot size={18} />;
}
