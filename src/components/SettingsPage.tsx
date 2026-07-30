import { useEffect, useMemo, useState } from "react";
import { Bot, Check, CircleAlert, CircleCheck, Database, KeyRound, LoaderCircle, LogOut, Plus, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import type { Category, FinanceData } from "../types";
import { apiFetch } from "../lib/api";

interface Props {
  data: FinanceData;
  displayName: string;
  aiInstructions: string;
  email?: string;
  demo: boolean;
  month: string;
  onSaveProfile: (name: string, instructions: string) => Promise<void>;
  onAddCategory: (category: Pick<Category, "name" | "kind" | "color">) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onSaveBudgets: (month: string, values: { categoryId: string; limit: number }[]) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function SettingsPage({ data, displayName, aiInstructions, email, demo, month, onSaveProfile, onAddCategory, onDeleteCategory, onSaveBudgets, onSignOut }: Props) {
  const [name, setName] = useState(displayName);
  const [instructions, setInstructions] = useState(aiInstructions);
  const [savingProfile, setSavingProfile] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryKind, setCategoryKind] = useState<"expense" | "income">("expense");
  const [categoryColor, setCategoryColor] = useState("#15976e");
  const [addingCategory, setAddingCategory] = useState(false);
  const [savingBudgets, setSavingBudgets] = useState(false);
  const [aiState, setAiState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [aiMessage, setAiMessage] = useState("");
  const initialBudgets = useMemo(() => Object.fromEntries(data.budgets.filter((item) => item.month === month).map((item) => [item.categoryId, item.limit])), [data.budgets, month]);
  const [budgetValues, setBudgetValues] = useState<Record<string, number>>(initialBudgets);

  useEffect(() => setName(displayName), [displayName]);
  useEffect(() => setInstructions(aiInstructions), [aiInstructions]);
  useEffect(() => setBudgetValues(initialBudgets), [initialBudgets]);

  async function saveProfile() {
    if (!name.trim()) return;
    setSavingProfile(true);
    await onSaveProfile(name.trim(), instructions.trim());
    setSavingProfile(false);
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!categoryName.trim()) return;
    setAddingCategory(true);
    await onAddCategory({ name: categoryName.trim(), kind: categoryKind, color: categoryColor });
    setCategoryName("");
    setAddingCategory(false);
  }

  async function saveBudgets() {
    setSavingBudgets(true);
    await onSaveBudgets(month, Object.entries(budgetValues).filter(([, limit]) => Number(limit) > 0).map(([categoryId, limit]) => ({ categoryId, limit: Number(limit) })));
    setSavingBudgets(false);
  }

  async function testAi() {
    setAiState("testing");
    setAiMessage("");
    try {
      const response = await apiFetch("/api/ai-health", { method: "POST" });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; provider?: string; model?: string; latencyMs?: number; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Teste indisponível.");
      setAiState("success");
      setAiMessage(`${result.provider} conectada • ${result.model} • ${result.latencyMs} ms`);
    } catch (error) {
      setAiState("error");
      setAiMessage(error instanceof Error ? error.message : "Não foi possível testar a IA.");
    }
  }

  return <div className="page-stack settings-page">
    <section className="page-title"><div><span className="eyebrow">Preferências e integrações</span><h1>Configurações</h1><p>Gerencie seu perfil, categorias, orçamentos e conexão com a IA.</p></div></section>

    <section className="settings-grid">
      <article className="panel settings-card">
        <div className="settings-card-title"><span className="round-icon green"><UserRound size={19} /></span><div><h2>Seu perfil</h2><p>Informações usadas na experiência do aplicativo.</p></div></div>
        <label>Nome de exibição<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>E-mail<input value={email || "Modo demonstração"} disabled /></label>
        <div className="form-grid"><label>Moeda<select value="BRL" disabled><option>Real brasileiro (BRL)</option></select></label><label>Fuso horário<select value="America/Bahia" disabled><option>America/Bahia</option></select></label></div>
        <button className="primary-btn settings-save" onClick={saveProfile} disabled={savingProfile || demo}>{savingProfile ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} Salvar perfil</button>
        {demo && <p className="settings-hint"><CircleAlert size={15} /> Entre em uma conta para sincronizar alterações.</p>}
      </article>

      <article className="panel settings-card">
        <div className="settings-card-title"><span className="round-icon green"><Bot size={19} /></span><div><h2>Weber IA</h2><p>Status da integração serverless com a Groq.</p></div></div>
        <div className="integration-row"><div><span className="provider-logo">G</span><div><strong>Groq</strong><small>Chat: groq/compound</small></div></div><span className={`integration-status ${aiState === "success" ? "online" : ""}`}><i /> {aiState === "success" ? "Conectada" : "Não testada"}</span></div>
        <div className="model-list"><span><KeyRound size={15} /> Chave protegida no servidor</span><span><Bot size={15} /> OCR: Qwen 3.6 Vision</span><span><Database size={15} /> Áudio: Whisper Large V3 Turbo</span><span><ShieldCheck size={15} /> RAG: dados autorizados do Supabase em tempo real</span></div>
        <label>Instruções personalizadas<textarea rows={4} maxLength={2000} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Ex.: Seja direto, priorize quitar dívidas com juros maiores e sempre explique estimativas." /></label>
        <small className="settings-counter">{instructions.length}/2000 • regras de senha, confirmação e segurança não podem ser desativadas</small>
        <button className="secondary-btn settings-save" onClick={saveProfile} disabled={savingProfile || demo}>{savingProfile ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} Salvar instruções</button>
        {aiMessage && <div className={`ai-test-result ${aiState}`} >{aiState === "success" ? <CircleCheck size={17} /> : <CircleAlert size={17} />}{aiMessage}</div>}
        <button className="secondary-btn settings-save" onClick={testAi} disabled={aiState === "testing"}>{aiState === "testing" ? <LoaderCircle className="spin" size={17} /> : <Bot size={17} />} Testar conexão</button>
        {demo && <p className="settings-hint"><ShieldCheck size={15} /> O teste exige login para proteger sua cota da Groq.</p>}
      </article>
    </section>

    <article className="panel settings-section">
      <div className="settings-section-head"><div><span className="eyebrow">Organização</span><h2>Categorias</h2><p>Personalize como receitas e despesas são classificadas.</p></div></div>
      <form className="category-form" onSubmit={addCategory}><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Nome da nova categoria" /><select value={categoryKind} onChange={(event) => setCategoryKind(event.target.value as typeof categoryKind)}><option value="expense">Despesa</option><option value="income">Receita</option></select><input className="color-input" type="color" value={categoryColor} onChange={(event) => setCategoryColor(event.target.value)} /><button className="primary-btn" disabled={addingCategory || !categoryName.trim()}><Plus size={17} /> Adicionar</button></form>
      <div className="settings-category-list">{data.categories.map((category) => {
        const inUse = data.transactions.some((item) => item.categoryId === category.id);
        return <div key={category.id}><span className="category-swatch" style={{ background: category.color }} /><div><strong>{category.name}</strong><small>{category.kind === "income" ? "Receita" : "Despesa"}{inUse ? " • em uso" : ""}</small></div><button className="icon-btn danger-button" title="Excluir categoria" onClick={() => { if (window.confirm(`Excluir a categoria “${category.name}”? Os lançamentos serão mantidos sem categoria.`)) void onDeleteCategory(category.id); }}><Trash2 size={16} /></button></div>;
      })}</div>
    </article>

    <article className="panel settings-section">
      <div className="settings-section-head"><div><span className="eyebrow">Planejamento mensal</span><h2>Limites por categoria</h2><p>Defina quanto pretende gastar em cada categoria neste mês.</p></div><button className="primary-btn" onClick={saveBudgets} disabled={savingBudgets}>{savingBudgets ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Salvar limites</button></div>
      <div className="budget-settings-list">{data.categories.filter((item) => item.kind === "expense").map((category) => <label key={category.id}><span><i style={{ background: category.color }} />{category.name}</span><div className="money-input"><span>R$</span><input type="number" min="0" step="10" value={budgetValues[category.id] ?? ""} placeholder="Sem limite" onChange={(event) => setBudgetValues((current) => ({ ...current, [category.id]: Number(event.target.value) }))} /></div></label>)}</div>
    </article>

    <article className="panel danger-zone"><div><span className="round-icon coral"><LogOut size={18} /></span><div><strong>Encerrar sessão</strong><small>{demo ? "Voltar para a tela de acesso" : "Seus dados continuarão seguros no Supabase."}</small></div></div><button className="secondary-btn" onClick={onSignOut}><LogOut size={17} /> Sair</button></article>
  </div>;
}
