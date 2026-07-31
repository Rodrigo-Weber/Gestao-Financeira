export type PluggyAccount = {
  id: string;
  type: "BANK" | "CREDIT";
  subtype?: string;
  name?: string;
  marketingName?: string;
  number?: string;
  balance?: number;
  currencyCode?: string;
  createdAt?: string;
  updatedAt?: string;
  bankData?: {
    closingBalance?: number;
  } | null;
  creditData?: {
    brand?: string;
    balanceCloseDate?: string;
    balanceDueDate?: string;
    availableCreditLimit?: number;
    creditLimit?: number;
    minimumPayment?: number;
    isLimitFlexible?: boolean;
    level?: string;
    holderType?: "MAIN" | "ADDITIONAL";
    status?: string;
    disaggregatedCreditLimits?: Array<{
      creditLineLimitType?: string;
      consolidationType?: string;
      identificationNumber?: string;
      isLimitFlexible?: boolean;
      usedAmount?: number;
      lineName?: string;
      limitAmount?: number;
      customizedLimitAmount?: number;
      availableAmount?: number;
      currencyCode?: string;
    }>;
  } | null;
};

export type PluggyBill = {
  id: string;
  dueDate: string;
  billClosingDate?: string | null;
  totalAmount: number;
  totalAmountCurrencyCode?: string;
  minimumPaymentAmount?: number;
  allowsInstallments?: boolean;
  payments?: Array<{ id?: string; valueType?: string; paymentDate?: string; paymentMode?: string; amount?: number; currencyCode?: string }>;
  financeCharges?: Array<{ id?: string; type?: string; amount?: number; currencyCode?: string; additionalInfo?: string }>;
};

export type PluggyTransaction = {
  id: string;
  description?: string;
  descriptionRaw?: string;
  amount: number;
  date: string;
  accountId: string;
  type?: "CREDIT" | "DEBIT";
  status?: string;
  category?: string;
  categoryId?: string;
  operationType?: string | null;
  merchant?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  paymentData?: {
    paymentMethod?: string;
  } | null;
  creditCardMetadata?: {
    installmentNumber?: number;
    totalInstallments?: number;
  } | null;
};

export type PluggyLoan = {
  id: string;
  productName?: string;
  type?: string;
  kind?: string;
  contractNumber?: string;
  contractAmount?: number;
  contractDate?: string;
  dueDate?: string;
  firstInstalmentDueDate?: string;
  /** Compatibilidade com payloads legados de alguns conectores. */
  firstInstallmentDueDate?: string;
  CET?: number;
  amortizationScheduled?: string;
  instalmentPeriodicity?: string;
  installmentPeriodicity?: string;
  interestRates?: Array<{
    taxPeriodicity?: string;
    preFixedRate?: number;
    postFixedRate?: number;
    referentialRateIndexerType?: string;
  }>;
  installments?: {
    totalNumberOfInstallments?: number;
    paidInstallments?: number;
    dueInstallments?: number;
    pastDueInstalments?: number;
    pastDueInstallments?: number;
  };
  payments?: {
    contractOutstandingBalance?: number;
    releases?: unknown[];
  };
  createdAt?: string;
  updatedAt?: string;
};

export type PluggyInvestment = {
  id: string;
  name: string;
  type?: string;
  subtype?: string;
  balance?: number;
  amount?: number;
  value?: number;
  quantity?: number;
  annualRate?: number;
  fixedAnnualRate?: number;
  rate?: number;
  rateType?: string;
  dueDate?: string;
  status?: string;
  amountProfit?: number;
  amountOriginal?: number;
  amountWithdrawal?: number;
  issuer?: string;
  institution?: { name?: string } | null;
  updatedAt?: string;
};

type CategoryRow = {
  id: string;
  name: string;
  kind: "income" | "expense";
};

type TransactionContext = {
  userId: string;
  connectionId: string;
  account: PluggyAccount;
  internalAccountId?: string;
  internalCardId?: string;
  categories: CategoryRow[];
  now: string;
};

const colors = ["#15976e", "#3f8ec7", "#6f5bd5", "#d48b3c", "#c65a72", "#2f9d91"];
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function normalized(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function dateOnly(value?: string) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : dateFormatter.format(parsed);
}

function validDay(value: string | undefined, fallback: number) {
  const day = Number(value?.slice(8, 10));
  return day >= 1 && day <= 31 ? day : fallback;
}

export function colorForExternalId(id: string) {
  const hash = Array.from(id).reduce((sum, char) => ((sum << 5) - sum + char.charCodeAt(0)) | 0, 0);
  return colors[Math.abs(hash) % colors.length];
}

