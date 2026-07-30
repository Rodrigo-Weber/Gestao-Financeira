import { useEffect, useRef, useState } from "react";
import { Bot, ImagePlus, LoaderCircle, Mic, Send, Sparkles, Square, Trash2, X } from "lucide-react";
import type { FinanceData, Transaction, TransactionDraft, TransactionStatus } from "../types";
import { apiFetch } from "../lib/api";

interface TransactionCandidate { id: string; description: string; amount: number; kind: string; status: string; dueDate: string }
export interface SuggestedChanges {
  description?: string | null;
  amount?: number | null;
  date?: string | null;
  status?: TransactionStatus | null;
  category?: string | null;
  notes?: string | null;
}
interface TransactionAction { type: "delete" | "update"; candidates: TransactionCandidate[]; changes?: SuggestedChanges | null }
interface Message { id: string; role: "user" | "assistant"; text: string; transactionAction?: TransactionAction }
const CHAT_CACHE_TTL = 60 * 60 * 1000;
const welcomeMessages: Message[] = [{ id: "welcome", role: "assistant", text: "Olá! Posso analisar suas finanças ou preparar um lançamento. Experimente: “gastei R$ 42 no mercado hoje”." }];

function loadMessages(cacheKey: string): Message[] {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return [...welcomeMessages];
    const value = JSON.parse(cached) as { expiresAt?: number; messages?: Message[] };
    if (!value.expiresAt || value.expiresAt <= Date.now()) {
      localStorage.removeItem(cacheKey);
      return [...welcomeMessages];
    }
    const messages = value.messages?.filter((item) =>
      typeof item?.id === "string" &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.text === "string",
    );
    return messages?.length ? messages : [...welcomeMessages];
  } catch {
    try { localStorage.removeItem(cacheKey); } catch { /* armazenamento indisponível */ }
    return [...welcomeMessages];
  }
}

async function apiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return body.error || fallback;
}

function localDraft(text: string): TransactionDraft | undefined {
  const match = text.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  if (!match || !/(gastei|paguei|comprei|despesa|mercado|uber|conta)/i.test(text)) return undefined;
  const amount = Number(match[1].replace(",", "."));
  const clean = text.replace(match[0], "").replace(/^(gastei|paguei|comprei)\s*(em|no|na)?\s*/i, "").trim();
  return { description: clean || "Nova despesa", amount, kind: "expense", date: new Date().toISOString().slice(0, 10), installments: 1, confidence: .72 };
}

