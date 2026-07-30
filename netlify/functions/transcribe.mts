import OpenAI, { toFile } from "openai";
import { authenticate, claimRequest, json, requireGroqKey } from "../lib/shared";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  if (!(await claimRequest(auth, req))) return json({ error: "Esta solicitação já foi processada." }, 409);
  const keyError = requireGroqKey();
  if (keyError) return keyError;
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File)) return json({ error: "Áudio ausente." }, 400);
  if (audio.size > 12 * 1024 * 1024) return json({ error: "O áudio deve ter no máximo 12 MB." }, 413);
  const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
  const result = await groq.audio.transcriptions.create({
    file: await toFile(new Uint8Array(await audio.arrayBuffer()), audio.name || "audio.webm", { type: audio.type }),
    model: process.env.GROQ_TRANSCRIBE_MODEL || "whisper-large-v3-turbo",
    language: "pt",
    prompt: "Transação financeira pessoal em reais. Preserve valores, datas, parcelas, estabelecimentos e categorias.",
  });
  return json({ text: result.text });
};
