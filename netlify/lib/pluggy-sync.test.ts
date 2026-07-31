import { describe, expect, it } from "vitest";
import { initialBalanceFromSnapshot, mapPluggyBill, mapPluggyCreditCard, mapPluggyInvestment, mapPluggyLoan, mapPluggyTransaction, type PluggyAccount, type PluggyTransaction } from "./pluggy-sync";

const categories = [
  { id: "salary", name: "Salário", kind: "income" as const },
  { id: "home", name: "Casa", kind: "expense" as const },
  { id: "leisure", name: "Lazer", kind: "expense" as const },
  { id: "other", name: "Outros", kind: "expense" as const },
];
const bank: PluggyAccount = { id: "bank", type: "BANK", subtype: "CHECKING_ACCOUNT", balance: 1000 };
const card: PluggyAccount = { id: "card", type: "CREDIT", subtype: "CREDIT_CARD", balance: 200 };

function map(transaction: Partial<PluggyTransaction>, account = bank) {
  return mapPluggyTransaction({
    id: "transaction",
    description: "Compra",
    amount: -100,
    date: "2026-07-15T03:00:00.000Z",
    accountId: account.id,
    type: "DEBIT",
    status: "POSTED",
    ...transaction,
  }, {
    userId: "user",
    connectionId: "connection",
    account,
    internalAccountId: account.type === "BANK" ? "local-bank" : undefined,
    internalCardId: account.type === "CREDIT" ? "local-card" : undefined,
    categories,
    now: "2026-07-30T12:00:00.000Z",
  }, "local-transaction");
}

describe("Pluggy sync mapping", () => {
  it("maps bank credits as paid income and assigns salary", () => {
    const result = map({ amount: 8500, type: "CREDIT", description: "SALARIO EMPRESA", category: "Salary" });
    expect(result).toMatchObject({ kind: "income", amount: 8500, status: "paid", category_id: "salary", account_id: "local-bank" });
  });

  it("maps bank card payments without counting them as category spending", () => {
    const result = map({ description: "PAGAMENTO FATURA CARTAO", category: "Credit card payment" });
    expect(result).toMatchObject({ kind: "invoice_payment", category_id: null });
  });

  it("maps negative sandbox credit transactions as positive card purchases", () => {
    const result = map({ amount: -55.9, type: "CREDIT", description: "NETFLIX", category: "Video streaming" }, card);
    expect(result).toMatchObject({ kind: "card_purchase", amount: 55.9, payment_method: "credit", card_id: "local-card", category_id: "leisure" });
  });

  it("ignores the card-side copy of an invoice payment", () => {
    expect(map({ description: "Pagamento da fatura", category: "Credit card payment" }, card)).toBeNull();
  });

  it("anchors the opening balance to Pluggy's reported current balance", () => {
    const income = map({ id: "income", amount: 500, type: "CREDIT" });
    const expense = map({ id: "expense", amount: -100, type: "DEBIT" });
    expect(initialBalanceFromSnapshot(1000, [income, expense])).toBe(600);
  });

  it("maps Pluggy loans with outstanding balance and monthly interest", () => {
    const result = mapPluggyLoan({
      id: "loan",
      productName: "Crédito pessoal",
      contractAmount: 50000,
      CET: .29,
      firstInstallmentDueDate: "2026-08-15T00:00:00.000Z",
      dueDate: "2028-01-15T00:00:00.000Z",
      interestRates: [{ taxPeriodicity: "YEARLY", preFixedRate: .6 }],
      installments: { totalNumberOfInstallments: 60, paidInstallments: 20, dueInstallments: 40 },
      payments: { contractOutstandingBalance: 30000 },
    }, "user", "connection", "Banco", "local-loan", "2026-07-30T12:00:00.000Z");
    expect(result).toMatchObject({ outstanding_balance: 30000, annual_cet: 29, due_day: 15, remaining_installments: 40, source: "pluggy" });
    expect(result.monthly_interest).toBeGreaterThan(3);
  });

  it("maps investments using net balance", () => {
    const result = mapPluggyInvestment({ id: "investment", name: "CDB", type: "FIXED_INCOME", subtype: "CDB", balance: 2100, amount: 2200, fixedAnnualRate: 12, status: "ACTIVE" }, "user", "connection", "Banco", "local-investment", "2026-07-30T12:00:00.000Z");
    expect(result).toMatchObject({ name: "CDB", balance: 2100, annual_rate: 12, type: "FIXED_INCOME" });
  });

  it("prefers official disaggregated credit limits", () => {
    const result = mapPluggyCreditCard({ id: "card", type: "CREDIT", number: "4821", creditData: { creditLimit: 8000, availableCreditLimit: 7000, disaggregatedCreditLimits: [{ creditLineLimitType: "LIMITE_CREDITO_TOTAL", consolidationType: "CONSOLIDATED", limitAmount: 10000, availableAmount: 8400, usedAmount: 1600 }] } }, "user", "connection", "local-card", "2026-07-30T12:00:00.000Z");
    expect(result).toMatchObject({ credit_limit: 10000, available_limit: 8400, used_limit: 1600 });
  });

  it("maps a Pluggy bill without requiring a closing date", () => {
    const result = mapPluggyBill({ id: "bill", dueDate: "2026-08-15T00:00:00.000Z", totalAmount: 500, minimumPaymentAmount: 50 }, "user", "connection", "local-card", "local-bill", "2026-07-30T12:00:00.000Z");
    expect(result).toMatchObject({ card_id: "local-card", reference_month: "2026-08-01", closing_date: null, total: 500, status: "open" });
  });
});
