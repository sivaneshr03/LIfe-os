import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { createDb } from '../db/client';
import { investmentAssets, investmentQuotes } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { toMicroUnits } from '../../shared/utils/investment';
import {
  listUserAssets,
  getPortfolioSummary,
  recordPriceQuote,
  processCsvImport,
  formatAssetData,
  recordInvestmentTransaction,
  listInvestmentTransactions,
  getInvestmentPerformance,
} from '../services/investmentService';
import {
  createInvestmentAssetSchema,
  updateInvestmentAssetSchema,
  createInvestmentQuoteSchema,
  createInvestmentTransactionSchema,
  investmentTransactionQuerySchema,
  csvImportPayloadSchema,
} from '../../shared/schemas/investment';
import type {
  ApiSuccessResponse,
  InvestmentAssetData,
  InvestmentQuoteData,
  InvestmentTransactionData,
  InvestmentPerformanceData,
  InvestmentPortfolioSummary,
  CsvImportResponse,
} from '../../shared/types';
import type { AppBindings } from '../index';

export const investmentsRouter = new Hono<{ Bindings: AppBindings }>();

investmentsRouter.use('*', requireAuth);

/**
 * GET /api/investments/portfolio
 * Aggregated portfolio summary, total market value, cost basis, unrealized/realized gain/loss, and asset allocation
 */
investmentsRouter.get('/portfolio', async (c) => {
  const user = c.get('user');
  const summary = await getPortfolioSummary(c.env.DB, user.id);
  return c.json<ApiSuccessResponse<InvestmentPortfolioSummary>>({ success: true, data: summary });
});

/**
 * GET /api/investments/performance
 */
investmentsRouter.get('/performance', async (c) => {
  const user = c.get('user');
  const timeframe = c.req.query('timeframe') || '30d';
  const performance = await getInvestmentPerformance(c.env.DB, user.id, timeframe);
  return c.json<ApiSuccessResponse<InvestmentPerformanceData>>({ success: true, data: performance });
});

/**
 * GET /api/investments/assets
 * Lists all user's held assets with live valuations
 */
investmentsRouter.get('/assets', async (c) => {
  const user = c.get('user');
  const assets = await listUserAssets(c.env.DB, user.id);
  return c.json<ApiSuccessResponse<InvestmentAssetData[]>>({ success: true, data: assets });
});

/**
 * GET /api/investments/transactions
 * Lists investment transactions
 */
investmentsRouter.get(
  '/transactions',
  zValidator('query', investmentTransactionQuerySchema),
  async (c) => {
    const user = c.get('user');
    const query = c.req.valid('query');
    const transactions = await listInvestmentTransactions(c.env.DB, user.id, query);
    return c.json<ApiSuccessResponse<InvestmentTransactionData[]>>({ success: true, data: transactions });
  }
);

/**
 * POST /api/investments/transactions
 * Records a buy, sell, dividend, fee, or transfer transaction
 */
investmentsRouter.post(
  '/transactions',
  zValidator('json', createInvestmentTransactionSchema),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');

    try {
      const tx = await recordInvestmentTransaction(c.env.DB, user.id, input);
      return c.json<ApiSuccessResponse<InvestmentTransactionData>>({ success: true, data: tx }, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record transaction';
      return c.json({ success: false, error: msg }, 400);
    }
  }
);

/**
 * GET /api/investments/assets/:id
 * Fetches a single asset with historical quotes
 */
investmentsRouter.get('/assets/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const asset = (
    await db
      .select()
      .from(investmentAssets)
      .where(and(eq(investmentAssets.id, id), eq(investmentAssets.userId, user.id)))
      .limit(1)
  )[0];

  if (!asset) {
    return c.json({ success: false, error: 'Investment asset not found' }, 404);
  }

  const quotes = await db
    .select()
    .from(investmentQuotes)
    .where(eq(investmentQuotes.assetId, asset.id))
    .orderBy(desc(investmentQuotes.recordedAt))
    .limit(50);

  const quoteData: InvestmentQuoteData[] = quotes.map((q) => ({
    id: q.id,
    assetId: q.assetId,
    priceCents: q.priceCents,
    recordedAt: q.recordedAt.getTime(),
    source: q.source as 'manual' | 'csv_import' | 'trade_derived',
  }));

  const data = {
    ...formatAssetData(asset),
    quotes: quoteData,
  };

  return c.json<ApiSuccessResponse<typeof data>>({ success: true, data });
});

/**
 * POST /api/investments/assets
 * Creates a new investment asset holding
 */
