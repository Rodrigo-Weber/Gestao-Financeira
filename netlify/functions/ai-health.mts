import "dotenv/config";
import OpenAI from "openai";
import { authenticate, json, requireGroqKey } from "../lib/shared";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const keyError = requireGroqKey();
  if (keyError) return keyError;

  const startedAt = Date.now();
  try {
    const model = process.env.GROQ_CHAT_MODEL || "groq/compound";
    const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
    const response = await groq.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Responda apenas: OK" }],
      max_tokens: 8,
    });
    if (!response.choices[0]?.message?.content) throw new Error("Resposta vazia");
    return json({ ok: true, provider: "Groq", model: response.model || model, latencyMs: Date.now() - startedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return json({ error: `Falha ao consultar a Groq: ${message}` }, 502);
  }
};
