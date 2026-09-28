import { z } from 'zod';
import {
  financeAccountTypeEnum,
  financeTransactionTypeEnum,
  budgetPeriodEnum,
  financeDebtTypeEnum,
} from '../financeTypes';

// ==========================================
// ACCOUNT SCHEMAS
// ==========================================

export const financeAccountCreateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1, 'Account name is required').max(100).trim(),
  type: z.enum(financeAccountTypeEnum),
  currency: z
    .string()
    .length(3, 'Currency must be 3-letter ISO code')
    .toUpperCase()
    .default('INR'),
  initialBalanceCents: z
    .number()
    .int('Balance must be integer minor units (cents)')
    .min(0, 'Initial balance cannot be negative')
    .refine((n) => !isNaN(n) && isFinite(n), 'Invalid balance value')
    .default(0),
  description: z.string().max(500).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
});

export const financeAccountUpdateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1).max(100).trim().optional(),
  type: z.enum(financeAccountTypeEnum).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  isArchived: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// ==========================================
// TRANSACTION & SPLIT SCHEMAS
// ==========================================

export const financeTransactionSplitInputSchema = z.object({
  categoryId: z.string().optional().nullable(),
  amountCents: z
    .number()
    .int('Split amount must be integer minor units (cents)')
    .positive('Split amount must be positive'),
  notes: z.string().max(500).optional().nullable(),
});

export const financeTransactionCreateSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  categoryId: z.string().optional().nullable(),
  type: z.enum(financeTransactionTypeEnum),
  amountCents: z
    .number()
    .int('Amount must be integer minor units (cents)')
    .positive('Transaction amount must be positive')
    .refine((n) => !isNaN(n) && isFinite(n), 'Invalid amount value'),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  payee: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  transferAccountId: z.string().optional().nullable(),
  splits: z.array(financeTransactionSplitInputSchema).optional(),
});

export const financeTransferCreateSchema = z.object({
  fromAccountId: z.string().min(1, 'Source account is required'),
  toAccountId: z.string().min(1, 'Destination account is required'),
  amountCents: z
    .number()
    .int('Transfer amount must be integer minor units (cents)')
    .positive('Transfer amount must be positive')
    .refine((n) => !isNaN(n) && isFinite(n), 'Invalid transfer amount'),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  payee: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const financeTransactionUpdateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  amountCents: z
    .number()
    .int('Amount must be integer minor units (cents)')
    .positive('Amount must be positive')
    .optional(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payee: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isReconciled: z.boolean().optional(),
  splits: z.array(financeTransactionSplitInputSchema).optional(),
});

export const financeTransactionQuerySchema = z.object({
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  type: z.enum(financeTransactionTypeEnum).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().max(100).optional(),
  minAmountCents: z.coerce.number().int().optional(),
  maxAmountCents: z.coerce.number().int().optional(),
  isReconciled: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// ==========================================
// BUDGET SCHEMAS
// ==========================================

export const financeBudgetCreateSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  period: z.enum(budgetPeriodEnum).default('monthly'),
  yearMonth: z.string().min(4).max(10), // YYYY-MM or YYYY
  amountCents: z
    .number()
    .int('Budget amount must be integer minor units (cents)')
    .positive('Budget amount must be positive'),
  rollover: z.boolean().default(false),
  notes: z.string().max(500).optional().nullable(),
});

export const financeBudgetUpdateSchema = z.object({
  amountCents: z
    .number()
    .int('Budget amount must be integer minor units (cents)')
    .positive('Budget amount must be positive')
    .optional(),
  rollover: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
});

// ==========================================
// CONTACT SCHEMAS (Money Given/Borrowed)
// ==========================================

export const financeContactCreateSchema = z.object({
  name: z.string().min(1, 'Contact name is required').max(100).trim(),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const financeContactUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// ==========================================
// DEBT SCHEMAS
// ==========================================

export const financeDebtCreateSchema = z.object({
  accountId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  debtType: z.enum(financeDebtTypeEnum).default('loan'),
  name: z.string().min(1, 'Debt name is required').max(100).trim(),
  creditor: z.string().min(1, 'Creditor / Person name is required').max(100).trim(),
  totalOwedCents: z
    .number()
    .int('Total owed must be integer minor units (cents)')
    .positive('Total owed must be positive'),
  interestRateBps: z
    .number()
    .int('Interest rate must be basis points (e.g. 1850 for 18.5%)')
    .min(0)
    .default(0),
  minimumPaymentCents: z
    .number()
    .int('Minimum payment must be integer minor units (cents)')
    .min(0)
    .default(0),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  targetPayoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const financeDebtUpdateSchema = z.object({
  contactId: z.string().optional().nullable(),
  debtType: z.enum(financeDebtTypeEnum).optional(),
  name: z.string().min(1).max(100).trim().optional(),
  creditor: z.string().min(1).max(100).trim().optional(),
  totalOwedCents: z.number().int().min(0).optional(),
  interestRateBps: z.number().int().min(0).optional(),
  minimumPaymentCents: z.number().int().min(0).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  targetPayoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  isPaidOff: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
});

export const financeDebtPaymentCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  amountCents: z
    .number()
    .int('Payment amount must be integer minor units (cents)')
    .positive('Payment must be positive'),
  principalCents: z.number().int().min(0).optional().nullable(),
  interestCents: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// ==========================================
// NET WORTH SNAPSHOT SCHEMAS
// ==========================================

export const financeNetWorthSnapshotCreateSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM format'),
  notes: z.string().max(500).optional().nullable(),
});

// ==========================================
// SPENDING & SUMMARY REPORT SCHEMAS
// ==========================================

export const financeReportQuerySchema = z.object({
  period: z.enum(budgetPeriodEnum).default('monthly'),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
});

// ==========================================
// CSV IMPORT & EXPORT SCHEMAS
// ==========================================

export const financeImportPreviewSchema = z.object({
  accountId: z.string().min(1, 'Target account ID is required'),
  csvData: z.string().min(1, 'CSV content is required'),
  hasHeader: z.boolean().default(true),
});

export const financeImportCommitSchema = z.object({
  accountId: z.string().min(1, 'Target account ID is required'),
  rows: z.array(
    z.object({
      transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      payee: z.string().max(200).optional().nullable(),
      amountCents: z.number().int().positive(),
      type: z.enum(financeTransactionTypeEnum),
      categoryId: z.string().optional().nullable(),
      notes: z.string().max(1000).optional().nullable(),
    })
  ).min(1, 'At least one transaction row is required to import'),
});

export const financeExportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  entity: z.enum(['all', 'transactions', 'accounts', 'debts', 'budgets']).default('transactions'),
  accountId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