investmentsRouter.post(
  '/assets',
  zValidator('json', createInvestmentAssetSchema),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    const db = createDb(c.env.DB);

    const assetId = crypto.randomUUID();
    const now = new Date();
    const unitsMicro = toMicroUnits(input.shares ?? '0');

    // Check if asset symbol already exists for user
    const existing = (
      await db
        .select()
        .from(investmentAssets)
        .where(
          and(
            eq(investmentAssets.userId, user.id),
            eq(investmentAssets.symbol, input.symbol)
          )
        )
        .limit(1)
    )[0];

    if (existing) {
      return c.json(
        {
          success: false,
          error: `Asset with symbol ${input.symbol} already exists. Please update the existing holding or record a quote.`,
        },
        409
      );
    }

    const newAsset = {
      id: assetId,
      userId: user.id,
      accountId: input.accountId || null,
      symbol: input.symbol,
      name: input.name,
      assetType: input.assetType,
      unitsMicro,
      avgCostBasisCents: input.avgCostBasisCents,
      latestPriceCents: input.latestPriceCents,
      latestPriceAt: input.latestPriceCents > 0 ? now : null,
      realizedGainLossCents: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(investmentAssets).values(newAsset);

    if (input.latestPriceCents > 0) {
      await db.insert(investmentQuotes).values({
        id: crypto.randomUUID(),
        assetId,
        priceCents: input.latestPriceCents,
        recordedAt: now,
        source: 'manual',
      });
    }

    return c.json<ApiSuccessResponse<InvestmentAssetData>>(
      {
        success: true,
        data: formatAssetData(newAsset),
      },
      201
    );
  }
);

/**
 * PATCH /api/investments/assets/:id
 * Updates asset parameters or holding quantities
 */
investmentsRouter.patch(
  '/assets/:id',
  zValidator('json', updateInvestmentAssetSchema),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const input = c.req.valid('json');

    const asset = (
      await db
        .select()
        .from(investmentAssets)
        .where(and(eq(investmentAssets.id, id), eq(investmentAssets.userId, user.id)))
        .limit(1)
    )[0];

    if (!asset) {
      return c.json({ success: false, error: 'Asset not found' }, 404);
    }

    const updates: Partial<typeof investmentAssets.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.symbol !== undefined) updates.symbol = input.symbol;
    if (input.name !== undefined) updates.name = input.name;
    if (input.assetType !== undefined) updates.assetType = input.assetType;
    if (input.accountId !== undefined) updates.accountId = input.accountId;
    if (input.shares !== undefined) {
      updates.unitsMicro = toMicroUnits(input.shares);
    } else if (input.unitsMicro !== undefined) {
      updates.unitsMicro = input.unitsMicro;
    }
    if (input.avgCostBasisCents !== undefined) updates.avgCostBasisCents = input.avgCostBasisCents;
    if (input.latestPriceCents !== undefined) {
      updates.latestPriceCents = input.latestPriceCents;
      updates.latestPriceAt = new Date();
    }

    await db.update(investmentAssets).set(updates).where(eq(investmentAssets.id, id));

    const updated = (
      await db
        .select()
        .from(investmentAssets)
        .where(eq(investmentAssets.id, id))
        .limit(1)
    )[0];

    return c.json<ApiSuccessResponse<InvestmentAssetData>>({
      success: true,
      data: formatAssetData(updated),
    });
  }
);

/**
 * DELETE /api/investments/assets/:id
 * Removes asset and cascades historical quotes
 */
investmentsRouter.delete('/assets/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const asset = (
    await db
      .select()
      .from(investmentAssets)
      .where(and(eq(investmentAssets.id, id), eq(investmentAssets.userId, user.id)))
      .limit(1)
  )[0];

  if (!asset) {
    return c.json({ success: false, error: 'Asset not found' }, 404);
  }

  await db.delete(investmentAssets).where(eq(investmentAssets.id, id));

  return c.json<ApiSuccessResponse<{ deleted: boolean }>>({
    success: true,
    data: { deleted: true },
  });
});

/**
 * POST /api/investments/quotes
 * Records a manual price quote for an asset
 */
investmentsRouter.post(
  '/quotes',
  zValidator('json', createInvestmentQuoteSchema),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');

    try {
      const quote = await recordPriceQuote(c.env.DB, user.id, input);
      return c.json<ApiSuccessResponse<InvestmentQuoteData>>({ success: true, data: quote }, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record quote';
      return c.json({ success: false, error: msg }, 400);
    }
  }
);

/**
 * POST /api/investments/import/csv
 * Batch CSV portfolio holding ingestion with dry-run validation and atomic commits
 */
investmentsRouter.post(
  '/import/csv',
  zValidator('json', csvImportPayloadSchema),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');

    const result = await processCsvImport(c.env.DB, user.id, input);
    return c.json<ApiSuccessResponse<CsvImportResponse>>({ success: true, data: result }, 200);
  }
);

/**
 * GET /api/investments/export/csv
 * Exports holdings as standard CSV with formula injection sanitization
 */
investmentsRouter.get('/export/csv', async (c) => {
  const user = c.get('user');
  const assets = await listUserAssets(c.env.DB, user.id);

  const sanitizeField = (val: string | null | undefined): string => {
    if (!val) return '""';
    let str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  let csv = 'symbol,name,assetType,shares,avgCostBasisCents,latestPriceCents,totalMarketValueCents,totalCostBasisCents,unrealizedGainLossCents\n';
  for (const a of assets) {
    csv += `${sanitizeField(a.symbol)},${sanitizeField(a.name)},${sanitizeField(a.assetType)},${a.sharesFormatted},${a.avgCostBasisCents},${a.latestPriceCents},${a.totalMarketValueCents},${a.totalCostBasisCents},${a.unrealizedGainLossCents}\n`;
  }

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="investments_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
});

