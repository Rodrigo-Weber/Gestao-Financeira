import { describe, expect, it } from "vitest";
import type { FinanceData } from "../types";
import { budgetPace, cashForecast, emergencyPlan, goalPlan, netWorth, recurringInsights, subscriptionInsights } from "./health";

const data: FinanceData = {
  accounts: [{ id: "a", name: "Conta", institution: "", type: "checking", initialBalance: 1000, color: "#000", active: true }],
  categories: [
    { id: "salary", name: "Salário", icon: "", color: "#0f0", kind: "income", incomeClass: "recurring" },
    { id: "home", name: "Casa", icon: "", color: "#00f", kind: "expense", spendingClass: "essential" },
    { id: "fun", name: "Lazer", icon: "", color: "#f00", kind: "expense", spendingClass: "flexible" },
  ],
  transactions: [
    { id: "past", description: "Aluguel", amount: 300, kind: "expense", status: "paid", dueDate: "2026-07-01", paidDate: "2026-07-01", competenceDate: "2026-07-01", categoryId: "home", accountId: "a", source: "manual" },
    { id: "future", description: "Conta de luz", amount: 200, kind: "expense", status: "pending", dueDate: "2026-08-05", competenceDate: "2026-08-05", categoryId: "home", accountId: "a", source: "manual" },
    { id: "netflix1", description: "Netflix", amount: 50, kind: "expense", status: "paid", dueDate: "2026-06-01", paidDate: "2026-06-01", competenceDate: "2026-06-01", categoryId: "fun", accountId: "a", source: "manual" },
    { id: "netflix2", description: "Netflix", amount: 50, kind: "expense", status: "paid", dueDate: "2026-07-01", paidDate: "2026-07-01", competenceDate: "2026-07-01", categoryId: "fun", accountId: "a", source: "manual" },
  ],
  cards: [],
  debts: [{ id: "d", name: "Empréstimo", creditor: "Banco", type: "loan", originalAmount: 1000, outstandingBalance: 600, monthlyInterest: 2, minimumPayment: 100, dueDay: 10 }],
  budgets: [{ id: "b", categoryId: "home", month: "2026-07", limit: 500 }],
  investments: [{ id: "i", name: "CDB", institution: "Banco", type: "FIXED_INCOME", balance: 500 }],
  assets: [{ id: "asset", name: "Carro", type: "vehicle", value: 10000 }],
  goals: [{ id: "g", name: "Reserva", targetAmount: 1200, currentAmount: 300, targetDate: "2027-07-30", priority: 1, kind: "emergency" }],
};

describe("financial health", () => {
  it("forecasts pending cash movements", () => {
    const result = cashForecast(data, new Date("2026-07-30T12:00:00"), 10);
    expect(result.at(-1)?.balance).toBe(400);
  });

  it("compares budget pace with elapsed month", () => {
    const result = budgetPace(data, new Date("2026-07-01T12:00:00"), new Date("2026-07-15T12:00:00"));
    expect(result[0]).toMatchObject({ spent: 300, usedPercent: 60 });
  });

  it("detects stable subscriptions", () => {
    expect(subscriptionInsights(data, new Date("2026-07-30T12:00:00"))[0]).toMatchObject({ name: "Netflix", monthly: 50, annual: 600 });
  });

  it("requires three monthly occurrences for a recurring insight", () => {
    const recurringData = { ...data, transactions: [...data.transactions, { id: "netflix3", description: "Netflix", amount: 50, kind: "expense" as const, status: "paid" as const, dueDate: "2026-08-01", paidDate: "2026-08-01", competenceDate: "2026-08-01", categoryId: "fun", accountId: "a", source: "manual" as const }] };
    expect(recurringInsights(recurringData, new Date("2026-08-15T12:00:00"))[0]).toMatchObject({ name: "Netflix", occurrences: 3, average: 50, intervalDays: 31 });
  });

  it("calculates emergency reserve contribution", () => {
    const result = emergencyPlan(data, 6, new Date("2026-07-30T12:00:00"));
    expect(result).toMatchObject({ target: 1200, accumulated: 300, remaining: 900 });
  });

  it("consolidates net worth", () => {
    expect(netWorth(data, new Date("2026-07-30T12:00:00")).total).toBe(10500);
  });

  it("calculates goal contribution", () => {
    expect(goalPlan(data.goals![0], new Date("2026-07-30T12:00:00")).monthly).toBe(75);
  });
});
