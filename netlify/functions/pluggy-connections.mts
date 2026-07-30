import { z } from "zod";
import { authenticate, json } from "../lib/shared";
import { PluggyApiError, pluggyConfigured, pluggyFetch } from "../lib/pluggy";

const AddConnection = z.object({
  itemId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(80).optional(),
});
const ReplaceConnection = AddConnection.extend({ connectionId: z.string().uuid() });
const RemoveConnection = z.object({
  connectionId: z.string().uuid(),
  mode: z.enum(["disconnect", "delete"]),
});

type PluggyItem = {
  id?: string;
  status?: string;
  connector?: {
    name?: string;
    products?: string[];
  };
};

type PluggyAccount = {
  id?: string;
  type?: string;
};

type AccountList = {
  results?: PluggyAccount[];
};

function errorResponse(error: unknown) {
  const message = error instanceof PluggyApiError ? error.message : "Não foi possível consultar a Pluggy.";
  const status = error instanceof PluggyApiError && error.status >= 400 && error.status < 600 ? error.status : 502;
  return json({ error: message }, status);
}

async function deleteImportedData(admin: any, userId: string, connectionId: string) {
  const tables = ["transactions", "card_invoices", "debts", "investments", "credit_cards", "accounts"] as const;
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId).eq("connection_id", connectionId);
    if (error) throw new Error(`Não foi possível limpar os dados importados de ${table}.`);
  }
}

export default async (req: Request) => {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method)) return json({ error: "Método não permitido." }, 405);
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  if (req.method === "GET") {
    const { data, error } = await auth.admin
      .from("financial_connections")
      .select("id,external_item_id,display_name,status,products,last_synced_at,last_error,created_at")
      .eq("user_id", auth.user.id)
      .eq("provider", "pluggy")
      .order("created_at");
    if (error) return json({ error: "Não foi possível carregar conexões Pluggy." }, 502);
    return json({
      connections: (data ?? []).map((item) => ({
        id: item.id,
        itemId: item.external_item_id,
        displayName: item.display_name,
        status: item.status,
        products: item.products,
        lastSyncedAt: item.last_synced_at,
        lastError: item.last_error,
      })),
    });
  }

  if (req.method === "DELETE") {
    const parsed = RemoveConnection.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Solicitação inválida." }, 400);
    const { data: connection, error: findError } = await auth.admin.from("financial_connections").select("id").eq("id", parsed.data.connectionId).eq("user_id", auth.user.id).eq("provider", "pluggy").maybeSingle();
    if (findError) return json({ error: "Não foi possível localizar a conexão." }, 502);
    if (!connection) return json({ error: "Conexão não encontrada." }, 404);
    try {
      if (parsed.data.mode === "disconnect") {
        const { error } = await auth.admin.from("financial_connections").update({ status: "disconnected", last_error: null }).eq("id", connection.id).eq("user_id", auth.user.id);
        if (error) throw new Error("Não foi possível desconectar.");
        return json({ ok: true, mode: "disconnect" });
      }
      await deleteImportedData(auth.admin, auth.user.id, connection.id);
      const { error } = await auth.admin.from("financial_connections").delete().eq("id", connection.id).eq("user_id", auth.user.id);
      if (error) throw new Error("Não foi possível excluir a conexão.");
      return json({ ok: true, mode: "delete" });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Não foi possível alterar a conexão." }, 502);
    }
  }

  if (!pluggyConfigured()) return json({ error: "Credenciais Pluggy não configuradas no servidor." }, 503);
  const replacing = req.method === "PATCH";
  const parsed = (replacing ? ReplaceConnection : AddConnection).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Item ID inválido." }, 400);

  if (replacing) {
    const replacement = parsed.data as z.infer<typeof ReplaceConnection>;
    const { data: connection, error: findError } = await auth.admin.from("financial_connections").select("id").eq("id", replacement.connectionId).eq("user_id", auth.user.id).eq("provider", "pluggy").maybeSingle();
    if (findError) return json({ error: "Não foi possível localizar a conexão." }, 502);
    if (!connection) return json({ error: "Conexão não encontrada." }, 404);
    const { data: duplicate } = await auth.admin.from("financial_connections").select("id").eq("user_id", auth.user.id).eq("provider", "pluggy").eq("external_item_id", replacement.itemId).neq("id", connection.id).maybeSingle();
    if (duplicate) return json({ error: "Este Item ID já está vinculado em outra conexão." }, 409);

    try {
      const [item, accounts] = await Promise.all([
        pluggyFetch<PluggyItem>(`/items/${encodeURIComponent(replacement.itemId)}`),
        pluggyFetch<AccountList>(`/accounts?itemId=${encodeURIComponent(replacement.itemId)}`),
      ]);
      const accountList = Array.isArray(accounts) ? accounts as PluggyAccount[] : accounts.results ?? [];
      const products = Array.from(new Set([
        ...(item.connector?.products ?? []),
        ...accountList.map((account) => account.type === "CREDIT" ? "CREDIT_CARDS" : "ACCOUNTS"),
      ]));
      const { data, error } = await auth.admin.from("financial_connections").update({
        external_item_id: replacement.itemId,
        display_name: replacement.displayName || item.connector?.name || `Pluggy ${replacement.itemId.slice(0, 8)}`,
        status: "active",
        products,
        last_synced_at: null,
        last_error: null,
      }).eq("id", connection.id).eq("user_id", auth.user.id).select("id").single();
      if (error || !data) throw new Error("Item validado, mas não foi possível substituir a conexão.");
      await deleteImportedData(auth.admin, auth.user.id, connection.id);
      return json({ ok: true, replaced: true, connection: { id: data.id }, preview: {
        accounts: accountList.length,
        bankAccounts: accountList.filter((account) => account.type !== "CREDIT").length,
        creditCards: accountList.filter((account) => account.type === "CREDIT").length,
      } });
    } catch (error) {
      return errorResponse(error);
    }
  }

  try {
    const itemId = parsed.data.itemId;
    const [item, accounts] = await Promise.all([
      pluggyFetch<PluggyItem>(`/items/${encodeURIComponent(itemId)}`),
      pluggyFetch<AccountList>(`/accounts?itemId=${encodeURIComponent(itemId)}`),
    ]);
    const accountList = Array.isArray(accounts) ? accounts as PluggyAccount[] : accounts.results ?? [];
    const products = Array.from(new Set([
      ...(item.connector?.products ?? []),
      ...accountList.map((account) => account.type === "CREDIT" ? "CREDIT_CARDS" : "ACCOUNTS"),
    ]));
    const displayName = parsed.data.displayName || item.connector?.name || `Pluggy ${itemId.slice(0, 8)}`;
    const { data, error } = await auth.admin
      .from("financial_connections")
      .upsert({
        user_id: auth.user.id,
        provider: "pluggy",
        external_item_id: itemId,
        display_name: displayName,
        status: "active",
        products,
        last_error: null,
      }, { onConflict: "user_id,provider,external_item_id" })
      .select("id,external_item_id,display_name,status,products,last_synced_at")
      .single();
    if (error || !data) return json({ error: "Item validado, mas não foi possível salvar a conexão." }, 502);

    return json({
      ok: true,
      connection: {
        id: data.id,
        itemId: data.external_item_id,
        displayName: data.display_name,
        status: data.status,
        products: data.products,
        lastSyncedAt: data.last_synced_at,
      },
      preview: {
        accounts: accountList.length,
        bankAccounts: accountList.filter((account) => account.type !== "CREDIT").length,
        creditCards: accountList.filter((account) => account.type === "CREDIT").length,
        itemStatus: item.status,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
