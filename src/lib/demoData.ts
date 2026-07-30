import { format } from "date-fns";
import type { FinanceData } from "../types";

const month = format(new Date(), "yyyy-MM");
const date = (day: number) => `${month}-${String(day).padStart(2, "0")}`;

export const demoData: FinanceData = {
  accounts: [
    { id: "acc-1", name: "Conta principal", institution: "Nubank", type: "checking", initialBalance: 4250, color: "#18a77b", active: true },
    { id: "acc-2", name: "Carteira", institution: "Dinheiro", type: "cash", initialBalance: 180, color: "#d7a93b", active: true },
  ],
  categories: [
    { id: "cat-salario", name: "Salário", icon: "Wallet", color: "#33c99a", kind: "income" },
    { id: "cat-casa", name: "Casa", icon: "House", color: "#7467e8", kind: "expense" },
    { id: "cat-alimentacao", name: "Alimentação", icon: "Utensils", color: "#ef8f4d", kind: "expense" },
    { id: "cat-transporte", name: "Transporte", icon: "Car", color: "#48a4d8", kind: "expense" },
    { id: "cat-lazer", name: "Lazer", icon: "Sparkles", color: "#d65f98", kind: "expense" },
    { id: "cat-saude", name: "Saúde", icon: "Heart", color: "#e25c5c", kind: "expense" },
    { id: "cat-outros", name: "Outros", icon: "Shapes", color: "#7f8c86", kind: "expense" },
  ],
  transactions: [
    { id: "t1", description: "Salário", amount: 6200, kind: "income", status: "paid", dueDate: date(5), paidDate: date(5), competenceDate: date(5), categoryId: "cat-salario", accountId: "acc-1", source: "manual" },
    { id: "t2", description: "Aluguel", amount: 1650, kind: "expense", status: "paid", dueDate: date(8), paidDate: date(8), competenceDate: date(8), categoryId: "cat-casa", accountId: "acc-1", paymentMethod: "pix", source: "manual" },
    { id: "t3", description: "Supermercado", amount: 486.7, kind: "card_purchase", status: "paid", dueDate: date(12), paidDate: date(12), competenceDate: date(12), categoryId: "cat-alimentacao", cardId: "card-1", paymentMethod: "credit", source: "manual" },
    { id: "t4", description: "Fatura Nubank", amount: 1284.35, kind: "invoice_payment", status: "pending", dueDate: date(25), competenceDate: date(25), accountId: "acc-1", cardId: "card-1", source: "manual" },
    { id: "t5", description: "Internet", amount: 119.9, kind: "expense", status: "pending", dueDate: date(22), competenceDate: date(22), categoryId: "cat-casa", accountId: "acc-1", paymentMethod: "debit", source: "manual" },
    { id: "t6", description: "Parcela empréstimo", amount: 540, kind: "debt_payment", status: "pending", dueDate: date(28), competenceDate: date(28), debtId: "debt-1", accountId: "acc-1", source: "manual" },
    { id: "t7", description: "Combustível", amount: 220, kind: "card_purchase", status: "paid", dueDate: date(17), paidDate: date(17), competenceDate: date(17), categoryId: "cat-transporte", cardId: "card-1", paymentMethod: "credit", source: "manual" },
    { id: "t8", description: "Streaming", amount: 55.9, kind: "card_purchase", status: "paid", dueDate: date(19), paidDate: date(19), competenceDate: date(19), categoryId: "cat-lazer", cardId: "card-1", paymentMethod: "credit", source: "manual" },
  ],
  cards: [
    { id: "card-1", name: "Nubank Ultravioleta", brand: "Mastercard", lastDigits: "4821", limit: 8000, closingDay: 18, dueDay: 25, color: "#6f5bd5" },
    { id: "card-2", name: "Inter Gold", brand: "Mastercard", lastDigits: "1093", limit: 3500, closingDay: 8, dueDay: 15, color: "#d9782b" },
  ],
  debts: [
    { id: "debt-1", name: "Empréstimo pessoal", creditor: "Banco Inter", type: "loan", originalAmount: 9800, outstandingBalance: 6480, monthlyInterest: 2.1, minimumPayment: 540, dueDay: 28 },
    { id: "debt-2", name: "Dívida com Carlos", creditor: "Carlos", type: "person", originalAmount: 1800, outstandingBalance: 1200, monthlyInterest: 0, minimumPayment: 300, dueDay: 10 },
  ],
  budgets: [
    { id: "b1", categoryId: "cat-alimentacao", month, limit: 1100 },
    { id: "b2", categoryId: "cat-transporte", month, limit: 500 },
    { id: "b3", categoryId: "cat-lazer", month, limit: 350 },
  ],
};
