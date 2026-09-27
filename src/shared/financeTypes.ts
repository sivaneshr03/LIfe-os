export const financeAccountTypeEnum = [
  'checking',
  'savings',
  'credit',
  'cash',
  'loan',
  'investment',
  'other',
] as const;
export type FinanceAccountType = (typeof financeAccountTypeEnum)[number];

export const financeTransactionTypeEnum = ['income', 'expense', 'transfer'] as const;
export type FinanceTransactionType = (typeof financeTransactionTypeEnum)[number];

export const budgetPeriodEnum = ['monthly', 'yearly'] as const;
export type BudgetPeriod = (typeof budgetPeriodEnum)[number];

export const debtStrategyEnum = ['snowball', 'avalanche'] as const;
export type DebtStrategy = (typeof debtStrategyEnum)[number];

export const financeDebtTypeEnum = [
  'credit_card',
  'loan',
  'mortgage',
  'money_borrowed',
  'money_given',
  'other',
] as const;
export type FinanceDebtType = (typeof financeDebtTypeEnum)[number];

export interface FinanceAccountData {
  id: string;
  userId: string;
  categoryId?: string | null;
  name: string;
  type: FinanceAccountType;
  currency: string; // ISO 4217, e.g. 'USD'
  balanceCents: number; // Signed integer minor units
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isArchived: boolean;
  sortOrder: number;
  transactionCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface FinanceTransactionSplitData {
  id: string;
  userId: string;
  transactionId: string;
  categoryId?: string | null;
  categoryName?: string | null;
  amountCents: number;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface FinanceTransactionData {
  id: string;
  userId: string;
  accountId: string;
  accountName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  type: FinanceTransactionType;
  amountCents: number; // Positive integer for magnitude
  transactionDate: string; // YYYY-MM-DD
  timestampMs: number;
  payee?: string | null;
  notes?: string | null;
  transferAccountId?: string | null;
  transferAccountName?: string | null;
  transferTransactionId?: string | null;
  isReconciled: boolean;
  hasSplits: boolean;
  splits?: FinanceTransactionSplitData[];
  createdAt: number;
  updatedAt: number;
}

export interface FinanceBudgetData {
  id: string;
  userId: string;
  categoryId: string;
  categoryName?: string | null;
  period: BudgetPeriod;
  yearMonth: string; // YYYY-MM or YYYY for yearly
  amountCents: number; // Integer minor units
  spentCents?: number; // Aggregated spent in period
  remainingCents?: number; // amountCents - spentCents
  percentageUsed?: number; // 0-100+
  rollover: boolean;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface FinanceContactData {
  id: string;
  userId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  totalGivenCents?: number;
  totalBorrowedCents?: number;
  netOwedCents?: number;
  createdAt: number;
  updatedAt: number;
}

export interface FinanceDebtData {
  id: string;
  userId: string;
  accountId?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  debtType: FinanceDebtType;
  name: string;
  creditor: string;
  totalOwedCents: number; // Initial principal / total amount
  remainingBalanceCents?: number; // Derived remaining balance
  totalPaidCents?: number; // Sum of principal payments
  interestRateBps: number; // Basis points (e.g. 18.5% = 1850 bps)
  minimumPaymentCents: number; // Integer minor units
  dueDate?: string | null; // YYYY-MM-DD
  targetPayoffDate?: string | null; // YYYY-MM-DD
  isPaidOff: boolean;
  isOverdue?: boolean;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface FinanceDebtPaymentData {
  id: string;
  userId: string;
  debtId: string;
  transactionId?: string | null;
  date: string; // YYYY-MM-DD
  amountCents: number; // Integer minor units
  principalCents?: number | null;
  interestCents?: number | null;
  notes?: string | null;
  createdAt: number;
}

export interface FinanceNetWorthSnapshotData {
  id: string;
  userId: string;
  yearMonth: string; // YYYY-MM
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  netWorthCents: number;
  currency: string;
  notes?: string | null;
  createdAt: number;
}

export interface NetWorthOverviewData {
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  netWorthCents: number;
  baseCurrency: string;
  asOfDate: string; // YYYY-MM-DD
  accountBreakdown: Array<{
    id: string;
    name: string;
    type: FinanceAccountType;
    balanceCents: number;
    isAsset: boolean;
  }>;
  recentSnapshots?: FinanceNetWorthSnapshotData[];
}

export interface FinanceSpendingCategoryBreakdown {
  categoryId: string;
  categoryName: string;
  color?: string | null;
  icon?: string | null;
  totalCents: number;
  percentageOfExpense: number; // 0 - 100
  transactionCount: number;
}

export interface FinanceTopPayee {
  payee: string;
  totalCents: number;
  transactionCount: number;
}

export interface FinanceTimeTrendPoint {
  periodKey: string; // YYYY-MM or YYYY-MM-DD
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  savingsRatePercentage: number;
}

export interface FinanceSpendingAnalysisData {
  period: BudgetPeriod;
  yearMonth?: string;
  year?: string;
  totalIncomeCents: number;
  totalExpenseCents: number;
  netSavingsCents: number;
  savingsRatePercentage: number;
  categoryBreakdown: FinanceSpendingCategoryBreakdown[];
  topPayees: FinanceTopPayee[];
  trend: FinanceTimeTrendPoint[];
}

export interface FinanceImportRowPreview {
  rowNumber: number;
  transactionDate: string;
  payee: string;
  amountCents: number;
  type: FinanceTransactionType;
  categoryName?: string | null;
  accountName?: string | null;
  notes?: string | null;
  isValid: boolean;
  isDuplicate: boolean;
  validationErrors: string[];
}

export interface FinanceImportPreviewData {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  rows: FinanceImportRowPreview[];
}

export interface FinanceImportCommitResult {
  importedCount: number;
  skippedCount: number;
  accountBalancesUpdated: number;
}

export interface FinanceOverviewData {
  netWorth: NetWorthOverviewData;
  monthlyIncomeCents: number;
  monthlyExpenseCents: number;
  monthlySavingsRatePercentage: number;
  activeBudgets: FinanceBudgetData[];
  activeDebts: FinanceDebtData[];
  contactsSummary?: {
    totalContacts: number;
    totalLentCents: number;
    totalBorrowedCents: number;
  };
}
