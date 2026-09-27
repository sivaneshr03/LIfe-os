import { z } from 'zod';
import { toMicroUnits } from '../utils/investment';

export const assetTypeEnum = z.enum(['stock', 'mutual_fund', 'etf', 'crypto', 'real_estate', 'other']);
export const quoteSourceEnum = z.enum(['manual', 'csv_import', 'trade_derived']);
export const investmentTransactionTypeEnum = z.enum([
  'buy',
  'sell',
  'dividend',
  'fee',
  'split',
  'transfer_in',
  'transfer_out',
]);

export const createInvestmentAssetSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol cannot exceed 20 characters')
    .toUpperCase(),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  assetType: assetTypeEnum,
  accountId: z.string().trim().optional().nullable(),
  shares: z.union([z.string(), z.number()]).optional().default('0'),
  avgCostBasisCents: z.number().int('Cost basis must be an integer in cents').min(0, 'Cost basis cannot be negative').default(0),
  latestPriceCents: z.number().int('Price must be an integer in cents').min(0, 'Price cannot be negative').default(0),
});

export const updateInvestmentAssetSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .toUpperCase()
    .optional(),
  name: z.string().trim().min(1).max(100).optional(),
  assetType: assetTypeEnum.optional(),
  accountId: z.string().trim().optional().nullable(),
  shares: z.union([z.string(), z.number()]).optional(),
  unitsMicro: z.number().int().min(0).optional(),
  avgCostBasisCents: z.number().int().min(0).optional(),
  latestPriceCents: z.number().int().min(0).optional(),
});

export const createInvestmentTransactionSchema = z.object({
  assetId: z.string().trim().min(1, 'Asset ID is required'),
  accountId: z.string().trim().optional().nullable(),
  type: investmentTransactionTypeEnum,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  shares: z.union([z.string(), z.number()]).optional().default('0'),
  pricePerUnitCents: z.number().int().min(0, 'Price must be non-negative').default(0),
  totalAmountCents: z.number().int().min(0, 'Amount must be non-negative').optional(),
  feeCents: z.number().int().min(0, 'Fee cannot be negative').default(0),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const investmentTransactionQuerySchema = z.object({
  assetId: z.string().optional(),
  accountId: z.string().optional(),
  type: investmentTransactionTypeEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createInvestmentQuoteSchema = z.object({
  assetId: z.string().trim().min(1, 'Asset ID is required'),
  priceCents: z.number().int('Price must be an integer in cents').positive('Price must be positive'),
  recordedAt: z.number().int().optional(),
  source: quoteSourceEnum.optional().default('manual'),
});

export const csvImportHoldingRowSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, 'Symbol is required')
    .max(20)
    .toUpperCase(),
  name: z.string().trim().min(1, 'Name is required').max(100),
  assetType: assetTypeEnum,
  shares: z
    .union([z.string(), z.number()])
    .refine((v) => {
      try {
        const micro = toMicroUnits(v);
        return micro >= 0;
      } catch {
        return false;
      }
    }, 'Invalid share quantity'),
  avgCostPerShareCents: z.number().int().min(0, 'Cost per share cannot be negative'),
  latestPriceCents: z.number().int().min(0, 'Latest price cannot be negative').optional(),
});

export const csvImportPayloadSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  rows: z
    .array(z.record(z.string(), z.any()))
    .min(1, 'At least one holding row is required')
    .max(500, 'Batch limit is 500 rows'),
});

export type CreateInvestmentAssetInput = z.infer<typeof createInvestmentAssetSchema>;
export type UpdateInvestmentAssetInput = z.infer<typeof updateInvestmentAssetSchema>;
export type CreateInvestmentTransactionInput = z.infer<typeof createInvestmentTransactionSchema>;
export type InvestmentTransactionQueryInput = z.infer<typeof investmentTransactionQuerySchema>;
export type CreateInvestmentQuoteInput = z.infer<typeof createInvestmentQuoteSchema>;
export type CsvImportHoldingRowInput = z.infer<typeof csvImportHoldingRowSchema>;
export type CsvImportPayloadInput = z.infer<typeof csvImportPayloadSchema>;

