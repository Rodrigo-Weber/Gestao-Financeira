import { useMemo, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import type { Account, FinanceData } from "../types";
import { accountBalance } from "../lib/finance";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function BalanceAdjustmentModal({ account, data, onClose, onSave }: { account: Account | null; data: FinanceData; onClose: () => void; onSave: (account: Account, actualBalance: number) => Promise<void> }) {
  const current = useMemo(() => account ? accountBalance(data, account.id) : 0, [account, data]);
  const [value, setValue] = useState(account ? String(current.toFixed(2)) : "");
  const [saving, setSaving] = useState(false);
  if (!account) return null;
  const actual = Number(value.replace(",", "."));
  const difference = Number.isFinite(actual) ? actual - current : 0;

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="modal-card balance-adjust-modal" onSubmit={async (event) => {
      event.preventDefault();
      if (!Number.isFinite(actual)) return;
      setSaving(true);
      await onSave(account, actual);
      setSaving(false);
    }}>
      <div className="modal-header"><div><span className="eyebrow">Reconciliação rápida</span><h2>Ajustar saldo</h2></div><button type="button" className="icon-btn" onClick={onClose}><X size={20} /></button></div>
      <div className="balance-account"><span className="round-icon green"><RefreshCw size={18} /></span><div><strong>{account.name}</strong><small>Saldo calculado: {brl.format(current)}</small></div></div>
      <label>Qual saldo aparece no banco agora?<div className="money-input quick-money"><span>R$</span><input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} autoFocus required /></div></label>
      <div className={`balance-difference ${difference < 0 ? "negative" : ""}`}><span>Ajuste que será registrado</span><strong>{difference >= 0 ? "+" : "−"} {brl.format(Math.abs(difference))}</strong></div>
      <p className="balance-explanation">Seu saldo inicial não será alterado. O Weber Financeiro criará uma receita ou despesa de ajuste, mantendo o histórico conferível.</p>
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={saving || !Number.isFinite(actual)}><Check size={17} /> Confirmar saldo</button></div>
    </form>
  </div>;
}
