import { supabase } from "./supabase";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  if ((init.method ?? "GET").toUpperCase() !== "GET" && !headers.has("X-Idempotency-Key")) headers.set("X-Idempotency-Key", crypto.randomUUID());
  return fetch(path, { ...init, headers });
}
