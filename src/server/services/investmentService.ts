import { eq, and, desc } from 'drizzle-orm';
import { createDb } from '../db/client';
import { investmentAssets, investmentQuotes, investmentTransactions } from '../db/schema';
import {
  toMicroUnits,
  fromMicroUnits,
  calculateHoldingMarketValue,
  calculateHoldingCostBasis,
  calculateUnrealizedGainLoss,
  calculateNewAvgCostBasis,
  calculateRealizedGainLoss,
  calculateDividendAmount,
} from '../../shared/utils/investment';
import type {
  InvestmentAssetData,
  InvestmentQuoteData,
  InvestmentPortfolioSummary,
  PortfolioAllocationItem,
  InvestmentTransactionData,
  InvestmentTransactionType,
  InvestmentPerformanceData,
  AssetType,
  CsvImportResponse,
  CsvImportValidationIssue,
} from '../../shared/types';
import type {
  CreateInvestmentQuoteInput,
  CsvImportPayloadInput,
} from '../../shared/schemas/investment';
import { csvImportHoldingRowSchema } from '../../shared/schemas/investment';

/**
 * Maps database asset row to complete InvestmentAssetData with valuation
 */
export function formatAssetData(asset: typeof investmentAssets.$inferSelect): InvestmentAssetData {
  const totalMarketValueCents = calculateHoldingMarketValue(asset.unitsMicro, asset.latestPriceCents);
  const totalCostBasisCents = calculateHoldingCostBasis(asset.unitsMicro, asset.avgCostBasisCents);
  const { gainLossCents, gainLossPercentage } = calculateUnrealizedGainLoss(
    totalMarketValueCents,
    totalCostBasisCents
  );

  return {
    id: asset.id,
    userId: asset.userId,
    accountId: asset.accountId || null,
    symbol: asset.symbol,
    name: asset.name,
    assetType: asset.assetType as AssetType,
    unitsMicro: asset.unitsMicro,
    sharesFormatted: fromMicroUnits(asset.unitsMicro),
    avgCostBasisCents: asset.avgCostBasisCents,
    latestPriceCents: asset.latestPriceCents,
    latestPriceAt: asset.latestPriceAt ? asset.latestPriceAt.getTime() : null,
    totalMarketValueCents,
    totalCostBasisCents,
    unrealizedGainLossCents: gainLossCents,
    unrealizedGainLossPercentage: gainLossPercentage,
    realizedGainLossCents: asset.realizedGainLossCents || 0,
    createdAt: asset.createdAt.getTime(),
    updatedAt: asset.updatedAt.getTime(),
  };
}

/**
 * List all assets owned by user with computed valuation
 */
export async function listUserAssets(d1: D1Database, userId: string): Promise<InvestmentAssetData[]> {
  const db = createDb(d1);
  const rows = await db
    .select()
    .from(investmentAssets)
    .where(eq(investmentAssets.userId, userId))
    .orderBy(investmentAssets.symbol);

  return rows.map(formatAssetData);
}

/**
 * Get portfolio summary metrics and allocation breakdown
 */
