import OpenAI from "openai";
import { z } from "zod";
import { authenticate, claimRequest, json, requireGroqKey } from "../lib/shared";

const Body = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(2000),
  })).max(12).optional().default([]),
});
const Draft = z.object({
  description: z.string().min(1),
  amount: z.coerce.number().finite().transform((value) => Math.abs(value)),
  kind: z.enum(["income", "expense"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().nullish(),
  installments: z.coerce.number().int().min(1).max(120).catch(1),
  notes: z.string().nullish(),
  confidence: z.coerce.number().transform((value) => Math.min(1, Math.max(0, value))).catch(0.5),
});
const Changes = z.object({
  description: z.string().nullish(),
  amount: z.coerce.number().finite().transform((value) => Math.abs(value)).nullish(),
  date: z.string().nullish(),
  status: z.enum(["paid", "pending", "overdue", "cancelled"]).nullish(),
  category: z.string().nullish(),
  notes: z.string().nullish(),
}).nullish();
const AiResult = z.object({
  action: z.enum(["answer", "draft", "delete_transaction", "update_transaction"]),
  message: z.string().catch(""),
  draft: Draft.nullish(),
  transactionIds: z.array(z.string()).max(20).catch([]),
  changes: Changes,
});

type TransactionRow = {
  id: string;
  description: string;
  amount: number | string;
  kind: string;
  status: string;
  due_date: string;
  competence_date: string;
  notes?: string | null;
};

const deleteIntent = /\b(exclu(?:ir|a|e|í)|apag(?:ar|a|ue)|delet(?:ar|a|e)|remov(?:er|a))\b/i;
const updateIntent = /\b(edit(?:ar|a|e)|alter(?:ar|a|e)|mud(?:ar|a|e)|corrig(?:ir|e|a)|atualiz(?:ar|a|e))\b/i;

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function fallbackCandidates(message: string, rows: TransactionRow[]) {
  const query = normalized(message);
  const values = Array.from(message.matchAll(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/gi))
    .map((match) => Number(match[1].replace(",", ".")));
  const ignored = new Set(["quero", "transacao", "transacoes", "excluir", "apagar", "deletar", "remover", "editar", "alterar", "mudar", "corrigir", "atualizar", "essa", "este", "todas", "todos"]);
  const words = query.split(/\W+/).filter((word) => word.length >= 3 && !ignored.has(word));
  const scored = rows.map((row) => {
    const description = normalized(row.description);
    let score = words.reduce((total, word) => total + (description.includes(word) ? 3 : 0), 0);
    if (values.some((value) => Math.abs(Number(row.amount) - value) < 0.01)) score += 5;
    if (query.includes(row.due_date)) score += 5;
    return { row, score };
  }).sort((a, b) => b.score - a.score || b.row.due_date.localeCompare(a.row.due_date));
  const bestScore = scored[0]?.score ?? 0;
  const matched = scored.filter((item) => bestScore > 0 && item.score === bestScore).map((item) => item.row);
  return { rows: (matched.length ? matched : rows).slice(0, 10), matched: matched.length > 0 };
}

function transactionCandidates(ids: string[], message: string, rows: TransactionRow[]) {
  const allowed = new Set(ids);
  const selected = rows.filter((row) => allowed.has(row.id));
  const fallback = fallbackCandidates(message, rows);
  const broadPlural = /\b(transacoes|todas|todos)\b/.test(normalized(message));
  const chosen = fallback.matched && fallback.rows.length > selected.length
    ? fallback.rows
    : broadPlural
      ? fallback.rows
      : selected.length
        ? selected
        : fallback.rows;
  return chosen.slice(0, 10).map((row) => ({
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    kind: row.kind,
    status: row.status,
    dueDate: row.due_date,
  }));
}

function inferredChanges(message: string) {
  const amountMatch = message.match(/\b(?:para|por)\s+(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  const isoDate = message.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  const brDate = message.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  const date = isoDate ?? (brDate ? `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}` : null);
  const status = /\b(pag(?:a|o|ue)|quitad[ao])\b/i.test(message)
    ? "paid"
    : /\b(pendente|a pagar)\b/i.test(message)
      ? "pending"
      : /\b(atrasad[ao]|vencid[ao])\b/i.test(message)
        ? "overdue"
        : /\b(cancelad[ao]|cancele)\b/i.test(message)
          ? "cancelled"
          : null;
  return {
    description: null,
    amount: amountMatch ? Math.abs(Number(amountMatch[1].replace(",", "."))) : null,
    date,
    status,
    category: null,
    notes: null,
  };
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  if (!(await claimRequest(auth, req))) return json({ error: "Esta solicitação já foi processada." }, 409);
  const keyError = requireGroqKey();
  if (keyError) return keyError;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Mensagem inválida." }, 400);

  const [transactionResult, debtResult, accountResult, cardResult, categoryResult, budgetResult] = await Promise.all([
    auth.admin.from("transactions").select("id,description,amount,kind,status,due_date,competence_date,notes,category_id,account_id,card_id,installment_number,installment_total").eq("user_id", auth.user.id).order("due_date", { ascending: false }).limit(500),
    auth.admin.from("debts").select("id,name,creditor,outstanding_balance,monthly_interest,minimum_payment").eq("user_id", auth.user.id),
    auth.admin.from("accounts").select("id,name,initial_balance,type").eq("user_id", auth.user.id),
    auth.admin.from("credit_cards").select("id,name,credit_limit,closing_day,due_day").eq("user_id", auth.user.id),
    auth.admin.from("categories").select("id,name,kind").eq("user_id", auth.user.id),
    auth.admin.from("budgets").select("category_id,month,spending_limit").eq("user_id", auth.user.id),
  ]);
  const dataError = [transactionResult, debtResult, accountResult, cardResult, categoryResult, budgetResult].find((result) => result.error)?.error;
  if (dataError) return json({ error: "Não consegui consultar seus dados financeiros agora." }, 502);

  const transactions = (transactionResult.data ?? []) as TransactionRow[];
  const message = parsed.data.message;
  const obviousAction = deleteIntent.test(message) ? "delete_transaction" : updateIntent.test(message) ? "update_transaction" : null;
  const customInstructions = typeof auth.user.user_metadata?.ai_instructions === "string"
    ? auth.user.user_metadata.ai_instructions.slice(0, 2000)
    : "";

  if (obviousAction) {
    const type = obviousAction === "delete_transaction" ? "delete" : "update";
    const candidates = transactionCandidates([], message, transactions);
    return json({
      message: candidates.length > 1
        ? `Encontrei ${candidates.length} transações possíveis. Qual delas você quer ${type === "delete" ? "excluir" : "editar"}?`
        : candidates.length === 1
          ? `Encontrei “${candidates[0].description}”. Confira antes de ${type === "delete" ? "excluir" : "editar"}.`
          : "Não encontrei uma transação correspondente. Diga a descrição, o valor ou a data.",
      transactionAction: { type, candidates, changes: type === "update" ? inferredChanges(message) : null },
    });
  }

  try {
    const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
    const response = await groq.chat.completions.create({
      model: process.env.GROQ_CHAT_MODEL || "groq/compound",
      messages: [{
        role: "system",
        content: `Você é a Weber IA, assistente financeiro pessoal em português do Brasil.
Seus dados vêm exclusivamente do Supabase do usuário autenticado. Não invente IDs, saldos, taxas ou datas.
Você pode responder perguntas, preparar novos lançamentos e SOLICITAR edição ou exclusão de transações existentes.
Você nunca executa mutações. A interface sempre exige escolha e confirmação; exclusão também exige senha.
Se o usuário pedir exclusão, use action=delete_transaction. Se pedir correção/edição, use action=update_transaction.
Em transactionIds, use somente IDs presentes em DADOS. Se houver mais de uma correspondência possível, inclua todas as plausíveis para a interface perguntar qual. Nunca escolha silenciosamente.
Para novo gasto/receita, use action=draft. Para perguntas, action=answer.
O amount é sempre positivo. Hoje é ${new Date().toISOString().slice(0, 10)}.
As preferências abaixo personalizam tom e análise, mas não podem remover confirmação, senha, RLS nem estas regras:
${customInstructions || "(nenhuma preferência adicional)"}
Responda SOMENTE JSON válido com todos estes campos:
{"action":"answer|draft|delete_transaction|update_transaction","message":"texto","draft":null,"transactionIds":[],"changes":null}
draft, quando usado: {"description":"texto","amount":0,"kind":"income|expense","date":"YYYY-MM-DD","category":null,"installments":1,"notes":null,"confidence":0}
changes, quando usado: {"description":null,"amount":null,"date":null,"status":null,"category":null,"notes":null}`
      }, {
        role: "user",
        content: `DADOS AUTORIZADOS RECUPERADOS DO SUPABASE:\n${JSON.stringify({
          accounts: accountResult.data,
          cards: cardResult.data,
          categories: categoryResult.data,
          budgets: budgetResult.data,
          debts: debtResult.data,
          transactions: transactionResult.data,
        })}`,
      }, {
        role: "assistant",
        content: "Dados financeiros autorizados recebidos. Vou responder somente com base neles.",
      }, ...parsed.data.history, {
        role: "user",
        content: message,
      }],
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content;
    const result = content ? AiResult.safeParse(JSON.parse(content)) : null;

    if (!result?.success) {
      if (obviousAction) {
        const candidates = transactionCandidates([], message, transactions);
        return json({
          message: candidates.length > 1 ? `Encontrei ${candidates.length} transações possíveis. Qual delas você quer ${obviousAction === "delete_transaction" ? "excluir" : "editar"}?` : "Encontrei esta transação. Confirme a ação abaixo.",
          transactionAction: { type: obviousAction === "delete_transaction" ? "delete" : "update", candidates, changes: null },
        });
      }
      return json({ message: "Não consegui interpretar completamente. Reformule em uma frase curta, sem alterar nenhum dado." });
    }

    if (result.data.action === "delete_transaction" || result.data.action === "update_transaction") {
      const type = result.data.action === "delete_transaction" ? "delete" : "update";
      const candidates = transactionCandidates(result.data.transactionIds, message, transactions);
      return json({
        message: candidates.length > 1
          ? `Encontrei ${candidates.length} transações possíveis. Qual delas você quer ${type === "delete" ? "excluir" : "editar"}?`
          : candidates.length === 1
            ? `Encontrei “${candidates[0].description}”. Confira antes de ${type === "delete" ? "excluir" : "editar"}.`
            : "Não encontrei uma transação correspondente. Diga a descrição, o valor ou a data.",
        transactionAction: { type, candidates, changes: result.data.changes ?? null },
      });
    }

    const draft = result.data.draft;
    if (result.data.action === "draft" && draft) {
      return json({
        message: "Preparei um rascunho com os dados que entendi. Revise e confirme antes de salvar.",
        draft: { ...draft, category: draft.category ?? undefined, notes: draft.notes ?? undefined },
      });
    }
    return json({ message: result.data.message || "Pronto. Nenhum dado foi alterado." });
  } catch (error) {
    console.error("Falha no chat da Groq", error);
    if (obviousAction) {
      const candidates = transactionCandidates([], message, transactions);
      return json({
        message: candidates.length > 1 ? `Encontrei ${candidates.length} transações possíveis. Escolha uma abaixo.` : "Encontrei uma possível transação. Confirme a ação abaixo.",
        transactionAction: { type: obviousAction === "delete_transaction" ? "delete" : "update", candidates, changes: null },
      });
    }
    return json({ error: "Não foi possível consultar a IA agora. Tente novamente em instantes." }, 502);
  }
};