export function ChatPanel({ open, cacheKey, onClose, data, onDraft, onEditTransaction, onDeleteTransaction }: { open: boolean; cacheKey: string; onClose: () => void; data: FinanceData; onDraft: (draft: TransactionDraft) => void; onEditTransaction: (transaction: Transaction, suggestions?: SuggestedChanges | null) => void; onDeleteTransaction: (transaction: Transaction) => void }) {
  const [messages, setMessages] = useState<Message[]>(() => loadMessages(cacheKey));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const skipNextPersistence = useRef(true);

  useEffect(() => {
    if (skipNextPersistence.current) {
      skipNextPersistence.current = false;
      return;
    }
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        expiresAt: Date.now() + CHAT_CACHE_TTL,
        messages: messages.slice(-100),
      }));
    } catch { /* o chat continua funcionando mesmo sem armazenamento local */ }
  }, [cacheKey, messages]);

  useEffect(() => {
    if (open) messagesEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  function clearConversation() {
    try { localStorage.removeItem(cacheKey); } catch { /* armazenamento indisponível */ }
    skipNextPersistence.current = true;
    setMessages([...welcomeMessages]);
    setInput("");
  }

  async function send(text = input) {
    if (!text.trim() || loading) return;
    const user: Message = { id: crypto.randomUUID(), role: "user", text };
    setMessages((items) => [...items, user]);
    setInput("");
    setLoading(true);
    try {
      const history = messages.slice(-12).map((item) => ({ role: item.role, content: item.text }));
      const response = await apiFetch("/api/ai-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history }) });
      if (!response.ok) throw new Error(await apiError(response, "IA indisponível."));
      const result = await response.json() as { message: string; draft?: TransactionDraft; transactionAction?: TransactionAction };
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: result.message, transactionAction: result.transactionAction }]);
      if (result.draft) onDraft(result.draft);
    } catch (error) {
      const draft = localDraft(text);
      const answer = draft ? `Encontrei uma despesa de ${draft.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Revise os dados antes de salvar.` : error instanceof Error ? error.message : "A IA está temporariamente indisponível.";
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: answer }]);
      if (draft) onDraft(draft);
    } finally { setLoading(false); }
  }

  async function toggleRecording() {
    if (recording) { recorder.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunks.current = [];
      mediaRecorder.ondataavailable = (event) => chunks.current.push(event.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType });
        const form = new FormData();
        form.append("audio", blob, "lancamento.webm");
        setLoading(true);
        try {
          const response = await apiFetch("/api/transcribe", { method: "POST", body: form });
          if (!response.ok) throw new Error(await apiError(response, "Não consegui transcrever agora."));
          const { text } = await response.json() as { text: string };
          await send(text);
        } catch (error) { setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: error instanceof Error ? error.message : "Não consegui transcrever agora." }]); setLoading(false); }
      };
      recorder.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch { setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: "Permita o acesso ao microfone para lançar por áudio." }]); }
  }

  async function receipt(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: "O comprovante deve ter no máximo 8 MB." }]); return; }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await apiFetch("/api/ai-transaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: reader.result, mimeType: file.type }) });
        if (!response.ok) throw new Error(await apiError(response, "Não consegui ler o comprovante."));
        const result = await response.json() as { draft: TransactionDraft; attachmentPath?: string };
        result.draft.attachmentPath = result.attachmentPath;
        result.draft.notes = "Extraído de comprovante";
        setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: `📎 ${file.name}` }, { id: crypto.randomUUID(), role: "assistant", text: "Li o comprovante. Confira os dados antes de salvar." }]);
        onDraft(result.draft);
      } catch (error) { setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: error instanceof Error ? error.message : "Não consegui ler este comprovante." }]); }
      finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
  }

  return <aside className={`chat-panel ${open ? "open" : ""}`}>
    <header><div><span className="chat-avatar"><Bot size={20} /></span><div><strong>Weber IA</strong><small><i /> Assistente financeiro</small></div></div><div className="chat-header-actions"><button className="chat-clear" onClick={clearConversation} disabled={loading || recording} title="Limpar conversa"><Trash2 size={15} /><span>Limpar</span></button><button className="icon-btn" onClick={onClose} title="Fechar chat"><X size={20} /></button></div></header>
    <div className="chat-tip"><Sparkles size={16} /><span>Histórico por 1 hora. Nada é alterado sem sua confirmação.</span></div>
    <div className="chat-messages">{messages.map((message) => <div className={`message ${message.role} ${message.transactionAction ? "with-actions" : ""}`} key={message.id}><span>{message.text}</span>{message.transactionAction?.candidates.length ? <div className="chat-candidates">{message.transactionAction.candidates.map((candidate) => {
      const transaction = data.transactions.find((item) => item.id === candidate.id);
      const deleting = message.transactionAction!.type === "delete";
      return <div className="chat-candidate" key={candidate.id}><div><strong>{candidate.description}</strong><small>{new Date(`${candidate.dueDate}T12:00:00`).toLocaleDateString("pt-BR")} • {candidate.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</small></div><button disabled={!transaction} className={deleting ? "candidate-delete" : ""} onClick={() => { if (!transaction) return; if (deleting) onDeleteTransaction(transaction); else onEditTransaction(transaction, message.transactionAction!.changes); }}>{transaction ? (deleting ? "Excluir" : "Editar") : "Indisponível"}</button></div>;
    })}</div> : null}</div>)}{loading && <div className="message assistant typing"><LoaderCircle className="spin" size={17} /> Analisando...</div>}<div ref={messagesEnd} /></div>
    <div className="chat-actions"><button onClick={() => fileInput.current?.click()}><ImagePlus size={17} /> Comprovante</button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => receipt(e.target.files?.[0])} /><button className={recording ? "recording" : ""} onClick={toggleRecording}>{recording ? <Square size={15} /> : <Mic size={17} />} {recording ? "Parar" : "Áudio"}</button></div>
    <form className="chat-input" onSubmit={(e) => { e.preventDefault(); void send(); }}><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder="Digite uma dúvida ou um gasto..." rows={2} /><button disabled={!input.trim() || loading} title="Enviar"><Send size={18} /></button></form>
  </aside>;
}