export async function getPortfolioSummary(
  d1: D1Database,
  userId: string
): Promise<InvestmentPortfolioSummary> {
  const db = createDb(d1);
  const assets = await listUserAssets(d1, userId);

  let totalPortfolioValueCents = 0;
  let totalCostBasisCents = 0;
  let totalRealizedGainLossCents = 0;

  const typeMap: Record<AssetType, number> = {
    stock: 0,
    mutual_fund: 0,
    etf: 0,
    crypto: 0,
    real_estate: 0,
    other: 0,
  };

  for (const a of assets) {
    totalPortfolioValueCents += a.totalMarketValueCents;
    totalCostBasisCents += a.totalCostBasisCents;
    totalRealizedGainLossCents += a.realizedGainLossCents;
    typeMap[a.assetType] = (typeMap[a.assetType] || 0) + a.totalMarketValueCents;
  }

  // Aggregate dividends & fees from transactions
  const txRows = await db
    .select()
    .from(investmentTransactions)
    .where(eq(investmentTransactions.userId, userId));

  let totalDividendsCents = 0;
  let totalFeesCents = 0;

  for (const tx of txRows) {
    if (tx.type === 'dividend') {
      totalDividendsCents += tx.totalAmountCents;
    }
    totalFeesCents += tx.feeCents || 0;
  }

  const { gainLossCents, gainLossPercentage } = calculateUnrealizedGainLoss(
    totalPortfolioValueCents,
    totalCostBasisCents
  );

  const allocation: PortfolioAllocationItem[] = (
    Object.keys(typeMap) as AssetType[]
  )
    .filter((type) => typeMap[type] > 0)
    .map((type) => {
      const val = typeMap[type];
      const pct =
        totalPortfolioValueCents > 0
          ? Math.round((val / totalPortfolioValueCents) * 10000) / 100
          : 0;
      return {
        assetType: type,
        marketValueCents: val,
        percentage: pct,
      };
    })
    .sort((a, b) => b.marketValueCents - a.marketValueCents);

  return {
    totalPortfolioValueCents,
    totalCostBasisCents,
    totalUnrealizedGainLossCents: gainLossCents,
    totalUnrealizedGainLossPercentage: gainLossPercentage,
    totalRealizedGainLossCents,
    totalDividendsCents,
    totalFeesCents,
    assetCount: assets.length,
    allocation,
  };
}

/**
 * Record a price quote for an asset and update latest price snapshot
 */
export async function recordPriceQuote(
  d1: D1Database,
  userId: string,
  input: CreateInvestmentQuoteInput
): Promise<InvestmentQuoteData> {
  const db = createDb(d1);

  // Verify asset ownership
  const asset = (
    await db
      .select()
      .from(investmentAssets)
      .where(and(eq(investmentAssets.id, input.assetId), eq(investmentAssets.userId, userId)))
      .limit(1)
  )[0];

  if (!asset) {
    throw new Error('Asset not found or access denied');
  }

  const quoteId = crypto.randomUUID();
  const recordedDate = input.recordedAt ? new Date(input.recordedAt) : new Date();
  const now = new Date();

  // Insert historical quote
  await db.insert(investmentQuotes).values({
    id: quoteId,
    assetId: asset.id,
    priceCents: input.priceCents,
    recordedAt: recordedDate,
    source: input.source || 'manual',
  });

  // Update latest price on asset
  await db
    .update(investmentAssets)
    .set({
      latestPriceCents: input.priceCents,
      latestPriceAt: recordedDate,
      updatedAt: now,
    })
    .where(eq(investmentAssets.id, asset.id));

  return {
    id: quoteId,
    assetId: asset.id,
    priceCents: input.priceCents,
    recordedAt: recordedDate.getTime(),
    source: (input.source as 'manual' | 'csv_import') || 'manual',
  };
}

/**
 * Process CSV holding imports with dry-run support, validation, and atomic commits
 */
