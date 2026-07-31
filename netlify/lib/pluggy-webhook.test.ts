import { afterEach, describe, expect, it } from "vitest";
import { PluggyWebhookPayload, syncEvents, webhookAuthorized } from "./pluggy-webhook";

const previousSecret = process.env.PLUGGY_WEBHOOK_SECRET;
afterEach(() => {
  if (previousSecret == null) delete process.env.PLUGGY_WEBHOOK_SECRET;
  else process.env.PLUGGY_WEBHOOK_SECRET = previousSecret;
});

describe("Pluggy webhook contract", () => {
  it("validates an item update and preserves extra fields", () => {
    const result = PluggyWebhookPayload.parse({ event: "item/updated", eventId: "evt-1", itemId: "item-1", triggeredBy: "SYNC" });
    expect(result.itemId).toBe("item-1");
    expect(syncEvents.has(result.event)).toBe(true);
  });

  it("requires the configured bearer secret", () => {
    process.env.PLUGGY_WEBHOOK_SECRET = "secret";
    expect(webhookAuthorized(new Request("https://weberfinanceiro.com.br/api/pluggy-webhook", { headers: { Authorization: "Bearer secret" } }))).toBe(true);
    expect(webhookAuthorized(new Request("https://weberfinanceiro.com.br/api/pluggy-webhook", { headers: { Authorization: "Bearer wrong" } }))).toBe(false);
  });
});
