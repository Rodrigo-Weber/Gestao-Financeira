import OpenAI from "openai";
import { z } from "zod";
import { authenticate, claimRequest, json, requireGroqKey } from "../lib/shared";

const Body = z.object({
  image: z.string().startsWith("data:image/").max(11_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const Draft = z.object({
  description: z.string(),
  amount: z.number().nonnegative(),
  kind: z.enum(["income", "expense"]),
  date: z.string(),
  category: z.string().nullable(),
  installments: z.number().int().min(1).max(120),
  notes: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  if (!(await claimRequest(auth, req))) return json({ error: "Esta solicitação já foi processada." }, 409);
  const keyError = requireGroqKey();
  if (keyError) return keyError;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Envie JPG, PNG ou WebP com até 8 MB." }, 400);

  const base64 = parsed.data.image.split(",")[1];
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  if (bytes.byteLength > 8 * 1024 * 1024) return json({ error: "Arquivo maior que 8 MB." }, 413);
  const extension = parsed.data.mimeType === "image/png" ? "png" : parsed.data.mimeType === "image/webp" ? "webp" : "jpg";
  const attachmentPath = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await auth.admin.storage.from("receipts").upload(attachmentPath, bytes, { contentType: parsed.data.mimeType, upsert: false });
  if (uploadError) return json({ error: "Não foi possível guardar o comprovante com segurança." }, 500);

  try {
    const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
    const response = await groq.chat.completions.create({
      model: process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b",
      messages: [{
        role: "system",
        content: `Extraia um único lançamento financeiro deste comprovante brasileiro.
Use o total efetivamente pago, data no formato YYYY-MM-DD e uma descrição curta com o estabelecimento.
Se não houver parcelamento explícito, use 1. Nunca invente dados ilegíveis; reduza confidence. Hoje é ${new Date().toISOString().slice(0, 10)}.
Responda SOMENTE como JSON válido, sem markdown, com exatamente:
{"description":"texto","amount":0,"kind":"income|expense","date":"YYYY-MM-DD","category":null,"installments":1,"notes":null,"confidence":0}`
      }, {
        role: "user",
        content: [
          { type: "text", text: "Leia este comprovante e prepare o rascunho para revisão." },
          { type: "image_url", image_url: { url: parsed.data.image, detail: "high" } },
        ],
      }],
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Resposta vazia da Groq");
    const draft = Draft.parse(JSON.parse(content));
    return json({ draft: { ...draft, category: draft.category ?? undefined, notes: draft.notes ?? undefined }, attachmentPath });
  } catch (error) {
    await auth.admin.storage.from("receipts").remove([attachmentPath]);
    console.error(error);
    return json({ error: "Não foi possível interpretar o comprovante." }, 502);
  }
};
