import "dotenv/config";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export interface AuthContext {
  user: User;
  admin: SupabaseClient;
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function authenticate(req: Request): Promise<AuthContext | Response> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return json({ error: "Supabase não configurado no servidor." }, 503);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Faça login para usar a IA." }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: "Sessão inválida ou expirada." }, 401);
  return { user: data.user, admin };
}

export async function claimRequest(context: AuthContext, req: Request) {
  const key = req.headers.get("x-idempotency-key");
  if (!key) return true;
  const { error } = await context.admin.from("ai_requests").insert({ user_id: context.user.id, idempotency_key: key });
  return !error;
}

export function requireGroqKey() {
  if (!process.env.GROQ_API_KEY) return json({ error: "GROQ_API_KEY não configurada." }, 503);
  return null;
}
