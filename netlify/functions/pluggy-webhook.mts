import type { Config } from "@netlify/functions";
import { createAdminClient, json } from "../lib/shared";
import { PluggyWebhookPayload, webhookAuthorized } from "../lib/pluggy-webhook";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!webhookAuthorized(req)) return json({ error: "Webhook não autorizado." }, 401);
  const parsed = PluggyWebhookPayload.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Payload inválido." }, 400);
  const admin = createAdminClient();
  if (!admin) return json({ error: "Supabase não configurado." }, 503);

  const connection = parsed.data.itemId
    ? await admin.from("financial_connections").select("id,user_id").eq("provider", "pluggy").eq("external_item_id", parsed.data.itemId).maybeSingle()
    : { data: null, error: null };
  const { data: event, error } = await admin.from("pluggy_webhook_events").upsert({
    event_id: parsed.data.eventId,
    event_name: parsed.data.event,
    item_id: parsed.data.itemId ?? null,
    account_id: parsed.data.accountId ?? null,
    user_id: connection.data?.user_id ?? null,
    connection_id: connection.data?.id ?? null,
    payload: parsed.data,
    status: connection.data ? "pending" : "ignored",
    next_attempt_at: new Date().toISOString(),
  }, { onConflict: "event_id", ignoreDuplicates: true }).select("id,status").maybeSingle();
  if (error) return json({ error: "Não foi possível registrar o evento." }, 503);

  if (event?.status === "pending") {
    const workerUrl = new URL("/.netlify/functions/pluggy-webhook-worker", req.url);
    await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Pluggy-Webhook-Secret": process.env.PLUGGY_WEBHOOK_SECRET! },
      body: JSON.stringify({ eventId: parsed.data.eventId }),
      signal: AbortSignal.timeout(1_200),
    }).catch(() => null);
  }
  return json({ accepted: true }, 202);
};

export const config: Config = { path: "/api/pluggy-webhook" };
