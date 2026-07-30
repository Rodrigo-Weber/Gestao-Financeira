import { addDays, differenceInCalendarMonths, differenceInMonths, endOfMonth, format, isAfter, isBefore, parseISO, startOfMonth, subMonths } from "date-fns";
import type { FinanceData, FinancialGoal, Transaction } from "../types";
import { accountBalance, monthTransactions } from "./finance";

const round = (value: number) => Math.round(value * 100) / 100;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\d+/g, "").replace(/\s+/g, " ").trim();

function transactionFlow(transaction: Transaction) {
  if (transaction.kind === "income") return transaction.amount;
  if (transaction.kind === "transfer" || transaction.kind === "card_purchase") return 0;
  return -transaction.amount;
}

export function cashForecast(data: FinanceData, reference = new Date(), days = 90) {
  let balance = data.accounts.reduce((sum, account) => sum + accountBalance(data, account.id, reference), 0);
  const future = data.transactions
    .filter((item) => item.status !== "paid" && item.status !== "cancelled" && isAfter(parseISO(item.dueDate), reference))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  let cursor = 0;
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(reference, index + 1);
    while (cursor < future.length && !isAfter(parseISO(future[cursor].dueDate), date)) {
      balance += transactionFlow(future[cursor]);
      cursor += 1;
    }
    return { date: format(date, "yyyy-MM-dd"), balance: round(balance) };
  });
}

export function forecastSummary(data: FinanceData, reference = new Date()) {
  const series = cashForecast(data, reference, 90);
  const at = (days: number) => series[Math.min(days, series.length) - 1]?.balance ?? 0;
  const lowest = series.reduce((result, point) => point.balance < result.balance ? point : result, series[0] ?? { date: format(reference, "yyyy-MM-dd"), balance: 0 });
  return {
    series,
    days30: at(30),
    days60: at(60),
    days90: at(90),
    lowest,
    firstNegative: series.find((point) => point.balance < 0)?.date,
  };
}

const inferredClass: Record<string, "essential" | "fixed" | "flexible" | "eventual"> = {
  casa: "essential",
  alimentacao: "essential",
  transporte: "essential",
  saude: "essential",
  educacao: "fixed",
  lazer: "flexible",
  outros: "eventual",
};

export function categoryClassification(data: FinanceData, categoryId?: string) {
  const category = data.categories.find((item) => item.id === categoryId);
  if (!category || category.kind !== "expense") return "eventual" as const;
  return category.spendingClass ?? inferredClass[normalize(category.name)] ?? "flexible";
}

export function budgetPace(data: FinanceData, month = new Date(), reference = new Date()) {
  const key = format(month, "yyyy-MM");
  const elapsed = month.getFullYear() === reference.getFullYear() && month.getMonth() === reference.getMonth()
    ? reference.getDate() / endOfMonth(reference).getDate()
    : isBefore(month, startOfMonth(reference)) ? 1 : 0;
  return data.budgets.filter((budget) => budget.month === key).map((budget) => {
    const spent = data.transactions.filter((item) => item.categoryId === budget.categoryId && item.kind !== "income" && item.kind !== "invoice_payment" && item.status !== "cancelled" && item.competenceDate.startsWith(key)).reduce((sum, item) => sum + item.amount, 0);
    const used = budget.limit ? spent / budget.limit : 0;
    return {
      categoryId: budget.categoryId,
      name: data.categories.find((item) => item.id === budget.categoryId)?.name ?? "Categoria",
      spent: round(spent),
      limit: budget.limit,
      usedPercent: Math.round(used * 100),
      elapsedPercent: Math.round(elapsed * 100),
      status: used > 1 ? "over" : used > elapsed + .15 ? "attention" : "normal",
    };
  });
}

