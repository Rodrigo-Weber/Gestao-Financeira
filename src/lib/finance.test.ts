import { describe, expect, it } from "vitest";
import type { FinanceData } from "../types";
import { accountBalance, calculateSummary, cashFlowSeries, createInstallments, getInvoiceDates, simulateDebtPayoff } from "./finance";

const base: FinanceData = {
  accounts: [{ id: "a", name: "Conta", institution: "", type: "checking", initialBalance: 1000, color: "#000", active: true }],
  categories: [],
  cards: [],
  debts: [],
  budgets: [],
  transactions: [
    { id: "1", description: "Receita", amount: 2000, kind: "income", status: "paid", dueDate: "2026-07-05", paidDate: "2026-07-05", competenceDate: "2026-07-05", source: "manual" },
    { id: "2", description: "Conta paga", amount: 500, kind: "expense", status: "paid", dueDate: "2026-07-08", paidDate: "2026-07-08", competenceDate: "2026-07-08", source: "manual" },
    { id: "3", description: "Conta futura", amount: 300, kind: "expense", status: "pending", dueDate: "2026-07-25", competenceDate: "2026-07-25", source: "manual" },
    { id: "4", description: "Compra cartão", amount: 150, kind: "card_purchase", status: "paid", dueDate: "2026-07-11", competenceDate: "2026-07-11", source: "manual" },
    { id: "5", description: "Transferência", amount: 400, kind: "transfer", status: "paid", dueDate: "2026-07-12", competenceDate: "2026-07-12", source: "manual" },
  ],
};

describe("financial calculations", () => {
  it("does not double count card purchases or transfers in cash flow", () => {
    const summary = calculateSummary(base, new Date(2026, 6, 10));
    expect(summary.realizedBalance).toBe(2500);
    expect(summary.projectedBalance).toBe(2200);
  });

  it("splits installments and preserves the exact total across years", () => {
    const items = createInstallments({ description: "Notebook", amount: 1000, date: "2026-11-30", installments: 3, cardId: "card" });
    expect(items.map((item) => item.amount)).toEqual([333.33, 333.33, 333.34]);
    expect(items.map((item) => item.dueDate)).toEqual(["2026-11-30", "2026-12-30", "2027-01-30"]);
    expect(items.every((item) => item.kind === "card_purchase")).toBe(true);
  });

  it("avalanche prioritizes the debt with the highest interest", () => {
    const result = simulateDebtPayoff([
      { id: "1", name: "Barata", creditor: "A", type: "loan", originalAmount: 1000, outstandingBalance: 1000, monthlyInterest: 1, minimumPayment: 100, dueDay: 1 },
      { id: "2", name: "Cara", creditor: "B", type: "loan", originalAmount: 1500, outstandingBalance: 1500, monthlyInterest: 4, minimumPayment: 100, dueDay: 1 },
    ], 200, "avalanche");
    expect(result.order[0]).toBe("Cara");
    expect(result.months).toBeGreaterThan(0);
  });

  it("moves purchases after closing to the next invoice and clamps short months", () => {
    const card = { closingDay: 28, dueDay: 5 };
    expect(getInvoiceDates("2027-02-27", card)).toEqual({ closingDate: "2027-02-28", dueDate: "2027-03-05", referenceMonth: "2027-03" });
    expect(getInvoiceDates("2027-02-28", card)).toEqual({ closingDate: "2027-02-28", dueDate: "2027-03-05", referenceMonth: "2027-03" });
    expect(getInvoiceDates("2027-03-29", card)).toEqual({ closingDate: "2027-04-28", dueDate: "2027-05-05", referenceMonth: "2027-05" });
  });

  it("creates a received income through the quick entry flow", () => {
    const [income] = createInstallments({ description: "Freela", amount: 450, date: "2026-07-30", installments: 1, kind: "income", status: "paid", accountId: "a" });
    expect(income.kind).toBe("income");
    expect(income.status).toBe("paid");
    expect(income.amount).toBe(450);
  });

  it("calculates current balances per account and preserves transfers", () => {
    const data: FinanceData = {
      ...base,
      accounts: [
        { ...base.accounts[0], initialBalance: 1000 },
        { id: "b", name: "Carteira", institution: "", type: "cash", initialBalance: 500, color: "#111", active: true },
      ],
      transactions: [
        { id: "in", description: "Receita", amount: 200, kind: "income", status: "paid", dueDate: "2026-07-05", paidDate: "2026-07-05", competenceDate: "2026-07-05", accountId: "a", source: "manual" },
        { id: "out", description: "Despesa", amount: 50, kind: "expense", status: "paid", dueDate: "2026-07-08", paidDate: "2026-07-08", competenceDate: "2026-07-08", accountId: "a", source: "manual" },
        { id: "move", description: "Saque", amount: 100, kind: "transfer", status: "paid", dueDate: "2026-07-09", paidDate: "2026-07-09", competenceDate: "2026-07-09", accountId: "a", destinationAccountId: "b", source: "manual" },
      ],
    };
    expect(accountBalance(data, "a", new Date(2026, 6, 30))).toBe(1050);
    expect(accountBalance(data, "b", new Date(2026, 6, 30))).toBe(600);
    expect(cashFlowSeries(data, new Date(2026, 6, 1)).find((item) => item.day === "10")?.saldo).toBe(1650);
  });
});
