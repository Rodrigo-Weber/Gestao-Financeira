import { z } from "zod";

export const PluggyWebhookPayload = z.object({
  event: z.string().min(1).max(100),
  eventId: z.string().min(1).max(160),
  itemId: z.string().optional(),
  accountId: z.string().optional(),
  transactionIds: z.array(z.string()).max(500).optional(),
  triggeredBy: z.string().optional(),
  error: z.unknown().optional(),
}).passthrough();

export type PluggyWebhook = z.infer<typeof PluggyWebhookPayload>;

export const syncEvents = new Set([
  "item/created",
  "item/updated",
  "transactions/created",
  "transactions/updated",
  "transactions/deleted",
]);

export const errorEvents = new Set([
  "item/error",
  "item/waiting_user_input",
  "item/waiting_user_action",
]);

export function webhookAuthorized(req: Request) {
  const expected = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!expected) return false;
  const authorization = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return authorization === expected || req.headers.get("x-pluggy-webhook-secret") === expected;
}