export function recurringIncome(data: FinanceData, reference = new Date()) {
  const start = subMonths(startOfMonth(reference), 3);
  const income = data.transactions.filter((item) => item.kind === "income" && item.status !== "cancelled" && !isBefore(parseISO(item.competenceDate), start));
  const groups = new Map<string, Transaction[]>();
  income.forEach((item) => {
    const key = normalize(item.description);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return income.map((item) => {
    const category = data.categories.find((entry) => entry.id === item.categoryId);
    const months = new Set((groups.get(normalize(item.description)) ?? []).map((entry) => entry.competenceDate.slice(0, 7))).size;
    return { transaction: item, recurring: category?.incomeClass === "recurring" || normalize(category?.name ?? "") === "salario" || months >= 2 };
  });
}

export function subscriptionInsights(data: FinanceData, reference = new Date()) {
  const start = subMonths(reference, 4);
  const groups = new Map<string, Transaction[]>();
  data.transactions.filter((item) => item.kind !== "income" && item.kind !== "invoice_payment" && item.status !== "cancelled" && !isBefore(parseISO(item.competenceDate), start)).forEach((item) => {
    const key = normalize(item.description);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return Array.from(groups.entries()).flatMap(([key, items]) => {
    const months = new Set(items.map((item) => item.competenceDate.slice(0, 7)));
    if (months.size < 2) return [];
    const amounts = items.map((item) => item.amount);
    const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const stable = amounts.every((amount) => Math.abs(amount - average) <= Math.max(2, average * .12));
    if (!stable) return [];
    return [{ key, name: items[0].description, monthly: round(average), annual: round(average * 12), occurrences: items.length }];
  }).sort((a, b) => b.monthly - a.monthly);
}

export function unusualExpenses(data: FinanceData, month = new Date()) {
  const currentKey = format(month, "yyyy-MM");
  const start = format(subMonths(startOfMonth(month), 3), "yyyy-MM-dd");
  return data.transactions.filter((item) => item.kind !== "income" && item.kind !== "invoice_payment" && item.status !== "cancelled" && item.competenceDate.startsWith(currentKey)).flatMap((item) => {
    const history = data.transactions.filter((entry) => entry.categoryId === item.categoryId && entry.kind !== "income" && entry.status !== "cancelled" && entry.competenceDate >= start && entry.competenceDate < `${currentKey}-01`);
    if (history.length < 2) return [];
    const average = history.reduce((sum, entry) => sum + entry.amount, 0) / history.length;
    return item.amount > average * 1.8 && item.amount - average > 50 ? [{ ...item, average: round(average), excess: round(item.amount - average) }] : [];
  }).sort((a, b) => b.excess - a.excess);
}

export function emergencyPlan(data: FinanceData, targetMonths = 6, reference = new Date()) {
  const start = subMonths(startOfMonth(reference), 3);
  const essentialTotal = data.transactions.filter((item) => item.kind !== "income" && item.kind !== "invoice_payment" && item.status !== "cancelled" && categoryClassification(data, item.categoryId) === "essential" && !isBefore(parseISO(item.competenceDate), start) && isBefore(parseISO(item.competenceDate), startOfMonth(reference))).reduce((sum, item) => sum + item.amount, 0);
  const monthlyEssential = round(essentialTotal / 3);
  const goal = (data.goals ?? []).find((item) => item.kind === "emergency");
  const accumulated = goal?.currentAmount ?? 0;
  const target = goal?.targetAmount ?? round(monthlyEssential * targetMonths);
  const remaining = Math.max(0, target - accumulated);
  const targetDate = goal?.targetDate ? parseISO(goal.targetDate) : addDays(reference, 365);
  const monthsLeft = Math.max(1, differenceInMonths(targetDate, reference));
  return {
    monthlyEssential,
    accumulated,
    target,
    remaining: round(remaining),
    coveredMonths: monthlyEssential ? round(accumulated / monthlyEssential) : 0,
    monthlyContribution: round(remaining / monthsLeft),
    progress: target ? Math.min(100, Math.round(accumulated / target * 100)) : 0,
  };
}

export function netWorth(data: FinanceData, reference = new Date()) {
  const accounts = data.accounts.reduce((sum, account) => sum + accountBalance(data, account.id, reference), 0);
  const investments = (data.investments ?? []).filter((item) => item.status !== "TOTAL_WITHDRAWAL").reduce((sum, item) => sum + item.balance, 0);
  const assets = (data.assets ?? []).reduce((sum, item) => sum + item.value, 0);
  const debts = data.debts.reduce((sum, item) => sum + item.outstandingBalance, 0);
  return { accounts: round(accounts), investments: round(investments), assets: round(assets), debts: round(debts), total: round(accounts + investments + assets - debts) };
}

export function incomeCommitment(data: FinanceData, month = new Date()) {
  const items = monthTransactions(data.transactions, month);
  const income = items.filter((item) => item.kind === "income" && item.status !== "cancelled").reduce((sum, item) => sum + item.amount, 0);
  const fixed = items.filter((item) => item.kind !== "income" && item.kind !== "invoice_payment" && categoryClassification(data, item.categoryId) === "fixed" && item.status !== "cancelled").reduce((sum, item) => sum + item.amount, 0);
  const debts = data.debts.reduce((sum, item) => sum + item.minimumPayment, 0);
  return { income: round(income), fixed: round(fixed), debts: round(debts), committed: round(fixed + debts), percent: income ? Math.round((fixed + debts) / income * 100) : 0, free: round(income - fixed - debts) };
}

export function goalPlan(goal: FinancialGoal, reference = new Date()) {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const months = goal.targetDate ? Math.max(1, differenceInCalendarMonths(parseISO(goal.targetDate), reference)) : 12;
  return { remaining: round(remaining), months, monthly: round(remaining / months), progress: goal.targetAmount ? Math.min(100, Math.round(goal.currentAmount / goal.targetAmount * 100)) : 0 };
}

export function simulatePurchase(data: FinanceData, amount: number, installments: number, reference = new Date()) {
  const forecast = forecastSummary(data, reference);
  const count = Math.max(1, installments);
  const installment = round(amount / count);
  const cashAfter = round(forecast.days30 - (count === 1 ? amount : installment));
  const goalMonthly = (data.goals ?? []).reduce((sum, goal) => sum + goalPlan(goal, reference).monthly, 0);
  return {
    installment,
    cashAfter,
    goalPressure: goalMonthly ? Math.round(installment / goalMonthly * 100) : 0,
    safe: cashAfter >= 0 && installment <= Math.max(0, incomeCommitment(data, reference).free) * .3,
  };
}

export function monthlyReview(data: FinanceData, month = new Date()) {
  const pace = budgetPace(data, month);
  const unusual = unusualExpenses(data, month);
  const subscriptions = subscriptionInsights(data, month);
  const commitment = incomeCommitment(data, month);
  const score = Math.max(0, 100 - pace.filter((item) => item.status === "over").length * 15 - unusual.length * 5 - (commitment.percent > 50 ? 20 : 0));
  return { score, budgetsOver: pace.filter((item) => item.status === "over").length, unusual: unusual.length, subscriptions: subscriptions.length, commitment: commitment.percent };
}
