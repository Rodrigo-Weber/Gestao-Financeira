import { z } from "zod";
import { authenticate, json } from "../lib/shared";
import { PluggyApiError, pluggyConfigured, pluggyFetch } from "../lib/pluggy";
import {
  initialBalanceFromSnapshot,
  mapPluggyBankAccount,
  mapPluggyCreditCard,
  mapPluggyInvestment,
  mapPluggyBill,
  mapPluggyLoan,
  mapPluggyTransaction,
  type PluggyAccount,
  type PluggyInvestment,
  type PluggyLoan,
  type PluggyTransaction,
  type PluggyBill,
} from "../lib/pluggy-sync";

const SyncRequest = z.object({ connectionId: z.string().uuid() });
const BATCH_SIZE = 250;
const MAX_TRANSACTION_PAGES = 40;

type AccountList = { results?: PluggyAccount[] };
type LoanList = { results?: PluggyLoan[] };
type InvestmentList = { results?: PluggyInvestment[] };
type TransactionList = { results?: PluggyTransaction[]; next?: string | null };
type BillList = { results?: PluggyBill[] };
type ExistingExternal = { id: string; external_id: string | null; external_account_id?: string | null };

function chunks<T>(values: T[], size = BATCH_SIZE) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));
}

function nextTransactionPath(next: string) {
  if (next.startsWith("?")) return `/v2/transactions${next}`;
  const parsed = new URL(next, "https://api.pluggy.ai");
  return `${parsed.pathname}${parsed.search}`;
}

