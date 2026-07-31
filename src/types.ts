export type TransactionKind = "income" | "expense" | "transfer" | "card_purchase" | "invoice_payment" | "debt_payment";
export type TransactionStatus = "paid" | "pending" | "overdue" | "cancelled";
export type PaymentMethod = "pix" | "debit" | "credit";

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
  spendingClass?: "essential" | "fixed" | "flexible" | "eventual";
  incomeClass?: "recurring" | "eventual";
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
  paymentMethod?: PaymentMethod;
  source: "manual" | "chat" | "audio" | "ocr" | "pluggy";
}

export interface CreditCard {
  id: string;
  name: string;
  brand: string;
  lastDigits: string;
  limit: number;
  availableLimit?: number;
  usedLimit?: number;
  reportedBalance?: number;
  minimumPayment?: number;
  isLimitFlexible?: boolean;
  status?: "ACTIVE" | "BLOCKED" | "CANCELLED";
  level?: string;
  holderType?: "MAIN" | "ADDITIONAL";
  lastSyncedAt?: string;
  closingDay: number;
  dueDay: number;
  color: string;
}

export interface CardInvoice {
  id: string;
  cardId: string;
  referenceMonth: string;
  closingDate?: string;
  dueDate: string;
  status: "open" | "closed" | "paid" | "overdue";
  total: number;
  minimumPayment?: number;
  paidAmount?: number;
  allowsInstallments?: boolean;
  currencyCode?: string;
  source?: "manual" | "pluggy";
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
  annualCet?: number;
  totalInstallments?: number;
  paidInstallments?: number;
  remainingInstallments?: number;
  pastDueInstallments?: number;
  contractEndDate?: string;
  source?: "manual" | "pluggy";
}

export interface Investment {
  id: string;
  name: string;
  institution: string;
  type: string;
  balance: number;
  quantity?: number;
  unitValue?: number;
  annualRate?: number;
  dueDate?: string;
  subtype?: string;
  status?: string;
  amountProfit?: number;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  priority: 1 | 2 | 3;
  kind: "goal" | "emergency";
}

export interface AnnualFund {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  dueMonth: number;
}

export interface FinancialAsset {
  id: string;
  name: string;
  type: "property" | "vehicle" | "business" | "cash" | "other";
  value: number;
}

export interface FinancialSnapshot {
  id: string;
  referenceMonth: string;
  accountsTotal: number;
  investmentsTotal: number;
  assetsTotal: number;
  debtsTotal: number;
  netWorth: number;
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
  paymentMethod?: PaymentMethod;
  notes?: string;
  attachmentPath?: string;
  confidence?: number;
}

export interface FinanceData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  cards: CreditCard[];
  cardInvoices?: CardInvoice[];
  debts: Debt[];
  budgets: Budget[];
  investments?: Investment[];
  goals?: FinancialGoal[];
  annualFunds?: AnnualFund[];
  assets?: FinancialAsset[];
  snapshots?: FinancialSnapshot[];
}