export async function processCsvImport(
  d1: D1Database,
  userId: string,
  payload: CsvImportPayloadInput
): Promise<CsvImportResponse> {
  const db = createDb(d1);
  const issues: CsvImportValidationIssue[] = [];

  // 1. Dry run validation pass
  const validatedRows: Array<{
    rowNum: number;
    symbol: string;
    name: string;
    assetType: AssetType;
    unitsMicro: number;
    avgCostBasisCents: number;
    latestPriceCents: number;
  }> = [];

  for (let i = 0; i < payload.rows.length; i++) {
    const rawRow = payload.rows[i];
    const rowNum = i + 1;

    const parseResult = csvImportHoldingRowSchema.safeParse(rawRow);
    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        issues.push({
          row: rowNum,
          symbol: typeof rawRow.symbol === 'string' ? rawRow.symbol : undefined,
          field: issue.path.join('.') || 'row',
          message: issue.message,
        });
      }
      continue;
    }

    const row = parseResult.data;
    try {
      const unitsMicro = toMicroUnits(row.shares);
      if (unitsMicro < 0) {
        issues.push({
          row: rowNum,
          symbol: row.symbol,
          field: 'shares',
          message: 'Shares quantity cannot be negative',
        });
        continue;
      }

      const latestPrice = row.latestPriceCents !== undefined ? row.latestPriceCents : row.avgCostPerShareCents;

      validatedRows.push({
        rowNum,
        symbol: row.symbol.trim().toUpperCase(),
        name: row.name.trim(),
        assetType: row.assetType,
        unitsMicro,
        avgCostBasisCents: row.avgCostPerShareCents,
        latestPriceCents: latestPrice,
      });
    } catch (err: unknown) {
      issues.push({
        row: rowNum,
        symbol: row.symbol,
        field: 'shares',
        message: err instanceof Error ? err.message : 'Invalid share quantity format',
      });
    }
  }

  // If dry run requested or there are validation issues, do not commit
  if (payload.dryRun || issues.length > 0) {
    return {
      dryRun: payload.dryRun,
      totalRows: payload.rows.length,
      validCount: validatedRows.length,
      errorCount: issues.length,
      issues,
      importedAssets: [],
    };
  }

  // 2. Commit validated holdings
  const committedAssets: InvestmentAssetData[] = [];
  const now = new Date();

  for (const row of validatedRows) {
    // Check if asset already exists for user
    const existing = (
      await db
        .select()
        .from(investmentAssets)
        .where(
          and(
            eq(investmentAssets.userId, userId),
            eq(investmentAssets.symbol, row.symbol)
          )
        )
        .limit(1)
    )[0];

    if (existing) {
      // Calculate updated weighted average cost basis and new total units
      const updatedAvgCost = calculateNewAvgCostBasis(
        existing.unitsMicro,
        existing.avgCostBasisCents,
        row.unitsMicro,
        row.avgCostBasisCents
      );
      const updatedUnitsMicro = existing.unitsMicro + row.unitsMicro;
      const latestPrice = row.latestPriceCents > 0 ? row.latestPriceCents : existing.latestPriceCents;

      await db
        .update(investmentAssets)
        .set({
          unitsMicro: updatedUnitsMicro,
          avgCostBasisCents: updatedAvgCost,
          latestPriceCents: latestPrice,
          latestPriceAt: now,
          updatedAt: now,
        })
        .where(eq(investmentAssets.id, existing.id));

      if (row.latestPriceCents > 0) {
        await db.insert(investmentQuotes).values({
          id: crypto.randomUUID(),
          assetId: existing.id,
          priceCents: row.latestPriceCents,
          recordedAt: now,
          source: 'csv_import',
        });
      }

      committedAssets.push(
        formatAssetData({
          ...existing,
          unitsMicro: updatedUnitsMicro,
          avgCostBasisCents: updatedAvgCost,
          latestPriceCents: latestPrice,
          latestPriceAt: now,
          updatedAt: now,
        })
      );
    } else {
      // Create new asset
      const assetId = crypto.randomUUID();
      const newAsset = {
        id: assetId,
        userId,
        symbol: row.symbol,
        name: row.name,
        assetType: row.assetType,
        unitsMicro: row.unitsMicro,
        avgCostBasisCents: row.avgCostBasisCents,
        latestPriceCents: row.latestPriceCents,
        latestPriceAt: now,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(investmentAssets).values(newAsset);

      if (row.latestPriceCents > 0) {
        await db.insert(investmentQuotes).values({
          id: crypto.randomUUID(),
          assetId,
          priceCents: row.latestPriceCents,
          recordedAt: now,
          source: 'csv_import',
        });
      }

      committedAssets.push(formatAssetData(newAsset));
    }
  }

  return {
    dryRun: false,
    totalRows: payload.rows.length,
    validCount: committedAssets.length,
    errorCount: 0,
    issues: [],
    importedAssets: committedAssets,
  };
}

/**
 * Record a buy, sell, dividend, fee, or transfer transaction with atomic ledger updates
 */
