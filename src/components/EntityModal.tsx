import { Check, X } from "lucide-react";
import { useState } from "react";

export type EntityKind = "account" | "card" | "debt";
export type EntityPayload = Record<string, string | number>;

const titles: Record<EntityKind, { eyebrow: string; title: string }> = {
  account: { eyebrow: "Novo saldo", title: "Adicionar conta" },
  card: { eyebrow: "Novo limite", title: "Adicionar cartão" },
  debt: { eyebrow: "Novo compromisso", title: "Adicionar dívida" },
};

export function EntityModal({ kind, onClose, onSave }: { kind: EntityKind | null; onClose: () => void; onSave: (kind: EntityKind, data: EntityPayload) => void }) {
  const [form, setForm] = useState<EntityPayload>({});
  if (!kind) return null;
  const field = (name: string, fallback: string | number = "") => String(form[name] ?? fallback);
  const update = (name: string, value: string | number) => setForm((current) => ({ ...current, [name]: value }));

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="modal-card entity-modal" onSubmit={(event) => { event.preventDefault(); onSave(kind, form); }}>
      <div className="modal-header"><div><span className="eyebrow">{titles[kind].eyebrow}</span><h2>{titles[kind].title}</h2></div><button type="button" className="icon-btn" onClick={onClose}><X size={20} /></button></div>
      {kind === "account" && <>
        <label>Nome da conta<input value={field("name")} onChange={(e) => update("name", e.target.value)} placeholder="Ex.: Conta principal" required autoFocus /></label>
        <div className="form-grid"><label>Instituição<input value={field("institution")} onChange={(e) => update("institution", e.target.value)} placeholder="Ex.: Nubank" required /></label><label>Tipo<select value={field("type", "checking")} onChange={(e) => update("type", e.target.value)}><option value="checking">Conta corrente</option><option value="savings">Poupança</option><option value="cash">Dinheiro</option></select></label></div>
        <label>Saldo inicial<div className="money-input"><span>R$</span><input type="number" min="0" step=".01" value={field("initialBalance")} onChange={(e) => update("initialBalance", Number(e.target.value))} required /></div></label>
      </>}
      {kind === "card" && <>
        <label>Nome do cartão<input value={field("name")} onChange={(e) => update("name", e.target.value)} placeholder="Ex.: Nubank Ultravioleta" required autoFocus /></label>
        <div className="form-grid"><label>Bandeira<input value={field("brand")} onChange={(e) => update("brand", e.target.value)} placeholder="Mastercard" required /></label><label>Últimos 4 dígitos<input value={field("lastDigits")} onChange={(e) => update("lastDigits", e.target.value.replace(/\D/g, "").slice(0, 4))} pattern="[0-9]{4}" inputMode="numeric" required /></label></div>
        <label>Limite<div className="money-input"><span>R$</span><input type="number" min="0" step=".01" value={field("limit")} onChange={(e) => update("limit", Number(e.target.value))} required /></div></label>
        <div className="form-grid"><label>Dia do fechamento<input type="number" min="1" max="31" value={field("closingDay", 10)} onChange={(e) => update("closingDay", Number(e.target.value))} required /></label><label>Dia do pagamento da fatura<input type="number" min="1" max="31" value={field("dueDay", 17)} onChange={(e) => update("dueDay", Number(e.target.value))} required /></label></div>
        <div className="safe-action-note">Compras e parcelas usarão automaticamente esse dia, respeitando o fechamento da fatura.</div>
      </>}
      {kind === "debt" && <>
        <label>Nome da dívida<input value={field("name")} onChange={(e) => update("name", e.target.value)} placeholder="Ex.: Empréstimo pessoal" required autoFocus /></label>
        <div className="form-grid"><label>Credor<input value={field("creditor")} onChange={(e) => update("creditor", e.target.value)} placeholder="Banco ou pessoa" required /></label><label>Tipo<select value={field("type", "loan")} onChange={(e) => update("type", e.target.value)}><option value="loan">Empréstimo</option><option value="person">Pessoa</option><option value="installment">Conta parcelada</option></select></label></div>
        <div className="form-grid"><label>Saldo devido<div className="money-input"><span>R$</span><input type="number" min="0" step=".01" value={field("amount")} onChange={(e) => update("amount", Number(e.target.value))} required /></div></label><label>Parcela mínima<div className="money-input"><span>R$</span><input type="number" min="0" step=".01" value={field("minimumPayment")} onChange={(e) => update("minimumPayment", Number(e.target.value))} required /></div></label></div>
        <div className="form-grid"><label>Juros ao mês (%)<input type="number" min="0" step=".01" value={field("interest", 0)} onChange={(e) => update("interest", Number(e.target.value))} required /></label><label>Dia do vencimento<input type="number" min="1" max="31" value={field("dueDay", 10)} onChange={(e) => update("dueDay", Number(e.target.value))} required /></label></div>
      </>}
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" type="submit"><Check size={18} /> Salvar</button></div>
    </form>
  </div>;
}