async function listAllRows(queryFactory: (from: number, to: number) => PromiseLike<{ data: ExistingExternal[] | null; error: { message: string } | null }>) {
  const rows: ExistingExternal[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryFactory(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function fetchTransactions(accountId: string) {
  const transactions: PluggyTransaction[] = [];
  let path: string | null = `/v2/transactions?accountId=${encodeURIComponent(accountId)}`;
  for (let page = 0; path && page < MAX_TRANSACTION_PAGES; page += 1) {
    const response: TransactionList = await pluggyFetch<TransactionList>(path);
    transactions.push(...(response.results ?? []));
    path = response.next ? nextTransactionPath(response.next) : null;
  }
  if (path) throw new Error(`A conta ${accountId} excedeu o limite seguro de paginação.`);
  return transactions;
}

async function fetchBills(accountId: string) {
  try {
    const response = await pluggyFetch<BillList | PluggyBill[]>(`/bills?accountId=${encodeURIComponent(accountId)}`);
    return Array.isArray(response) ? response : response.results ?? [];
  } catch (error) {
    // Bills are optional across connectors. Unsupported products should not
    // make accounts and transactions fail to synchronize.
    if (error instanceof PluggyApiError && [400, 404, 405].includes(error.status)) return [];
    throw error;
  }
}

function publicError(error: unknown) {
  if (error instanceof PluggyApiError) return { message: error.message, status: error.status >= 400 && error.status < 600 ? error.status : 502 };
  return { message: error instanceof Error ? error.message : "Falha inesperada durante a sincronização.", status: 502 };
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  if (!pluggyConfigured()) return json({ error: "Credenciais Pluggy não configuradas no servidor." }, 503);

  const parsed = SyncRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Conexão inválida." }, 400);

  const { data: connection, error: connectionError } = await auth.admin
    .from("financial_connections")
    .select("id,external_item_id,display_name,status")
    .eq("id", parsed.data.connectionId)
    .eq("user_id", auth.user.id)
    .eq("provider", "pluggy")
    .maybeSingle();
  if (connectionError) return json({ error: "Não foi possível carregar a conexão." }, 502);
  if (!connection) return json({ error: "Conexão Pluggy não encontrada." }, 404);
  if (connection.status === "disconnected") return json({ error: "Conexão desconectada. Substitua ou vincule novamente o Item ID." }, 409);

  const now = new Date().toISOString();
  const { data: run, error: runError } = await auth.admin
    .from("financial_sync_runs")
    .insert({ user_id: auth.user.id, connection_id: connection.id, status: "running" })
    .select("id")
    .single();
  if (runError || !run) return json({ error: "Não foi possível iniciar o histórico de sincronização." }, 502);

  await auth.admin.from("financial_connections").update({ status: "syncing", last_error: null }).eq("id", connection.id);

  try {
    const [accountResponse, loanResponse, investmentResponse] = await Promise.all([
      pluggyFetch<AccountList>(`/accounts?itemId=${encodeURIComponent(connection.external_item_id)}`),
      pluggyFetch<LoanList>(`/loans?itemId=${encodeURIComponent(connection.external_item_id)}`),
      pluggyFetch<InvestmentList>(`/investments?itemId=${encodeURIComponent(connection.external_item_id)}&pageSize=500`),
    ]);
    const pluggyAccounts = accountResponse.results ?? [];
    const pluggyLoans = loanResponse.results ?? [];
    const pluggyInvestments = investmentResponse.results ?? [];
    if (!pluggyAccounts.length) throw new Error("A Pluggy não retornou contas para este Item ID.");

    const [existingAccounts, existingCards, existingDebts, existingInvestments, existingInvoices, categoryResult] = await Promise.all([
      auth.admin.from("accounts").select("id,external_id").eq("user_id", auth.user.id).eq("connection_id", connection.id).eq("external_provider", "pluggy"),
      auth.admin.from("credit_cards").select("id,external_id").eq("user_id", auth.user.id).eq("connection_id", connection.id).eq("external_provider", "pluggy"),
      auth.admin.from("debts").select("id,external_id").eq("user_id", auth.user.id).eq("connection_id", connection.id).eq("external_provider", "pluggy"),
      auth.admin.from("investments").select("id,external_id").eq("user_id", auth.user.id).eq("connection_id", connection.id).eq("external_provider", "pluggy"),
      auth.admin.from("card_invoices").select("id,external_id,card_id,reference_month").eq("user_id", auth.user.id).eq("connection_id", connection.id).eq("external_provider", "pluggy"),
      auth.admin.from("categories").select("id,name,kind").eq("user_id", auth.user.id),
    ]);
    if (existingAccounts.error || existingCards.error || existingDebts.error || existingInvestments.error || existingInvoices.error || categoryResult.error) throw new Error("Não foi possível preparar os dados locais.");

    const accountIds = new Map((existingAccounts.data ?? []).map((row) => [row.external_id, row.id]));
    const cardIds = new Map((existingCards.data ?? []).map((row) => [row.external_id, row.id]));
    const debtIds = new Map((existingDebts.data ?? []).map((row) => [row.external_id, row.id]));
    const investmentIds = new Map((existingInvestments.data ?? []).map((row) => [row.external_id, row.id]));
    const invoiceIds = new Map((existingInvoices.data ?? []).map((row) => [row.external_id, row.id]));
    const bankRows = pluggyAccounts.filter((account) => account.type === "BANK").map((account) => {
      const id = accountIds.get(account.id) || crypto.randomUUID();
      accountIds.set(account.id, id);
      return mapPluggyBankAccount(account, auth.user.id, connection.id, connection.display_name || "Pluggy", id, now);
    });
    const cardRows = pluggyAccounts.filter((account) => account.type === "CREDIT").map((account) => {
      const id = cardIds.get(account.id) || crypto.randomUUID();
      cardIds.set(account.id, id);
      return mapPluggyCreditCard(account, auth.user.id, connection.id, id, now);
    });
    const debtRows = pluggyLoans.map((loan) => {
      const id = debtIds.get(loan.id) || crypto.randomUUID();
      debtIds.set(loan.id, id);
      return mapPluggyLoan(loan, auth.user.id, connection.id, connection.display_name || "Pluggy", id, now);
    });
    const investmentRows = pluggyInvestments.map((investment) => {
      const id = investmentIds.get(investment.id) || crypto.randomUUID();
      investmentIds.set(investment.id, id);
      return mapPluggyInvestment(investment, auth.user.id, connection.id, connection.display_name || "Pluggy", id, now);
    });

    if (bankRows.length) {
      const { error } = await auth.admin.from("accounts").upsert(bankRows, { onConflict: "id" });
      if (error) throw new Error(`Falha ao salvar contas: ${error.message}`);
    }
    if (cardRows.length) {
      const { error } = await auth.admin.from("credit_cards").upsert(cardRows, { onConflict: "id" });
      if (error) throw new Error(`Falha ao salvar cartões: ${error.message}`);
    }
    const invoiceGroups = await Promise.all(pluggyAccounts.filter((account) => account.type === "CREDIT").map(async (account) => ({
      account,
      bills: await fetchBills(account.id),
    })));
    const invoiceRows = invoiceGroups.flatMap(({ account, bills }) => bills.map((bill) => {
      const cardId = cardIds.get(account.id);
      if (!cardId) return null;
      const id = invoiceIds.get(bill.id) || crypto.randomUUID();
      invoiceIds.set(bill.id, id);
      return mapPluggyBill(bill, auth.user.id, connection.id, cardId, id, now);
    }).filter((row) => row !== null));
    if (invoiceRows.length) {
      const { error } = await auth.admin.from("card_invoices").upsert(invoiceRows, { onConflict: "id" });
      if (error) throw new Error(`Falha ao salvar faturas: ${error.message}`);
    }
    const currentInvoiceIds = new Set(invoiceGroups.flatMap((group) => group.bills.map((bill) => bill.id)));
    const staleInvoiceIds = (existingInvoices.data ?? []).filter((row) => row.external_id && !currentInvoiceIds.has(row.external_id)).map((row) => row.id);
    for (const batch of chunks(staleInvoiceIds)) {
      const { error } = await auth.admin.from("card_invoices").delete().in("id", batch).eq("connection_id", connection.id).eq("user_id", auth.user.id);
      if (error) throw new Error("Falha ao remover faturas antigas.");
    }
    if (debtRows.length) {
      const { error } = await auth.admin.from("debts").upsert(debtRows, { onConflict: "id" });
      if (error) throw new Error(`Falha ao salvar empréstimos: ${error.message}`);
    }
    if (investmentRows.length) {
      const { error } = await auth.admin.from("investments").upsert(investmentRows, { onConflict: "id" });
      if (error) throw new Error(`Falha ao salvar investimentos: ${error.message}`);
    }

    const currentLoanIds = new Set(pluggyLoans.map((loan) => loan.id));
    const staleDebtIds = (existingDebts.data ?? []).filter((row) => row.external_id && !currentLoanIds.has(row.external_id)).map((row) => row.id);
    if (staleDebtIds.length) await auth.admin.from("debts").delete().in("id", staleDebtIds).eq("connection_id", connection.id);
    const currentInvestmentIds = new Set(pluggyInvestments.map((investment) => investment.id));
    const staleInvestmentIds = (existingInvestments.data ?? []).filter((row) => row.external_id && !currentInvestmentIds.has(row.external_id)).map((row) => row.id);
    if (staleInvestmentIds.length) await auth.admin.from("investments").delete().in("id", staleInvestmentIds).eq("connection_id", connection.id);

    const transactionGroups = await Promise.all(pluggyAccounts.map(async (account) => ({
      account,
      transactions: await fetchTransactions(account.id),
    })));
    const existingTransactions = await listAllRows((from, to) => auth.admin
      .from("transactions")
      .select("id,external_id,external_account_id")
      .eq("user_id", auth.user.id)
      .eq("connection_id", connection.id)
      .eq("external_provider", "pluggy")
      .range(from, to));
    const transactionIds = new Map(existingTransactions.map((row) => [row.external_id, row.id]));
    const transactionRows = transactionGroups.flatMap(({ account, transactions }) => transactions.map((transaction) => {
      const id = transactionIds.get(transaction.id) || crypto.randomUUID();
      transactionIds.set(transaction.id, id);
      return mapPluggyTransaction(transaction, {
        userId: auth.user.id,
        connectionId: connection.id,
        account,
        internalAccountId: accountIds.get(account.id),
        internalCardId: cardIds.get(account.id),
        categories: categoryResult.data ?? [],
        now,
      }, id);
    }).filter((row) => row !== null));

    for (const batch of chunks(transactionRows)) {
      const { error } = await auth.admin.from("transactions").upsert(batch, { onConflict: "id" });
      if (error) throw new Error(`Falha ao salvar transações: ${error.message}`);
    }

    const fetchedExternalIds = new Set(transactionGroups.flatMap((group) => group.transactions.map((transaction) => transaction.id)));
    const staleIds = existingTransactions.filter((row) => row.external_id && !fetchedExternalIds.has(row.external_id)).map((row) => row.id);
    for (const batch of chunks(staleIds)) {
      const { error } = await auth.admin.from("transactions").delete().in("id", batch).eq("user_id", auth.user.id);
      if (error) throw new Error(`Falha ao remover transações antigas: ${error.message}`);
    }
    const currentBankIds = new Set(pluggyAccounts.filter((account) => account.type === "BANK").map((account) => account.id));
    const staleAccountIds = (existingAccounts.data ?? []).filter((row) => row.external_id && !currentBankIds.has(row.external_id)).map((row) => row.id);
    for (const batch of chunks(staleAccountIds)) {
      const { error } = await auth.admin.from("accounts").delete().in("id", batch).eq("connection_id", connection.id).eq("user_id", auth.user.id);
      if (error) throw new Error("Falha ao remover contas antigas.");
    }
    const currentCardIds = new Set(pluggyAccounts.filter((account) => account.type === "CREDIT").map((account) => account.id));
    const staleCardIds = (existingCards.data ?? []).filter((row) => row.external_id && !currentCardIds.has(row.external_id)).map((row) => row.id);
    for (const batch of chunks(staleCardIds)) {
      const { error } = await auth.admin.from("credit_cards").delete().in("id", batch).eq("connection_id", connection.id).eq("user_id", auth.user.id);
      if (error) throw new Error("Falha ao remover cartões antigos.");
    }

    for (const bankRow of bankRows) {
      const snapshotRows = transactionRows.filter((row) => row?.external_account_id === bankRow.external_id);
      const initialBalance = initialBalanceFromSnapshot(Number(bankRow.reported_balance), snapshotRows);
      const { error } = await auth.admin.from("accounts").update({ initial_balance: initialBalance }).eq("id", bankRow.id).eq("user_id", auth.user.id);
      if (error) throw new Error(`Falha ao consolidar saldo: ${error.message}`);
    }

    const existingAccountIds = new Set((existingAccounts.data ?? []).map((row) => row.external_id));
    const existingCardIds = new Set((existingCards.data ?? []).map((row) => row.external_id));
    const existingDebtIds = new Set((existingDebts.data ?? []).map((row) => row.external_id));
    const existingInvestmentIds = new Set((existingInvestments.data ?? []).map((row) => row.external_id));
    const existingTransactionIds = new Set(existingTransactions.map((row) => row.external_id));
    const inserted = bankRows.filter((row) => !existingAccountIds.has(row.external_id)).length
      + cardRows.filter((row) => !existingCardIds.has(row.external_id)).length
      + debtRows.filter((row) => !existingDebtIds.has(row.external_id)).length
      + investmentRows.filter((row) => !existingInvestmentIds.has(row.external_id)).length
      + transactionRows.filter((row) => !existingTransactionIds.has(row!.external_id)).length;
    const updated = bankRows.length + cardRows.length + debtRows.length + investmentRows.length + transactionRows.length - inserted;
    const details = {
      accounts: bankRows.length,
      cards: cardRows.length,
      loans: debtRows.length,
      investments: investmentRows.length,
      invoices: invoiceRows.length,
      transactions: transactionRows.length,
      removed: staleIds.length + staleAccountIds.length + staleCardIds.length + staleDebtIds.length + staleInvestmentIds.length + staleInvoiceIds.length,
    };

    const snapshotMonth = `${now.slice(0, 7)}-01`;
    const [snapshotAccounts, snapshotInvestments, snapshotDebts, snapshotAssets] = await Promise.all([
      auth.admin.from("accounts").select("reported_balance,initial_balance").eq("user_id", auth.user.id).eq("active", true),
      auth.admin.from("investments").select("balance,metadata").eq("user_id", auth.user.id),
      auth.admin.from("debts").select("outstanding_balance").eq("user_id", auth.user.id).eq("active", true),
      auth.admin.from("financial_assets").select("value").eq("user_id", auth.user.id).eq("active", true),
    ]);
    if (!snapshotAccounts.error && !snapshotInvestments.error && !snapshotDebts.error && !snapshotAssets.error) {
      const accountsTotal = (snapshotAccounts.data ?? []).reduce((sum, row) => sum + Number(row.reported_balance ?? row.initial_balance ?? 0), 0);
      const investmentsTotal = (snapshotInvestments.data ?? []).reduce((sum, row) => {
        const metadata = row.metadata as { status?: string } | null;
        return metadata?.status === "TOTAL_WITHDRAWAL" ? sum : sum + Number(row.balance ?? 0);
      }, 0);
      const debtsTotal = (snapshotDebts.data ?? []).reduce((sum, row) => sum + Number(row.outstanding_balance ?? 0), 0);
      const assetsTotal = (snapshotAssets.data ?? []).reduce((sum, row) => sum + Number(row.value ?? 0), 0);
      await auth.admin.from("financial_snapshots").upsert({
        user_id: auth.user.id,
        reference_month: snapshotMonth,
        accounts_total: accountsTotal,
        investments_total: investmentsTotal,
        assets_total: assetsTotal,
        debts_total: debtsTotal,
        net_worth: accountsTotal + investmentsTotal + assetsTotal - debtsTotal,
      }, { onConflict: "user_id,reference_month" });
    }

    await Promise.all([
      auth.admin.from("financial_sync_runs").update({
        status: "success",
        inserted_count: inserted,
        updated_count: updated,
        details,
        finished_at: new Date().toISOString(),
      }).eq("id", run.id),
      auth.admin.from("financial_connections").update({
        status: "active",
        products: [
          ...(bankRows.length ? ["ACCOUNTS"] : []),
          ...(cardRows.length ? ["CREDIT_CARDS"] : []),
          ...(invoiceRows.length ? ["CREDIT_CARD_BILLS"] : []),
          ...(transactionRows.length ? ["TRANSACTIONS"] : []),
          ...(debtRows.length ? ["LOANS"] : []),
          ...(investmentRows.length ? ["INVESTMENTS"] : []),
        ],
        last_synced_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", connection.id),
    ]);

    return json({ ok: true, runId: run.id, inserted, updated, ...details });
  } catch (error) {
    const failure = publicError(error);
    await Promise.all([
      auth.admin.from("financial_sync_runs").update({
        status: "error",
        error_count: 1,
        details: { error: failure.message },
        finished_at: new Date().toISOString(),
      }).eq("id", run.id),
      auth.admin.from("financial_connections").update({
        status: "error",
        last_error: failure.message,
      }).eq("id", connection.id),
    ]);
    return json({ error: failure.message }, failure.status);
  }
};
