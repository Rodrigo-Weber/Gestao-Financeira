import { useState } from "react";
import { AlertTriangle, Check, LoaderCircle, LockKeyhole, Trash2, X } from "lucide-react";
import type { FinanceData, Transaction, TransactionStatus } from "../types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export interface TransactionEditValues {
  description: string;
  amount: number;
  dueDate: string;
  status: TransactionStatus;
  categoryId?: string;
  accountId?: string;
  notes?: string;
}

export function TransactionEditModal({
  transaction,
  data,
  suggestions,
  onClose,
  onSave,
}: {
  transaction: Transaction | null;
  data: FinanceData;
  suggestions?: Partial<TransactionEditValues> | null;
  onClose: () => void;
  onSave: (id: string, values: TransactionEditValues) => Promise<string | undefined>;
}) {
  const [description, setDescription] = useState(suggestions?.description ?? transaction?.description ?? "");
  const [amount, setAmount] = useState(String(suggestions?.amount ?? transaction?.amount ?? ""));
  const [dueDate, setDueDate] = useState(suggestions?.dueDate ?? transaction?.dueDate ?? "");
  const [status, setStatus] = useState<TransactionStatus>(suggestions?.status ?? transaction?.status ?? "pending");
  const [categoryId, setCategoryId] = useState(suggestions?.categoryId ?? transaction?.categoryId ?? "");
  const [accountId, setAccountId] = useState(suggestions?.accountId ?? transaction?.accountId ?? "");
  const [notes, setNotes] = useState(suggestions?.notes ?? transaction?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!transaction) return null;

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="modal-card" onSubmit={async (event) => {
      event.preventDefault();
      setSaving(true);
      setError("");
      const message = await onSave(transaction.id, {
        description: description.trim(),
        amount: Math.abs(Number(amount.replace(",", "."))),
        dueDate,
        status,
        categoryId: categoryId || undefined,
        accountId: accountId || undefined,
        notes: notes.trim() || undefined,
      });
      if (message) setError(message);
      setSaving(false);
    }}>
      <div className="modal-header"><div><span className="eyebrow">Confirmação obrigatória</span><h2>Editar transação</h2></div><button type="button" className="icon-btn" onClick={onClose}><X size={20} /></button></div>
      <div className="safe-action-note"><Check size={16} /> A IA apenas sugeriu. Nada será alterado até você confirmar.</div>
      <label>Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} required autoFocus /></label>
      <div className="form-grid">
        <label>Valor<div className="money-input"><span>R$</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div></label>
        <label>Vencimento<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required disabled={transaction.kind === "card_purchase"} />{transaction.kind === "card_purchase" && <small>Definido automaticamente pela fatura.</small>}</label>
      </div>
      <div className="form-grid">
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as TransactionStatus)}><option value="paid">Pago</option><option value="pending">Pendente</option><option value="overdue">Atrasado</option><option value="cancelled">Cancelado</option></select></label>
        <label>Categoria<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Sem categoria</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      <label>Conta<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Sem conta</option>{data.accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Observações<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" /></label>
      {error && <div className="form-error"><AlertTriangle size={16} />{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={saving || !description.trim() || !Number(amount)}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Confirmar edição</button></div>
    </form>
  </div>;
}

export function TransactionDeleteModal({
  transaction,
  email,
  demo,
  onClose,
  onConfirm,
}: {
  transaction: Transaction | null;
  email?: string;
  demo: boolean;
  onClose: () => void;
  onConfirm: (id: string, password: string) => Promise<string | undefined>;
}) {
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  if (!transaction) return null;

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="modal-card danger-modal" onSubmit={async (event) => {
      event.preventDefault();
      setDeleting(true);
      setError("");
      const message = await onConfirm(transaction.id, password);
      if (message) setError(message);
      setDeleting(false);
    }}>
      <div className="modal-header"><div><span className="eyebrow danger-text">Ação irreversível</span><h2>Excluir transação</h2></div><button type="button" className="icon-btn" onClick={onClose}><X size={20} /></button></div>
      <div className="delete-summary"><span className="round-icon coral"><Trash2 size={19} /></span><div><strong>{transaction.description}</strong><small>{new Date(`${transaction.dueDate}T12:00:00`).toLocaleDateString("pt-BR")} • {brl.format(transaction.amount)}</small></div></div>
      <div className="danger-warning"><AlertTriangle size={18} /><span>Esta ação removerá definitivamente o lançamento. Compras no cartão também ajustarão a fatura correspondente.</span></div>
      {demo ? <div className="form-error"><LockKeyhole size={16} />Entre em uma conta para excluir dados.</div> : <>
        <label>Confirme com a senha de {email}<div className="input-icon"><LockKeyhole size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" required autoFocus autoComplete="current-password" /></div></label>
        {error && <div className="form-error"><AlertTriangle size={16} />{error}</div>}
      </>}
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="danger-btn" disabled={demo || deleting || !password}>{deleting ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />} Excluir definitivamente</button></div>
    </form>
  </div>;
}
