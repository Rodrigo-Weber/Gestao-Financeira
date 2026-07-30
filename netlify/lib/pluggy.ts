const DEFAULT_BASE_URL = "https://api.pluggy.ai";
const API_KEY_TTL_MS = 100 * 60 * 1000;

let cachedApiKey: { value: string; expiresAt: number } | null = null;

export class PluggyApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "PluggyApiError";
  }
}

export function pluggyConfigured() {
  return Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

function baseUrl() {
  const configured = process.env.PLUGGY_BASE_URL || DEFAULT_BASE_URL;
  const url = new URL(configured);
  if (url.protocol !== "https:") throw new Error("PLUGGY_BASE_URL precisa usar HTTPS.");
  return url.origin;
}

async function responseJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export async function getPluggyApiKey(forceRefresh = false) {
  if (!pluggyConfigured()) throw new PluggyApiError("Credenciais Pluggy não configuradas.", 503);
  if (!forceRefresh && cachedApiKey && cachedApiKey.expiresAt > Date.now()) return cachedApiKey.value;

  const response = await fetch(`${baseUrl()}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  const body = await responseJson(response);
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  if (!response.ok || !apiKey) {
    throw new PluggyApiError(response.status === 401 ? "Credenciais Pluggy inválidas." : "Falha ao autenticar na Pluggy.", response.status || 502);
  }
  cachedApiKey = { value: apiKey, expiresAt: Date.now() + API_KEY_TTL_MS };
  return apiKey;
}

export async function pluggyFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const apiKey = await getPluggyApiKey();
  const headers = new Headers(init.headers);
  headers.set("X-API-KEY", apiKey);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${baseUrl()}${normalizedPath}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(20_000),
  });
  if (response.status === 401 && retry) {
    cachedApiKey = null;
    await getPluggyApiKey(true);
    return pluggyFetch<T>(path, init, false);
  }
  if (!response.ok) {
    const body = await responseJson(response);
    const detail = typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "";
    throw new PluggyApiError(detail || `Pluggy respondeu HTTP ${response.status}.`, response.status);
  }
  return response.json() as Promise<T>;
}
