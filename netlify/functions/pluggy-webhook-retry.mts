import type { Config } from "@netlify/functions";
import { createAdminClient } from "../lib/shared";

export default async (req: Request) => {
  const admin = createAdminClient();
  if (!admin) return;
  const { data: events } = await admin.from("pluggy_webhook_events")
    .select("event_id")
    .in("status", ["pending", "error"])
    .lte("next_attempt_at", new Date().toISOString())
    .lt("attempts", 8)
    .order("next_attempt_at")
    .limit(20);
  for (const event of events ?? []) {
    await fetch(new URL("/.netlify/functions/pluggy-webhook-worker", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Pluggy-Webhook-Secret": process.env.PLUGGY_WEBHOOK_SECRET! },
      body: JSON.stringify({ eventId: event.event_id }),
    }).catch(() => null);
  }
};

export const config: Config = { schedule: "*/15 * * * *" };