export async function recordInvestmentTransaction(
  d1: D1Database,
  userId: string,
  input: {
    assetId: string;
    accountId?: string | null;
    type: 'buy' | 'sell' | 'dividend' | 'fee' | 'split' | 'transfer_in' | 'transfer_out';
    date: string;
    shares?: string | number;
    pricePerUnitCents?: number;
    totalAmountCents?: number;
    feeCents?: number;
    notes?: string | null;
  }
): Promise<InvestmentTransactionData> {
  const db = createDb(d1);
  const now = new Date();

  // Verify asset ownership
  const asset = (
    await db
      .select()
      .from(investmentAssets)
      .where(and(eq(investmentAssets.id, input.assetId), eq(investmentAssets.userId, userId)))
      .limit(1)
  )[0];

  if (!asset) {
    throw new Error('Investment asset not found or access denied');
  }

  const txId = crypto.randomUUID();
  const feeCents = input.feeCents || 0;
  const pricePerUnitCents = input.pricePerUnitCents || 0;
  const unitsMicro = input.shares !== undefined ? toMicroUnits(input.shares) : 0;

  let totalAmountCents = input.totalAmountCents || 0;
  let realizedGainCents: number | null = null;

  if (input.type === 'buy' || input.type === 'transfer_in') {
    if (unitsMicro <= 0) {
      throw new Error('Buy/Transfer quantity must be greater than zero');
    }
    totalAmountCents = totalAmountCents || Math.round((unitsMicro * pricePerUnitCents) / 1_000_000);
    const updatedAvgCost = calculateNewAvgCostBasis(
      asset.unitsMicro,
      asset.avgCostBasisCents,
      unitsMicro,
      pricePerUnitCents,
      feeCents
    );
    const updatedUnits = asset.unitsMicro + unitsMicro;

    await db
      .update(investmentAssets)
      .set({
        unitsMicro: updatedUnits,
        avgCostBasisCents: updatedAvgCost,
        latestPriceCents: pricePerUnitCents > 0 ? pricePerUnitCents : asset.latestPriceCents,
        latestPriceAt: pricePerUnitCents > 0 ? now : asset.latestPriceAt,
        updatedAt: now,
      })
      .where(eq(investmentAssets.id, asset.id));

    if (pricePerUnitCents > 0) {
      await db.insert(investmentQuotes).values({
        id: crypto.randomUUID(),
        assetId: asset.id,
        priceCents: pricePerUnitCents,
        recordedAt: now,
        source: 'trade_derived',
      });
    }
  } else if (input.type === 'sell' || input.type === 'transfer_out') {
    if (unitsMicro <= 0) {
      throw new Error('Sell/Transfer quantity must be greater than zero');
    }
    if (unitsMicro > asset.unitsMicro) {
      throw new Error(
        `Cannot sell ${fromMicroUnits(unitsMicro)} shares. Only ${fromMicroUnits(asset.unitsMicro)} shares currently held.`
      );
    }

    const pnl = calculateRealizedGainLoss(
      unitsMicro,
      pricePerUnitCents,
      feeCents,
      asset.avgCostBasisCents
    );

    totalAmountCents = totalAmountCents || pnl.grossProceedsCents;
    realizedGainCents = pnl.realizedGainCents;

    const updatedUnits = asset.unitsMicro - unitsMicro;
    const updatedRealized = (asset.realizedGainLossCents || 0) + pnl.realizedGainCents;

    await db
      .update(investmentAssets)
      .set({
        unitsMicro: updatedUnits,
        realizedGainLossCents: updatedRealized,
        latestPriceCents: pricePerUnitCents > 0 ? pricePerUnitCents : asset.latestPriceCents,
        latestPriceAt: pricePerUnitCents > 0 ? now : asset.latestPriceAt,
        updatedAt: now,
      })
      .where(eq(investmentAssets.id, asset.id));

    if (pricePerUnitCents > 0) {
      await db.insert(investmentQuotes).values({
        id: crypto.randomUUID(),
        assetId: asset.id,
        priceCents: pricePerUnitCents,
        recordedAt: now,
        source: 'trade_derived',
      });
    }
  } else if (input.type === 'dividend') {
    totalAmountCents =
      totalAmountCents ||
      (pricePerUnitCents > 0 ? calculateDividendAmount(asset.unitsMicro, pricePerUnitCents) : 0);
  } else if (input.type === 'fee') {
    totalAmountCents = totalAmountCents || feeCents;
  }

  await db.insert(investmentTransactions).values({
    id: txId,
    userId,
    assetId: asset.id,
    accountId: input.accountId || asset.accountId || null,
    type: input.type,
    date: input.date,
    unitsMicro,
    pricePerUnitCents,
    totalAmountCents,
    feeCents,
    realizedGainCents,
    notes: input.notes || null,
    createdAt: now,
  });

  return {
    id: txId,
    userId,
    assetId: asset.id,
    accountId: input.accountId || asset.accountId || null,
    symbol: asset.symbol,
    type: input.type,
    date: input.date,
    unitsMicro,
    sharesFormatted: fromMicroUnits(unitsMicro),
    pricePerUnitCents,
    totalAmountCents,
    feeCents,
    realizedGainCents,
    notes: input.notes || null,
    createdAt: now.getTime(),
  };
}

