import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Bot, Check, CircleAlert, CircleCheck, Database, KeyRound, Landmark, Link2, LoaderCircle, LogOut, Plus, RefreshCw, Save, ShieldCheck, Trash2, Unplug, UserRound, X } from "lucide-react";
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
  onClassifyCategory: (id: string, value: string) => Promise<void>;
  onSaveBudgets: (month: string, values: { categoryId: string; limit: number }[]) => Promise<void>;
  onDataChanged: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

interface PluggyConnection {
  id: string;
  itemId: string;
  displayName: string;
  status: string;
  products: string[];
  lastSyncedAt?: string | null;
  lastError?: string | null;
}

export function SettingsPage({ data, displayName, aiInstructions, email, demo, month, onSaveProfile, onAddCategory, onDeleteCategory, onClassifyCategory, onSaveBudgets, onDataChanged, onSignOut }: Props) {
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
  const [pluggyItemId, setPluggyItemId] = useState("");
  const [pluggyName, setPluggyName] = useState("Conta sandbox");
  const [pluggyConnections, setPluggyConnections] = useState<PluggyConnection[]>([]);
  const [pluggyState, setPluggyState] = useState<"idle" | "loading" | "testing" | "saving" | "success" | "error">("idle");
  const [pluggyMessage, setPluggyMessage] = useState("");
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);
  const [replacingConnectionId, setReplacingConnectionId] = useState<string | null>(null);
  const initialBudgets = useMemo(() => Object.fromEntries(data.budgets.filter((item) => item.month === month).map((item) => [item.categoryId, item.limit])), [data.budgets, month]);
  const [budgetValues, setBudgetValues] = useState<Record<string, number>>(initialBudgets);

  useEffect(() => setName(displayName), [displayName]);
  useEffect(() => setInstructions(aiInstructions), [aiInstructions]);
  useEffect(() => setBudgetValues(initialBudgets), [initialBudgets]);
  useEffect(() => { if (!demo) void loadPluggyConnections(); }, [demo]);

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

  async function loadPluggyConnections() {
    setPluggyState("loading");
    try {
      const response = await apiFetch("/api/pluggy-connections");
      const result = await response.json().catch(() => ({})) as { connections?: PluggyConnection[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar conexões.");
      setPluggyConnections(result.connections ?? []);
      setPluggyState("idle");
    } catch (error) {
      setPluggyState("error");
      setPluggyMessage(error instanceof Error ? error.message : "Não foi possível carregar conexões.");
    }
  }

  async function testPluggy() {
    setPluggyState("testing");
    setPluggyMessage("");
    try {
      const response = await apiFetch("/api/pluggy-health", { method: "POST" });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; provider?: string; mode?: string; latencyMs?: number; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Teste indisponível.");
      setPluggyState("success");
      setPluggyMessage(`${result.provider} conectada em modo ${result.mode} • ${result.latencyMs} ms`);
    } catch (error) {
      setPluggyState("error");
      setPluggyMessage(error instanceof Error ? error.message : "Não foi possível testar a Pluggy.");
    }
  }

  async function addPluggyConnection(event: React.FormEvent) {
    event.preventDefault();
    if (!pluggyItemId.trim()) return;
    setPluggyState("saving");
    setPluggyMessage("");
    try {
      const response = await apiFetch("/api/pluggy-connections", {
        method: replacingConnectionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: pluggyItemId.trim(), displayName: pluggyName.trim() || undefined, ...(replacingConnectionId ? { connectionId: replacingConnectionId } : {}) }),
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; preview?: { accounts: number; bankAccounts: number; creditCards: number }; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Não foi possível adicionar conexão.");
      setPluggyItemId("");
      const replaced = Boolean(replacingConnectionId);
      setReplacingConnectionId(null);
      setPluggyState("success");
      setPluggyMessage(`${replaced ? "Conexão substituída" : "Item validado"} • ${result.preview?.bankAccounts ?? 0} contas • ${result.preview?.creditCards ?? 0} cartões${replaced ? " • sincronize agora" : ""}`);
      await loadPluggyConnections();
      setPluggyState("success");
    } catch (error) {
      setPluggyState("error");
      setPluggyMessage(error instanceof Error ? error.message : "Não foi possível adicionar conexão.");
    }
  }

  function beginReplace(connection: PluggyConnection) {
    setReplacingConnectionId(connection.id);
    setPluggyName(connection.displayName.replace(/\s*\(sandbox\)$/i, "") || "Conta pessoal");
    setPluggyItemId("");
    setPluggyMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function changePluggyConnection(connection: PluggyConnection, mode: "disconnect" | "delete") {
    if (mode === "disconnect" && !window.confirm(`Desconectar “${connection.displayName}” e manter todos os dados já importados?`)) return;
    if (mode === "delete") {
      const confirmation = window.prompt(`Esta ação excluirá somente os dados importados por “${connection.displayName}”. Dados manuais serão preservados.\n\nDigite EXCLUIR para continuar:`);
      if (confirmation !== "EXCLUIR") return;
    }
    setPluggyState("saving");
    setPluggyMessage("");
    try {
      const response = await apiFetch("/api/pluggy-connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connection.id, mode }),
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Não foi possível alterar a conexão.");
      await Promise.all([loadPluggyConnections(), mode === "delete" ? onDataChanged() : Promise.resolve()]);
      setPluggyState("success");
      setPluggyMessage(mode === "disconnect" ? "Conexão pausada. O histórico foi mantido e não será sincronizado automaticamente." : "Conexão e dados importados excluídos. Dados manuais foram preservados.");
    } catch (error) {
      setPluggyState("error");
      setPluggyMessage(error instanceof Error ? error.message : "Não foi possível alterar a conexão.");
    }
  }

  async function syncPluggy(connection: PluggyConnection) {
    setSyncingConnectionId(connection.id);
    setPluggyState("loading");
    setPluggyMessage("");
    try {
      const response = await apiFetch("/api/pluggy-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connection.id }),
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; accounts?: number; cards?: number; loans?: number; investments?: number; transactions?: number; inserted?: number; updated?: number; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Não foi possível sincronizar.");
      await Promise.all([loadPluggyConnections(), onDataChanged()]);
      setPluggyState("success");
      setPluggyMessage(`${result.accounts ?? 0} contas • ${result.cards ?? 0} cartões • ${result.loans ?? 0} empréstimos • ${result.investments ?? 0} investimentos • ${result.transactions ?? 0} transações • ${result.inserted ?? 0} novos`);
    } catch (error) {
      setPluggyState("error");
      setPluggyMessage(error instanceof Error ? error.message : "Não foi possível sincronizar.");
    } finally {
      setSyncingConnectionId(null);
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

      <article className="panel settings-card pluggy-card">
        <div className="settings-card-title"><span className="round-icon green"><Landmark size={19} /></span><div><h2>Open Finance pessoal</h2><p>Vincule itens do Meu Pluggy sem guardar segredos no navegador.</p></div></div>
        <div className="integration-row"><div><span className="provider-logo pluggy">P</span><div><strong>Pluggy</strong><small>Sandbox agora • Meu Pluggy depois</small></div></div><span className={`integration-status ${pluggyState === "success" ? "online" : ""}`}><i /> {pluggyState === "success" ? "Conectada" : pluggyState === "testing" || pluggyState === "saving" || pluggyState === "loading" ? "Verificando" : "Não testada"}</span></div>
        <div className="pluggy-layout">
          <form className="pluggy-connect-form" onSubmit={addPluggyConnection}>
            {replacingConnectionId && <div className="replace-notice"><ArrowRightLeft size={17} /><div><strong>Substituindo conexão</strong><span>O Item antigo só será limpo após o novo ser validado.</span></div><button type="button" title="Cancelar substituição" onClick={() => { setReplacingConnectionId(null); setPluggyItemId(""); }}><X size={16} /></button></div>}
            <label>Nome da conexão<input value={pluggyName} onChange={(event) => setPluggyName(event.target.value)} placeholder="Ex.: Nubank pessoal" disabled={demo} /></label>
            <label>{replacingConnectionId ? "Novo Item ID" : "Item ID"}<input value={pluggyItemId} onChange={(event) => setPluggyItemId(event.target.value)} placeholder="00000000-0000-0000-0000-000000000000" disabled={demo} /></label>
            <div className="pluggy-actions"><button type="button" className="secondary-btn" onClick={testPluggy} disabled={demo || pluggyState === "testing"}>{pluggyState === "testing" ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />} Testar credenciais</button><button className="primary-btn" disabled={demo || pluggyState === "saving" || !pluggyItemId.trim()}>{pluggyState === "saving" ? <LoaderCircle className="spin" size={17} /> : replacingConnectionId ? <ArrowRightLeft size={17} /> : <Link2 size={17} />} {replacingConnectionId ? "Validar e substituir" : "Validar e vincular"}</button></div>
          </form>
          <div className="pluggy-connection-list">
            <span className="eyebrow">Itens vinculados</span>
            {pluggyConnections.map((connection) => <div className="pluggy-connection" key={connection.id}><span className="round-icon soft"><Landmark size={17} /></span><div><strong>{connection.displayName}</strong><small>{connection.itemId.slice(0, 8)}… • {connection.products.length || 0} produtos{connection.lastSyncedAt ? ` • ${new Date(connection.lastSyncedAt).toLocaleString("pt-BR")}` : " • nunca sincronizada"}</small></div><span className={`status-pill ${connection.status === "active" ? "paid" : "pending"}`}>{connection.status === "active" ? "Ativa" : connection.status === "syncing" ? "Sincronizando" : connection.status === "error" ? "Erro" : connection.status === "disconnected" ? "Desconectada" : connection.status}</span><div className="pluggy-connection-actions">{connection.status !== "disconnected" && <button type="button" className="secondary-btn" onClick={() => void syncPluggy(connection)} disabled={Boolean(syncingConnectionId)}>{syncingConnectionId === connection.id ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Sincronizar</button>}<button type="button" className="secondary-btn" onClick={() => beginReplace(connection)}><ArrowRightLeft size={16} /> Substituir</button>{connection.status !== "disconnected" && <button type="button" className="secondary-btn" onClick={() => void changePluggyConnection(connection, "disconnect")}><Unplug size={16} /> Desconectar</button>}<button type="button" className="danger-outline-btn" onClick={() => void changePluggyConnection(connection, "delete")}><Trash2 size={16} /> Excluir dados</button></div></div>)}
            {!pluggyConnections.length && <div className="pluggy-empty"><Database size={20} /><span>Nenhum Item ID vinculado.</span></div>}
          </div>
        </div>
        {pluggyMessage && <div className={`ai-test-result ${pluggyState === "success" ? "success" : "error"}`}>{pluggyState === "success" ? <CircleCheck size={17} /> : <CircleAlert size={17} />}{pluggyMessage}</div>}
        {demo && <p className="settings-hint"><ShieldCheck size={15} /> Saia do modo demonstração e entre em sua conta Weber para vincular dados.</p>}
      </article>
    </section>

    <article className="panel settings-section">
      <div className="settings-section-head"><div><span className="eyebrow">Organização</span><h2>Categorias</h2><p>Personalize como receitas e despesas são classificadas.</p></div></div>
      <form className="category-form" onSubmit={addCategory}><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Nome da nova categoria" /><select value={categoryKind} onChange={(event) => setCategoryKind(event.target.value as typeof categoryKind)}><option value="expense">Despesa</option><option value="income">Receita</option></select><input className="color-input" type="color" value={categoryColor} onChange={(event) => setCategoryColor(event.target.value)} /><button className="primary-btn" disabled={addingCategory || !categoryName.trim()}><Plus size={17} /> Adicionar</button></form>
      <div className="settings-category-list">{data.categories.map((category) => {
        const inUse = data.transactions.some((item) => item.categoryId === category.id);
        return <div key={category.id}><span className="category-swatch" style={{ background: category.color }} /><div><strong>{category.name}</strong><small>{category.kind === "income" ? "Receita" : "Despesa"}{inUse ? " • em uso" : ""}</small><select className="category-class-select" value={category.kind === "income" ? category.incomeClass ?? "eventual" : category.spendingClass ?? "flexible"} onChange={(event) => void onClassifyCategory(category.id, event.target.value)} disabled={demo}>{category.kind === "income" ? <><option value="recurring">Renda recorrente</option><option value="eventual">Renda eventual</option></> : <><option value="essential">Essencial</option><option value="fixed">Fixo</option><option value="flexible">Flexível</option><option value="eventual">Eventual</option></>}</select></div><button className="icon-btn danger-button" title="Excluir categoria" onClick={() => { if (window.confirm(`Excluir a categoria “${category.name}”? Os lançamentos serão mantidos sem categoria.`)) void onDeleteCategory(category.id); }}><Trash2 size={16} /></button></div>;
      })}</div>
    </article>

    <article className="panel settings-section">
      <div className="settings-section-head"><div><span className="eyebrow">Planejamento mensal</span><h2>Limites por categoria</h2><p>Defina quanto pretende gastar em cada categoria neste mês.</p></div><button className="primary-btn" onClick={saveBudgets} disabled={savingBudgets}>{savingBudgets ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Salvar limites</button></div>
      <div className="budget-settings-list">{data.categories.filter((item) => item.kind === "expense").map((category) => <label key={category.id}><span><i style={{ background: category.color }} />{category.name}</span><div className="money-input"><span>R$</span><input type="number" min="0" step="10" value={budgetValues[category.id] ?? ""} placeholder="Sem limite" onChange={(event) => setBudgetValues((current) => ({ ...current, [category.id]: Number(event.target.value) }))} /></div></label>)}</div>
    </article>

    <article className="panel danger-zone"><div><span className="round-icon coral"><LogOut size={18} /></span><div><strong>Encerrar sessão</strong><small>{demo ? "Voltar para a tela de acesso" : "Seus dados continuarão seguros no Supabase."}</small></div></div><button className="secondary-btn" onClick={onSignOut}><LogOut size={17} /> Sair</button></article>
  </div>;
}
