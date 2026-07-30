import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronUp, CreditCard, Repeat2, X } from "lucide-react";
import type { Account, Category, CreditCard as CardType, TransactionDraft } from "../types";

interface Props {
  open: boolean;
  accounts: Account[];
  categories: Category[];
  cards: CardType[];
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
    source: "manual" | "chat" | "audio" | "ocr";
    attachmentPath?: string;
    recurrence?: "none" | "monthly" | "yearly";
  }) => void;
}

export function QuickAddModal({ open, accounts, categories, cards, draft, onClose, onSave }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const initialKind = draft?.kind ?? "expense";
  const initialCategory = useMemo(() => draft?.category ? categories.find((item) => item.name.toLowerCase().includes(draft.category!.toLowerCase()))?.id : undefined, [draft, categories]);
  const [kind, setKind] = useState<"income" | "expense">(initialKind);
  const [status, setStatus] = useState<"paid" | "pending">("paid");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [amount, setAmount] = useState(draft?.amount?.toString() ?? "");
  const [date, setDate] = useState(draft?.date ?? today);
  const [categoryId, setCategoryId] = useState(initialCategory ?? categories.find((item) => item.kind === initialKind)?.id ?? "");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [cardId, setCardId] = useState("");
  const [installments, setInstallments] = useState(draft?.installments ?? 1);
  const [recurrence, setRecurrence] = useState<"none" | "monthly" | "yearly">("none");
  const [detailsOpen, setDetailsOpen] = useState(Boolean(draft));

  if (!open) return null;
  const source = draft ? (draft.notes?.includes("comprovante") ? "ocr" : "chat") : "manual";
  const selectedCategory = categories.find((item) => item.id === categoryId)?.name ?? "Sem categoria";
  const selectedPayment = cardId ? cards.find((item) => item.id === cardId)?.name : accounts.find((item) => item.id === accountId)?.name;

  function changeKind(value: "income" | "expense") {
    setKind(value);
    setCategoryId(categories.find((item) => item.kind === value)?.id ?? "");
    if (value === "income") {
      setCardId("");
      setInstallments(1);
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="modal-card quick-modal" onSubmit={(event) => {
      event.preventDefault();
      onSave({
        description: description.trim(),
        amount: Math.abs(Number(amount.replace(",", "."))),
        date,
        kind,
        status,
        installments: kind === "income" ? 1 : installments,
        categoryId: categoryId || undefined,
        accountId: cardId ? undefined : accountId || undefined,
        cardId: kind === "expense" ? cardId || undefined : undefined,
        source,
        attachmentPath: draft?.attachmentPath,
        recurrence,
      });
    }}>
      <div className="modal-header"><div><span className="eyebrow">{draft ? "Revise antes de salvar" : "Leva menos de 10 segundos"}</span><h2>{draft ? "A IA entendeu assim" : "Lançamento rápido"}</h2></div><button type="button" className="icon-btn" onClick={onClose}><X size={20} /></button></div>
      <div className="kind-toggle"><button type="button" className={kind === "expense" ? "active expense" : ""} onClick={() => changeKind("expense")}>− Despesa</button><button type="button" className={kind === "income" ? "active income" : ""} onClick={() => changeKind("income")}>+ Receita</button></div>
      {draft?.confidence && <div className="confidence"><Check size={16} /> Extração com {Math.round(draft.confidence * 100)}% de confiança — confirme os campos.</div>}
      <label>O que foi?<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={kind === "income" ? "Ex.: Pagamento recebido" : "Ex.: Mercado ou gasolina"} required autoFocus /></label>
      <label>Quanto?<div className="money-input quick-money"><span>R$</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required /></div></label>
      {!detailsOpen && <div className="quick-defaults"><Check size={15} /><span>{status === "paid" ? (kind === "income" ? "Recebido" : "Pago") : "Pendente"} hoje • {selectedPayment || "Sem conta"} • {selectedCategory}</span></div>}
      <button type="button" className="details-toggle" onClick={() => setDetailsOpen((value) => !value)}>{detailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {detailsOpen ? "Ocultar opções" : "Mais opções"}</button>
      {detailsOpen && <div className="quick-details">
        <div className="form-grid">
          <label>Situação<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="paid">{kind === "income" ? "Já recebi" : "Já paguei"}</option><option value="pending">{kind === "income" ? "Ainda vou receber" : "Ainda vou pagar"}</option></select></label>
          <label>Data<div className="input-icon"><CalendarDays size={18} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div></label>
        </div>
        <label>Categoria<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Sem categoria</option>{categories.filter((item) => item.kind === kind).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label>Conta ou cartão<select value={cardId ? `card:${cardId}` : `account:${accountId}`} onChange={(event) => { const [type, id] = event.target.value.split(":"); if (type === "card") { setCardId(id); setAccountId(""); } else { setAccountId(id); setCardId(""); } }}>
          <optgroup label="Contas">{accounts.map((item) => <option key={item.id} value={`account:${item.id}`}>{item.name}</option>)}</optgroup>
          {kind === "expense" && <optgroup label="Cartões">{cards.map((item) => <option key={item.id} value={`card:${item.id}`}>{item.name} • {item.lastDigits}</option>)}</optgroup>}
        </select></label>
        <div className="form-grid">
          <label>Repetição<select value={recurrence} onChange={(event) => { const value = event.target.value as typeof recurrence; setRecurrence(value); if (value !== "none") setInstallments(1); }}><option value="none">Não repetir</option><option value="monthly">Todo mês</option><option value="yearly">Todo ano</option></select></label>
          {kind === "expense" && <label>Parcelas<div className="input-icon"><Repeat2 size={18} /><select value={installments} onChange={(event) => setInstallments(Number(event.target.value))}>{Array.from({ length: 24 }, (_, index) => index + 1).map((value) => <option value={value} key={value}>{value === 1 ? "À vista" : `${value}x`}</option>)}</select></div></label>}
        </div>
        {cardId && installments > 1 && Number(amount) > 0 && <div className="installment-preview"><CreditCard size={17} /> {installments} parcelas de aproximadamente {(Number(amount) / installments).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>}
      </div>}
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" type="submit" disabled={!description.trim() || !Number(amount)}><Check size={18} /> Salvar agora</button></div>
    </form>
  </div>;
}
