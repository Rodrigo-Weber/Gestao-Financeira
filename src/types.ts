export type TransactionKind = "income" | "expense" | "transfer" | "card_purchase" | "invoice_payment" | "debt_payment";
export type TransactionStatus = "paid" | "pending" | "overdue" | "cancelled";

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: "checking" | "cash" | "savings";
  initialBalance: number;
  color: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: "income" | "expense";
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  kind: TransactionKind;
  status: TransactionStatus;
  dueDate: string;
  paidDate?: string;
  competenceDate: string;
  categoryId?: string;
  accountId?: string;
  destinationAccountId?: string;
  cardId?: string;
  debtId?: string;
  installmentGroupId?: string;
  recurringRuleId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  notes?: string;
  attachmentPath?: string;
  source: "manual" | "chat" | "audio" | "ocr";
}

export interface CreditCard {
  id: string;
  name: string;
  brand: string;
  lastDigits: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  color: string;
}

export interface Debt {
  id: string;
  name: string;
  creditor: string;
  type: "person" | "loan" | "installment";
  originalAmount: number;
  outstandingBalance: number;
  monthlyInterest: number;
  minimumPayment: number;
  dueDay: number;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string;
  limit: number;
}

export interface TransactionDraft {
  description: string;
  amount: number;
  kind: "income" | "expense";
  date: string;
  category?: string;
  installments: number;
  notes?: string;
  attachmentPath?: string;
  confidence?: number;
}

export interface FinanceData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  cards: CreditCard[];
  debts: Debt[];
  budgets: Budget[];
}