/**
 * List investment transactions for user with optional filters
 */
export async function listInvestmentTransactions(
  d1: D1Database,
  userId: string,
  filters?: {
    assetId?: string;
    accountId?: string;
    type?: InvestmentTransactionType;
    limit?: number;
    offset?: number;
  }
): Promise<InvestmentTransactionData[]> {
  const db = createDb(d1);
  const conditions = [eq(investmentTransactions.userId, userId)];

  if (filters?.assetId) {
    conditions.push(eq(investmentTransactions.assetId, filters.assetId));
  }
  if (filters?.accountId) {
    conditions.push(eq(investmentTransactions.accountId, filters.accountId));
  }
  if (filters?.type) {
    conditions.push(eq(investmentTransactions.type, filters.type));
  }

  const rows = await db
    .select({
      tx: investmentTransactions,
      symbol: investmentAssets.symbol,
    })
    .from(investmentTransactions)
    .innerJoin(investmentAssets, eq(investmentTransactions.assetId, investmentAssets.id))
    .where(and(...conditions))
    .orderBy(desc(investmentTransactions.date), desc(investmentTransactions.createdAt))
    .limit(filters?.limit || 50)
    .offset(filters?.offset || 0);

  return rows.map(({ tx, symbol }) => ({
    id: tx.id,
    userId: tx.userId,
    assetId: tx.assetId,
    accountId: tx.accountId,
    symbol,
    type: tx.type as InvestmentTransactionType,
    date: tx.date,
    unitsMicro: tx.unitsMicro,
    sharesFormatted: fromMicroUnits(tx.unitsMicro),
    pricePerUnitCents: tx.pricePerUnitCents,
    totalAmountCents: tx.totalAmountCents,
    feeCents: tx.feeCents,
    realizedGainCents: tx.realizedGainCents,
    notes: tx.notes,
    createdAt: tx.createdAt.getTime(),
  }));
}

/**
 * Get historical portfolio performance curve
 */
export async function getInvestmentPerformance(
  d1: D1Database,
  userId: string,
  timeframe: string = '30d'
): Promise<InvestmentPerformanceData> {
  const summary = await getPortfolioSummary(d1, userId);
  const today = new Date().toISOString().split('T')[0];

  const points = [
    {
      date: today,
      portfolioValueCents: summary.totalPortfolioValueCents,
      costBasisCents: summary.totalCostBasisCents,
      cumulativeReturnPercentage: summary.totalUnrealizedGainLossPercentage,
    },
  ];

  const totalReturnCents =
    summary.totalUnrealizedGainLossCents +
    summary.totalRealizedGainLossCents +
    summary.totalDividendsCents -
    summary.totalFeesCents;

  const totalReturnPercentage =
    summary.totalCostBasisCents > 0
      ? Math.round((totalReturnCents / summary.totalCostBasisCents) * 10000) / 100
      : 0;

  return {
    timeframe,
    points,
    totalReturnCents,
    totalReturnPercentage,
  };
}

