import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronUp, CreditCard, QrCode, Repeat2, WalletCards, X } from "lucide-react";
import { format } from "date-fns";
import { suggestCategory } from "../lib/categorySuggestion";
import { getInvoiceDates } from "../lib/finance";
import type { Account, Category, CreditCard as CardType, PaymentMethod, Transaction, TransactionDraft } from "../types";

interface Props {
  open: boolean;
  accounts: Account[];
  categories: Category[];
  cards: CardType[];
  transactions: Transaction[];
  draft?: TransactionDraft | null;
  onClose: () => void;
  onSave: (value: {
    description: string;
    amount: number;
    date: string;
    kind: "income" | "expense";
    status: "paid" | "pending";
    installments: number;
    categoryId?: string;
    accountId?: string;
    cardId?: string;
    paymentMethod?: PaymentMethod;
    source: "manual" | "chat" | "audio" | "ocr";
    attachmentPath?: string;
    recurrence?: "none" | "monthly" | "yearly";
  }) => void;
}

const paymentLabels: Record<PaymentMethod, string> = { pix: "PIX", debit: "Débito", credit: "Crédito" };

export function QuickAddModal({ open, accounts, categories, cards, transactions, draft, onClose, onSave }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");
  const initialKind = draft?.kind ?? "expense";
  const initialCategory = useMemo(() => draft?.category
    ? categories.find((item) => item.name.toLowerCase().includes(draft.category!.toLowerCase()))?.id
    : undefined, [draft, categories]);
  const draftPayment = draft?.paymentMethod ?? ((draft?.installments ?? 1) > 1 ? "credit" : "pix");
  const initialPayment = draftPayment === "credit" && !cards.length ? "pix" : draftPayment;
  const [kind, setKind] = useState<"income" | "expense">(initialKind);
  const [status, setStatus] = useState<"paid" | "pending">("paid");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [amount, setAmount] = useState(draft?.amount?.toString() ?? "");
  const [date, setDate] = useState(draft?.date ?? today);
  const [categoryId, setCategoryId] = useState(initialCategory ?? "");
  const [categoryTouched, setCategoryTouched] = useState(Boolean(initialCategory));
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [cardId, setCardId] = useState(initialPayment === "credit" ? cards[0]?.id ?? "" : "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialPayment);
  const [installments, setInstallments] = useState(draft?.installments ?? 1);
  const [recurrence, setRecurrence] = useState<"none" | "monthly" | "yearly">("none");
  const [detailsOpen, setDetailsOpen] = useState(Boolean(draft));

  const categorySuggestion = useMemo(
    () => suggestCategory(description, kind, categories, transactions),
    [description, kind, categories, transactions],
  );
  const fallbackCategory = categories.find((item) => item.kind === kind && item.name.toLowerCase() === "outros")?.id;
  const effectiveCategoryId = categoryTouched ? categoryId : categorySuggestion?.id ?? fallbackCategory ?? "";
  const selectedCategory = categories.find((item) => item.id === effectiveCategoryId)?.name ?? "Sem categoria";
  const selectedCard = cards.find((item) => item.id === cardId);
  const selectedAccount = accounts.find((item) => item.id === accountId);
  const invoiceDue = selectedCard ? getInvoiceDates(date, selectedCard).dueDate : undefined;

  if (!open) return null;
  const source = draft ? (draft.notes?.includes("comprovante") ? "ocr" : "chat") : "manual";

  function changeKind(value: "income" | "expense") {
    setKind(value);
    setCategoryId("");
    setCategoryTouched(false);
    if (value === "income") {
      setCardId("");
      setPaymentMethod("pix");
      setAccountId((current) => current || accounts[0]?.id || "");
      setInstallments(1);
    }
  }

  function changePaymentMethod(value: PaymentMethod) {
    setPaymentMethod(value);
    if (value === "credit") {
      setCardId((current) => current || cards[0]?.id || "");
      setAccountId("");
      return;
    }
    setCardId("");
    setAccountId((current) => current || accounts[0]?.id || "");
    setInstallments(1);
  }

  const summary = kind === "income"
    ? `${status === "paid" ? "Recebido" : "Pendente"} • ${selectedAccount?.name ?? "Sem conta"} • ${selectedCategory}`
    : paymentMethod === "credit"
      ? `Crédito • ${selectedCard?.name ?? "Cadastre um cartão"}${invoiceDue ? ` • fatura em ${new Date(`${invoiceDue}T12:00:00`).toLocaleDateString("pt-BR")}` : ""} • ${selectedCategory}`
      : `${status === "paid" ? "Pago" : "Pendente"} • ${paymentLabels[paymentMethod]} • ${selectedAccount?.name ?? "Sem conta"} • ${selectedCategory}`;

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="modal-card quick-modal" onSubmit={(event) => {
      event.preventDefault();
      onSave({
        description: description.trim(),
        amount: Math.abs(Number(amount.replace(",", "."))),
        date,
        kind,
        status,
        installments: kind === "expense" && paymentMethod === "credit" ? installments : 1,
        categoryId: effectiveCategoryId || undefined,
        accountId: kind === "expense" && paymentMethod === "credit" ? undefined : accountId || undefined,
        cardId: kind === "expense" && paymentMethod === "credit" ? cardId || undefined : undefined,
        paymentMethod: kind === "expense" ? paymentMethod : undefined,
        source,
        attachmentPath: draft?.attachmentPath,
        recurrence,
      });
    }}>
      <div className="modal-header"><div><span className="eyebrow">{draft ? "Revise antes de salvar" : "Leva menos de 10 segundos"}</span><h2>{draft ? "A IA entendeu assim" : "Lançamento rápido"}</h2></div><button type="button" className="icon-btn" onClick={onClose}><X size={20} /></button></div>
      <div className="kind-toggle"><button type="button" className={kind === "expense" ? "active expense" : ""} onClick={() => changeKind("expense")}>− Despesa</button><button type="button" className={kind === "income" ? "active income" : ""} onClick={() => changeKind("income")}>+ Receita</button></div>
      {draft?.confidence && <div className="confidence"><Check size={16} /> Extração com {Math.round(draft.confidence * 100)}% de confiança — confirme os campos.</div>}
      <label>O que foi?<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={kind === "income" ? "Ex.: Pagamento recebido" : "Ex.: Mercado ou gasolina"} required autoFocus /></label>
      {!categoryTouched && description.trim().length > 1 && <div className="category-suggestion"><span>Categoria inteligente</span><strong>{selectedCategory}</strong><small>{categorySuggestion ? "Baseada no título e no seu histórico" : "Usada como categoria geral"}</small></div>}
      <label>Quanto?<div className="money-input quick-money"><span>R$</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required /></div></label>
      {kind === "expense" && <fieldset className="payment-method">
        <legend>Como pagou?</legend>
        <button type="button" className={paymentMethod === "pix" ? "active" : ""} onClick={() => changePaymentMethod("pix")}><QrCode size={17} /><span>PIX</span></button>
        <button type="button" className={paymentMethod === "debit" ? "active" : ""} onClick={() => changePaymentMethod("debit")}><WalletCards size={17} /><span>Débito</span></button>
        <button type="button" className={paymentMethod === "credit" ? "active" : ""} onClick={() => changePaymentMethod("credit")} disabled={!cards.length} title={cards.length ? "Lançar na fatura" : "Cadastre um cartão primeiro"}><CreditCard size={17} /><span>Crédito</span></button>
      </fieldset>}
      {!detailsOpen && <div className="quick-defaults"><Check size={15} /><span>{summary}</span></div>}
      <button type="button" className="details-toggle" onClick={() => setDetailsOpen((value) => !value)}>{detailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {detailsOpen ? "Ocultar opções" : "Mais opções"}</button>
      {detailsOpen && <div className="quick-details">
        <div className="form-grid">
          <label>Situação<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} disabled={paymentMethod === "credit" && kind === "expense"}><option value="paid">{kind === "income" ? "Já recebi" : paymentMethod === "credit" ? "Vai para a fatura" : "Já paguei"}</option><option value="pending">{kind === "income" ? "Ainda vou receber" : "Ainda vou pagar"}</option></select></label>
          <label>{kind === "expense" && paymentMethod === "credit" ? "Data da compra" : "Data"}<div className="input-icon"><CalendarDays size={18} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div></label>
        </div>
        <label>Categoria<select value={effectiveCategoryId} onChange={(event) => { setCategoryId(event.target.value); setCategoryTouched(true); }}><option value="">Sem categoria</option>{categories.filter((item) => item.kind === kind).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        {kind === "expense" && paymentMethod === "credit"
          ? <label>Cartão<select value={cardId} onChange={(event) => setCardId(event.target.value)} required>{cards.map((item) => <option key={item.id} value={item.id}>{item.name} • {item.lastDigits} • paga dia {item.dueDay}</option>)}</select></label>
          : <label>{kind === "income" ? "Conta de recebimento" : "Conta usada"}<select value={accountId} onChange={(event) => setAccountId(event.target.value)} required>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <div className="form-grid">
          <label>Repetição<select value={recurrence} onChange={(event) => { const value = event.target.value as typeof recurrence; setRecurrence(value); if (value !== "none") setInstallments(1); }}><option value="none">Não repetir</option><option value="monthly">Todo mês</option><option value="yearly">Todo ano</option></select></label>
          {kind === "expense" && paymentMethod === "credit" && <label>Parcelas<div className="input-icon"><Repeat2 size={18} /><select value={installments} onChange={(event) => setInstallments(Number(event.target.value))}>{Array.from({ length: 24 }, (_, index) => index + 1).map((value) => <option value={value} key={value}>{value === 1 ? "À vista" : `${value}x`}</option>)}</select></div></label>}
        </div>
        {paymentMethod === "credit" && selectedCard && invoiceDue && <div className="installment-preview"><CreditCard size={17} /> {installments > 1 ? `${installments} parcelas de aproximadamente ${(Number(amount.replace(",", ".")) / installments || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. A 1ª` : "Esta compra"} será paga em {new Date(`${invoiceDue}T12:00:00`).toLocaleDateString("pt-BR")}; as demais avançam mês a mês.</div>}
      </div>}
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" type="submit" disabled={!description.trim() || !Number(amount.replace(",", ".")) || (kind === "expense" && paymentMethod === "credit" && !cardId)}><Check size={18} /> Salvar agora</button></div>
    </form>
  </div>;
}
