import { createAdminClient } from "../lib/shared";
import { errorEvents, syncEvents, webhookAuthorized } from "../lib/pluggy-webhook";

export default async (req: Request) => {
  if (!webhookAuthorized(req)) return;
  const body = await req.json().catch(() => ({})) as { eventId?: string };
  if (!body.eventId) return;
  const admin = createAdminClient();
  if (!admin) return;
  const { data: event } = await admin.from("pluggy_webhook_events").select("*").eq("event_id", body.eventId).maybeSingle();
  if (!event || !event.connection_id || event.status === "success") return;

  await admin.from("pluggy_webhook_events").update({ status: "processing", attempts: event.attempts + 1 }).eq("id", event.id);
  try {
    if (syncEvents.has(event.event_name)) {
      const syncUrl = new URL("/.netlify/functions/pluggy-sync", req.url);
      const response = await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Pluggy-Webhook-Secret": process.env.PLUGGY_WEBHOOK_SECRET! },
        body: JSON.stringify({ connectionId: event.connection_id, userId: event.user_id }),
        signal: AbortSignal.timeout(14 * 60 * 1000),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || `Sincronização respondeu ${response.status}.`);
    } else if (errorEvents.has(event.event_name)) {
      const payload = event.payload as { error?: { message?: string; code?: string } };
      await admin.from("financial_connections").update({
        status: "error",
        last_error: payload.error?.message || payload.error?.code || event.event_name,
        webhook_last_event_at: new Date().toISOString(),
      }).eq("id", event.connection_id);
    }
    await admin.from("pluggy_webhook_events").update({ status: "success", processed_at: new Date().toISOString(), last_error: null }).eq("id", event.id);
  } catch (error) {
    const attempts = event.attempts + 1;
    const delayMinutes = Math.min(120, 2 ** Math.min(attempts, 6));
    await admin.from("pluggy_webhook_events").update({
      status: "error",
      last_error: error instanceof Error ? error.message : "Falha no processamento.",
      next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    }).eq("id", event.id);
    throw error;
  }
};

export const config = { background: true } as const;
