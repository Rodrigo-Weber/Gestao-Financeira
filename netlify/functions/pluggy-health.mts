import { authenticate, json } from "../lib/shared";
import { PluggyApiError, pluggyConfigured, pluggyFetch } from "../lib/pluggy";

type ConnectorList = {
  results?: unknown[];
};

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  if (!pluggyConfigured()) return json({ error: "Credenciais Pluggy não configuradas no servidor." }, 503);

  const startedAt = Date.now();
  try {
    const connectors = await pluggyFetch<ConnectorList>("/connectors?sandbox=true");
    return json({
      ok: true,
      provider: "Pluggy",
      mode: process.env.PLUGGY_MODE || "sandbox",
      sandboxConnectors: connectors.results?.length ?? 0,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof PluggyApiError ? error.message : "Não foi possível consultar a Pluggy.";
    const status = error instanceof PluggyApiError && error.status >= 400 && error.status < 600 ? error.status : 502;
    return json({ error: message }, status);
  }
};