export function mapPluggyBankAccount(account: PluggyAccount, userId: string, connectionId: string, institution: string, id: string, now: string) {
  return {
    id,
    user_id: userId,
    connection_id: connectionId,
    external_provider: "pluggy",
    external_id: account.id,
    name: account.marketingName || account.name || "Conta bancária",
    institution,
    type: account.subtype === "SAVINGS_ACCOUNT" ? "savings" : "checking",
    initial_balance: Number(account.balance ?? account.bankData?.closingBalance ?? 0),
    reported_balance: Number(account.balance ?? account.bankData?.closingBalance ?? 0),
    reported_balance_at: account.updatedAt || now,
    imported_at: now,
    color: colorForExternalId(account.id),
    active: true,
  };
}

export function mapPluggyCreditCard(account: PluggyAccount, userId: string, connectionId: string, id: string, now: string) {
  const digits = (account.number || "").replace(/\D/g, "").slice(-4);
  const creditData = account.creditData;
  const lines = creditData?.disaggregatedCreditLimits ?? [];
  const totalLines = lines.filter((line) => line.creditLineLimitType === "LIMITE_CREDITO_TOTAL");
  const preferredLines = totalLines.filter((line) => line.consolidationType === "CONSOLIDATED");
  const selectedLines = preferredLines.length ? preferredLines : totalLines;
  const lineValue = (field: "usedAmount" | "availableAmount" | "limitAmount" | "customizedLimitAmount") => {
    const values = selectedLines.map((line) => Number(line[field])).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : undefined;
  };
  const creditLimit = lineValue("customizedLimitAmount") ?? lineValue("limitAmount") ?? (Number.isFinite(creditData?.creditLimit) ? Number(creditData?.creditLimit) : undefined);
  const availableLimit = lineValue("availableAmount") ?? (Number.isFinite(creditData?.availableCreditLimit) ? Number(creditData?.availableCreditLimit) : undefined);
  const usedLimit = lineValue("usedAmount") ?? (creditLimit != null && availableLimit != null ? Math.max(0, creditLimit - availableLimit) : undefined);
  return {
    id,
    user_id: userId,
    connection_id: connectionId,
    external_provider: "pluggy",
    external_id: account.id,
    name: account.marketingName || account.name || "Cartão de crédito",
    brand: account.creditData?.brand || "",
    last_digits: /^\d{4}$/.test(digits) ? digits : null,
    credit_limit: Math.max(0, creditLimit ?? 0),
    available_limit: availableLimit == null ? null : Math.max(0, availableLimit),
    used_limit: usedLimit == null ? null : Math.max(0, usedLimit),
    reported_balance: Number(account.balance ?? 0),
    reported_balance_at: account.updatedAt || now,
    imported_at: now,
    closing_day: validDay(account.creditData?.balanceCloseDate, 1),
    due_day: validDay(account.creditData?.balanceDueDate, 10),
    metadata: {
      minimumPayment: creditData?.minimumPayment ?? null,
      isLimitFlexible: creditData?.isLimitFlexible ?? null,
      level: creditData?.level ?? null,
      holderType: creditData?.holderType ?? null,
      status: creditData?.status ?? null,
      disaggregatedCreditLimits: lines,
      currencyCode: account.currencyCode ?? "BRL",
    },
    color: colorForExternalId(account.id),
    active: account.creditData?.status !== "CANCELLED",
  };
}

