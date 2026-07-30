import { addMonths, differenceInCalendarDays, endOfMonth, format, isAfter, isBefore, isEqual, parseISO, startOfDay, startOfMonth, subDays } from "date-fns";
import type { CreditCard, FinanceData, PaymentMethod, Transaction } from "../types";

const inRange = (date: string, start: Date, end: Date) => {
  const value = parseISO(date);
  return (isAfter(value, start) || isEqual(value, start)) && (isBefore(value, end) || isEqual(value, end));
};

export function monthTransactions(transactions: Transaction[], month: Date) {
  return transactions.filter((item) => inRange(item.dueDate, startOfMonth(month), endOfMonth(month)) && item.status !== "cancelled");
}

export function calculateSummary(data: FinanceData, month = new Date()) {
  const monthItems = monthTransactions(data.transactions, month);
  const cashItems = monthItems.filter((item) => item.kind !== "card_purchase" && item.kind !== "transfer");
  const realizedIncome = cashItems.filter((item) => item.kind === "income" && item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
  const realizedExpense = cashItems.filter((item) => item.kind !== "income" && item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
  const pendingIncome = cashItems.filter((item) => item.kind === "income" && item.status !== "paid").reduce((sum, item) => sum + item.amount, 0);
  const pendingExpense = cashItems.filter((item) => item.kind !== "income" && item.status !== "paid").reduce((sum, item) => sum + item.amount, 0);
  const openingBalance = data.accounts.reduce((sum, account) => sum + account.initialBalance, 0);
  const today = new Date();
  const cutoff = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth() ? today : endOfMonth(month);
  const historicalPaid = data.transactions.filter((item) => {
    if (item.status !== "paid" || item.kind === "card_purchase" || item.kind === "transfer") return false;
    return !isAfter(parseISO(item.paidDate ?? item.dueDate), cutoff);
  });
  const realizedBalance = openingBalance +
    historicalPaid.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0) -
    historicalPaid.filter((item) => item.kind !== "income").reduce((sum, item) => sum + item.amount, 0);
  return {
    realizedIncome,
    realizedExpense,
    pendingIncome,
    pendingExpense,
    realizedBalance,
    projectedBalance: realizedBalance + pendingIncome - pendingExpense,
  };
}

export function accountBalance(data: FinanceData, accountId: string, cutoff = new Date()) {
  const account = data.accounts.find((item) => item.id === accountId);
  if (!account) return 0;
  return data.transactions.reduce((balance, item) => {
    if (item.status !== "paid" || item.kind === "card_purchase" || isAfter(parseISO(item.paidDate ?? item.dueDate), cutoff)) return balance;
    if (item.kind === "transfer") {
      if (item.accountId === accountId) return balance - item.amount;
      if (item.destinationAccountId === accountId) return balance + item.amount;
      return balance;
    }
    if (item.accountId !== accountId) return balance;
    return item.kind === "income" ? balance + item.amount : balance - item.amount;
  }, account.initialBalance);
}

export function categorySpend(data: FinanceData, month = new Date()) {
  const expenses = data.transactions.filter((item) =>
    item.kind !== "income" &&
    item.kind !== "transfer" &&
    item.kind !== "invoice_payment" &&
    item.status !== "cancelled" &&
    inRange(item.competenceDate, startOfMonth(month), endOfMonth(month)),
  );
  return data.categories
    .filter((category) => category.kind === "expense")
    .map((category) => ({
      name: category.name,
      color: category.color,
      value: expenses.filter((item) => item.categoryId === category.id).reduce((sum, item) => sum + item.amount, 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function cashFlowSeries(data: FinanceData, month = new Date()) {
  const items = monthTransactions(data.transactions, month).filter((item) => item.kind !== "card_purchase" && item.kind !== "transfer");
  const openingBalance = data.accounts.reduce((sum, account) => sum + accountBalance(data, account.id, subDays(startOfMonth(month), 1)), 0);
  return [...new Set([1, 5, 10, 15, 20, 25, endOfMonth(month).getDate()])].sort((a, b) => a - b).map((day) => {
    const cutoff = new Date(month.getFullYear(), month.getMonth(), day);
    const scoped = items.filter((item) => !isAfter(parseISO(item.dueDate), cutoff));
    const entradas = scoped.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    const saidas = scoped.filter((item) => item.kind !== "income").reduce((sum, item) => sum + item.amount, 0);
    return {
      day: String(day).padStart(2, "0"),
      entradas,
      saidas,
      saldo: openingBalance + entradas - saidas,
    };
  });
}

export interface SpendingGuide {
  cashBalance: number;
  committedUntilIncome: number;
  availableUntilIncome: number;
  weeklyAllowance: number;
  shortfall: number;
  boundaryDate: string;
  nextIncomeDate?: string;
  daysUntilBoundary: number;
}

export interface FinancialAlert {
  id: string;
  severity: "urgent" | "attention" | "positive";
  title: string;
  description: string;
  page: "transactions" | "cards" | "settings";
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function calculateSpendingGuide(data: FinanceData, referenceDate = new Date()): SpendingGuide {
  const reference = startOfDay(referenceDate);
  const nextIncome = data.transactions
    .filter((item) =>
      item.kind === "income" &&
      item.status !== "paid" &&
      item.status !== "cancelled" &&
      !isBefore(parseISO(item.dueDate), reference),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const boundary = nextIncome ? parseISO(nextIncome.dueDate) : endOfMonth(reference);
  const cashBalance = roundMoney(data.accounts.reduce((sum, account) => sum + accountBalance(data, account.id, reference), 0));
  const committedUntilIncome = roundMoney(data.transactions
    .filter((item) =>
      item.kind !== "income" &&
      item.kind !== "transfer" &&
      item.kind !== "card_purchase" &&
      item.status !== "paid" &&
      item.status !== "cancelled" &&
      !isAfter(parseISO(item.dueDate), boundary),
    )
    .reduce((sum, item) => sum + item.amount, 0));
  const rawAvailable = cashBalance - committedUntilIncome;
  const daysUntilBoundary = Math.max(1, differenceInCalendarDays(boundary, reference) + 1);
  const availableUntilIncome = roundMoney(Math.max(0, rawAvailable));
  const weeklyAllowance = roundMoney(availableUntilIncome / Math.max(1, daysUntilBoundary / 7));

  return {
    cashBalance,
    committedUntilIncome,
    availableUntilIncome,
    weeklyAllowance,
    shortfall: roundMoney(Math.max(0, -rawAvailable)),
    boundaryDate: format(boundary, "yyyy-MM-dd"),
    nextIncomeDate: nextIncome?.dueDate,
    daysUntilBoundary,
  };
}

export function financialAlerts(data: FinanceData, month = new Date(), referenceDate = new Date()): FinancialAlert[] {
  const alerts: FinancialAlert[] = [];
  const reference = startOfDay(referenceDate);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const monthKey = format(month, "yyyy-MM");
  const summary = calculateSummary(data, month);
  const guide = calculateSpendingGuide(data, reference);
  const overdue = data.transactions.filter((item) =>
    item.status !== "paid" &&
    item.status !== "cancelled" &&
    item.kind !== "income" &&
    isBefore(parseISO(item.dueDate), reference),
  );

  if (overdue.length) {
    const total = roundMoney(overdue.reduce((sum, item) => sum + item.amount, 0));
    alerts.push({
      id: "overdue",
      severity: "urgent",
      title: `${overdue.length} ${overdue.length === 1 ? "conta atrasada" : "contas atrasadas"}`,
      description: `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)} aguardando pagamento.`,
      page: "transactions",
    });
  }

  if (guide.shortfall > 0) {
    alerts.push({
      id: "cash-shortfall",
      severity: "urgent",
      title: "Saldo pode não cobrir compromissos",
      description: `Faltam ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(guide.shortfall)} até ${format(parseISO(guide.boundaryDate), "dd/MM")}.`,
      page: "transactions",
    });
  } else if (summary.projectedBalance < 0) {
    alerts.push({
      id: "negative-projection",
      severity: "urgent",
      title: "Mês termina no vermelho",
      description: `Projeção de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(summary.projectedBalance)}.`,
      page: "transactions",
    });
  }

  const monthProgress = isBefore(reference, monthStart)
    ? 0
    : isAfter(reference, monthEnd)
      ? 100
      : Math.round(reference.getDate() / monthEnd.getDate() * 100);
  const spentCategories = categorySpend(data, month);
  data.budgets.filter((item) => item.month === monthKey).forEach((budget) => {
    const category = data.categories.find((item) => item.id === budget.categoryId);
    const spent = spentCategories.find((item) => item.name === category?.name)?.value ?? 0;
    const percent = budget.limit ? Math.round(spent / budget.limit * 100) : 0;
    if (percent >= 100) {
      alerts.push({
        id: `budget-over-${budget.id}`,
        severity: "urgent",
        title: `${category?.name ?? "Categoria"} acima do limite`,
        description: `${percent}% do orçamento utilizado.`,
        page: "settings",
      });
    } else if (percent >= 75 && percent > monthProgress + 15) {
      alerts.push({
        id: `budget-pace-${budget.id}`,
        severity: "attention",
        title: `${category?.name ?? "Categoria"} em ritmo alto`,
        description: `${percent}% usado com ${monthProgress}% do mês transcorrido.`,
        page: "settings",
      });
    }
  });

  data.cards.forEach((card) => {
    const used = data.transactions
      .filter((item) => item.cardId === card.id && item.kind === "card_purchase" && item.status !== "cancelled" && item.competenceDate.startsWith(monthKey))
      .reduce((sum, item) => sum + item.amount, 0);
    const percent = card.limit ? Math.round(used / card.limit * 100) : 0;
    if (percent >= 90) {
      alerts.push({
        id: `card-limit-${card.id}`,
        severity: percent >= 100 ? "urgent" : "attention",
        title: `${card.name} perto do limite`,
        description: `${percent}% do limite utilizado.`,
        page: "cards",
      });
    }
  });

  if (!alerts.length) {
    alerts.push({
      id: "all-clear",
      severity: "positive",
      title: "Nenhuma urgência financeira",
      description: "Contas, limites e orçamentos sem alertas importantes.",
      page: "transactions",
    });
  }

  const severityOrder = { urgent: 0, attention: 1, positive: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export function createInstallments(draft: {
  description: string;
  amount: number;
  date: string;
  installments: number;
  categoryId?: string;
  accountId?: string;
  cardId?: string;
  source?: Transaction["source"];
  attachmentPath?: string;
  card?: CreditCard;
  recurringRuleId?: string;
  recurrence?: "none" | "monthly" | "yearly";
  kind?: "income" | "expense";
  status?: "paid" | "pending";
  paymentMethod?: PaymentMethod;
}): Transaction[] {
  const total = Math.max(1, draft.installments);
  const groupId = total > 1 ? crypto.randomUUID() : undefined;
  const installmentAmount = Math.round((draft.amount / total) * 100) / 100;
  return Array.from({ length: total }, (_, index) => {
    const purchaseDate = format(addMonths(parseISO(draft.date), index), "yyyy-MM-dd");
    const date = draft.card ? getInvoiceDates(purchaseDate, draft.card).dueDate : purchaseDate;
    return {
      id: crypto.randomUUID(),
      description: total > 1 ? `${draft.description} (${index + 1}/${total})` : draft.description,
      amount: index === total - 1 ? Math.round((draft.amount - installmentAmount * (total - 1)) * 100) / 100 : installmentAmount,
      kind: draft.cardId ? "card_purchase" : draft.kind ?? "expense",
      status: draft.cardId ? "paid" : index === 0 ? draft.status ?? "pending" : "pending",
      dueDate: date,
      competenceDate: purchaseDate,
      accountId: draft.accountId,
      cardId: draft.cardId,
      categoryId: draft.categoryId,
      installmentGroupId: groupId,
      recurringRuleId: draft.recurringRuleId,
      installmentNumber: total > 1 ? index + 1 : undefined,
      installmentTotal: total > 1 ? total : undefined,
      paymentMethod: draft.cardId ? "credit" : draft.paymentMethod,
      source: draft.source ?? "manual",
      attachmentPath: index === 0 ? draft.attachmentPath : undefined,
    };
  });
}

function clampedDate(year: number, month: number, day: number) {
  const lastDay = endOfMonth(new Date(year, month, 1)).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

export function getInvoiceDates(purchaseDate: string, card: Pick<CreditCard, "closingDay" | "dueDay">) {
  const purchase = parseISO(purchaseDate);
  let closing = clampedDate(purchase.getFullYear(), purchase.getMonth(), card.closingDay);
  if (isAfter(purchase, closing)) closing = clampedDate(addMonths(closing, 1).getFullYear(), addMonths(closing, 1).getMonth(), card.closingDay);
  const dueOffset = card.dueDay > card.closingDay ? 0 : 1;
  const dueBase = addMonths(closing, dueOffset);
  const due = clampedDate(dueBase.getFullYear(), dueBase.getMonth(), card.dueDay);
  return { closingDate: format(closing, "yyyy-MM-dd"), dueDate: format(due, "yyyy-MM-dd"), referenceMonth: format(due, "yyyy-MM") };
}

export function simulateDebtPayoff(debts: FinanceData["debts"], extraPayment: number, strategy: "snowball" | "avalanche") {
  const sorted = [...debts].sort((a, b) =>
    strategy === "snowball" ? a.outstandingBalance - b.outstandingBalance : b.monthlyInterest - a.monthlyInterest,
  );
  let months = 0;
  let interest = 0;
  let balances = sorted.map((debt) => ({ ...debt }));
  while (balances.some((debt) => debt.outstandingBalance > 0.01) && months < 600) {
    months++;
    let extra = extraPayment;
    for (const debt of balances) {
      if (debt.outstandingBalance <= 0) continue;
      const fee = debt.outstandingBalance * (debt.monthlyInterest / 100);
      interest += fee;
      debt.outstandingBalance += fee;
      const minimum = Math.min(debt.outstandingBalance, debt.minimumPayment);
      debt.outstandingBalance -= minimum;
    }
    for (const debt of balances) {
      if (extra <= 0 || debt.outstandingBalance <= 0) continue;
      const payment = Math.min(extra, debt.outstandingBalance);
      debt.outstandingBalance -= payment;
      extra -= payment;
    }
  }
  return { months, interest: Math.round(interest * 100) / 100, order: sorted.map((debt) => debt.name) };
}