function billStatus(bill: PluggyBill, now = new Date()) {
  const due = new Date(bill.dueDate);
  const paid = (bill.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const total = Number(bill.totalAmount ?? 0) + (bill.financeCharges ?? []).reduce((sum, charge) => sum + Number(charge.amount ?? 0), 0);
  if (total > 0 && paid >= total - 0.01) return "paid" as const;
  if (Number.isNaN(due.getTime())) return "open" as const;
  if (due < now) return "overdue" as const;
  return bill.billClosingDate ? "closed" as const : "open" as const;
}

export function mapPluggyBill(bill: PluggyBill, userId: string, connectionId: string, cardId: string, id: string, now: string) {
  const dueDate = dateOnly(bill.dueDate);
  const closingDate = bill.billClosingDate ? dateOnly(bill.billClosingDate) : null;
  return {
    id,
    user_id: userId,
    card_id: cardId,
    connection_id: connectionId,
    external_provider: "pluggy",
    external_id: bill.id,
    reference_month: `${dueDate.slice(0, 7)}-01`,
    closing_date: closingDate,
    due_date: dueDate,
    status: billStatus(bill, new Date(now)),
    total: Math.max(0, Number(bill.totalAmount ?? 0)),
    minimum_payment: bill.minimumPaymentAmount == null ? null : Math.max(0, Number(bill.minimumPaymentAmount)),
    paid_amount: (bill.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    allows_installments: bill.allowsInstallments ?? null,
    currency_code: bill.totalAmountCurrencyCode ?? "BRL",
    payments: bill.payments ?? [],
    finance_charges: bill.financeCharges ?? [],
    imported_at: now,
  };
}

function monthlyRate(loan: PluggyLoan) {
  const rate = loan.interestRates?.find((item) => Number.isFinite(item.preFixedRate))?.preFixedRate;
  if (!Number.isFinite(rate)) return 0;
  const decimal = Number(rate);
  const monthly = loan.interestRates?.[0]?.taxPeriodicity === "MONTHLY"
    ? decimal
    : Math.pow(1 + decimal, 1 / 12) - 1;
  return Math.round(monthly * 10000) / 100;
}

export function mapPluggyLoan(loan: PluggyLoan, userId: string, connectionId: string, creditor: string, id: string, now: string) {
  const outstanding = Math.max(0, Number(loan.payments?.contractOutstandingBalance ?? loan.contractAmount ?? 0));
  const total = Math.max(0, Number(loan.installments?.totalNumberOfInstallments ?? 0));
  const paid = Math.max(0, Number(loan.installments?.paidInstallments ?? 0));
  const providerRemaining = Math.max(0, Number(loan.installments?.dueInstallments ?? 0));
  const remaining = total > 0 && paid > 0 ? Math.max(0, total - paid) : providerRemaining;
  return {
    id,
    user_id: userId,
    connection_id: connectionId,
    external_provider: "pluggy",
    external_id: loan.id,
    name: loan.productName || "Empréstimo bancário",
    creditor,
    type: "loan",
    original_amount: Math.max(outstanding, Number(loan.contractAmount ?? 0)),
    outstanding_balance: outstanding,
    monthly_interest: monthlyRate(loan),
    minimum_payment: remaining > 0 ? Math.round(outstanding / remaining * 100) / 100 : 0,
    due_day: validDay(loan.firstInstalmentDueDate || loan.firstInstallmentDueDate || loan.dueDate, 10),
    annual_cet: Number.isFinite(loan.CET) ? Math.round(Number(loan.CET) * 10000) / 100 : null,
    total_installments: total || null,
    paid_installments: paid || null,
    remaining_installments: remaining || null,
    contract_end_date: loan.dueDate?.slice(0, 10) || null,
    source: "pluggy",
    metadata: {
      contractNumber: loan.contractNumber || null,
      contractDate: loan.contractDate || null,
      loanType: loan.type || null,
      amortization: loan.amortizationScheduled || null,
      periodicity: loan.instalmentPeriodicity || loan.installmentPeriodicity || null,
      pastDueInstallments: loan.installments?.pastDueInstalments ?? loan.installments?.pastDueInstallments ?? null,
      interestRates: loan.interestRates ?? [],
    },
    imported_at: now,
    active: outstanding > 0,
  };
}

export function mapPluggyInvestment(investment: PluggyInvestment, userId: string, connectionId: string, fallbackInstitution: string, id: string, now: string) {
  return {
    id,
    user_id: userId,
    connection_id: connectionId,
    external_provider: "pluggy",
    external_id: investment.id,
    name: investment.name || "Investimento",
    institution: investment.institution?.name || investment.issuer || fallbackInstitution,
    type: investment.type || "OTHER",
    balance: Math.max(0, Number(investment.balance ?? investment.amount ?? 0)),
    quantity: Number.isFinite(investment.quantity) ? Number(investment.quantity) : null,
    unit_value: Number.isFinite(investment.value) ? Number(investment.value) : null,
    annual_rate: Number.isFinite(investment.annualRate)
      ? Number(investment.annualRate)
      : Number.isFinite(investment.fixedAnnualRate)
        ? Number(investment.fixedAnnualRate)
        : null,
    due_date: investment.dueDate?.slice(0, 10) || null,
    metadata: {
      subtype: investment.subtype || null,
      status: investment.status || null,
      rate: investment.rate ?? null,
      rateType: investment.rateType || null,
      amountProfit: investment.amountProfit ?? null,
      amountOriginal: investment.amountOriginal ?? null,
      amountWithdrawal: investment.amountWithdrawal ?? null,
    },
    imported_at: now,
  };
}

function categoryTarget(transaction: PluggyTransaction, kind: "income" | "expense") {
  const value = normalized(`${transaction.category} ${transaction.description}`);
  if (kind === "income") return value.includes("salary") || value.includes("salario") ? "Salário" : "Renda extra";
  if (/food|grocery|restaurant|aliment|mercado|padaria/.test(value)) return "Alimentação";
  if (/transport|uber|taxi|fuel|gas station|vehicle|combust/.test(value)) return "Transporte";
  if (/health|pharmacy|hospital|medical|gym|fitness|saude|farmacia/.test(value)) return "Saúde";
  if (/education|school|course|book|educa/.test(value)) return "Educação";
  if (/stream|entertainment|music|game|travel|hotel|lazer/.test(value)) return "Lazer";
  if (/housing|electric|water|telecommunication|internet|utility|condominio|aluguel/.test(value)) return "Casa";
  return "Outros";
}

export function isCreditCardPayment(transaction: PluggyTransaction) {
  const value = normalized(`${transaction.category} ${transaction.description}`);
  return /credit card payment|pagamento.*fatura|fatura.*cartao/.test(value);
}

function categoryId(categories: CategoryRow[], target: string, kind: "income" | "expense") {
  const expected = normalized(target);
  return categories.find((category) => category.kind === kind && normalized(category.name) === expected)?.id ?? null;
}

export function mapPluggyTransaction(transaction: PluggyTransaction, context: TransactionContext, id: string) {
  const cardTransaction = context.account.type === "CREDIT";
  if (cardTransaction && isCreditCardPayment(transaction)) return null;
  const invoicePayment = !cardTransaction && isCreditCardPayment(transaction);
  const kind = cardTransaction
    ? transaction.amount < 0 ? "card_credit" : "card_purchase"
    : invoicePayment ? "invoice_payment"
      : transaction.type === "CREDIT" || transaction.amount > 0 ? "income" : "expense";
  const categoryKind = kind === "income" ? "income" : "expense";
  const date = dateOnly(transaction.date);
  const status = transaction.status === "CANCELLED" ? "cancelled" : transaction.status === "POSTED" ? "paid" : "pending";
  const paymentMethod = cardTransaction
    ? "credit"
    : transaction.paymentData?.paymentMethod === "PIX"
      ? "pix"
      : transaction.paymentData?.paymentMethod === "DEBIT_CARD"
        ? "debit"
        : null;
  const installmentTotal = Number(transaction.creditCardMetadata?.totalInstallments ?? 0);
  const installmentNumber = Number(transaction.creditCardMetadata?.installmentNumber ?? 0);
  const hasInstallments = installmentTotal > 1 && installmentNumber >= 1 && installmentNumber <= installmentTotal;

  return {
    id,
    user_id: context.userId,
    connection_id: context.connectionId,
    external_provider: "pluggy",
    external_id: transaction.id,
    external_account_id: transaction.accountId,
    description: transaction.description || transaction.descriptionRaw || "Transação bancária",
    amount: Math.abs(Number(transaction.amount || 0)),
    kind,
    status,
    due_date: date,
    paid_date: status === "paid" ? date : null,
    competence_date: date,
    category_id: kind === "invoice_payment" ? null : categoryId(context.categories, categoryTarget(transaction, categoryKind), categoryKind),
    account_id: cardTransaction ? null : context.internalAccountId,
    card_id: cardTransaction ? context.internalCardId : null,
    installment_number: hasInstallments ? installmentNumber : null,
    installment_total: hasInstallments ? installmentTotal : null,
    payment_method: paymentMethod,
    source: "pluggy",
    provider_status: transaction.status || null,
    provider_category: transaction.category || null,
    provider_amount: Number(transaction.amount || 0),
    provider_type: transaction.type || null,
    operation_type: transaction.operationType || null,
    merchant: transaction.merchant || null,
    provider_created_at: transaction.createdAt || null,
    provider_updated_at: transaction.updatedAt || null,
    imported_at: context.now,
  };
}

export function initialBalanceFromSnapshot(reportedBalance: number, transactions: ReturnType<typeof mapPluggyTransaction>[]) {
  const movement = transactions.reduce((sum, transaction) => {
    if (!transaction || transaction.status !== "paid" || transaction.kind === "card_purchase") return sum;
    return transaction.kind === "income" ? sum + transaction.amount : sum - transaction.amount;
  }, 0);
  return Math.round((reportedBalance - movement) * 100) / 100;
}
