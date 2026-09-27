import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase } from './test-db';
import app from '../src/server/index';
import type {
  ApiSuccessResponse,
  InvestmentAssetData,
  InvestmentQuoteData,
  InvestmentPortfolioSummary,
  CsvImportResponse,
  FinanceOverviewData,
} from '../src/shared/types';

describe('Investment Engine & CSV Importer API Suite', () => {
  let testD1: D1Database;
  let disposeDb: () => Promise<void>;
  let userACookie: string;
  let userBCookie: string;

  beforeAll(async () => {
    const { db, dispose } = await createTestDatabase();
    testD1 = db;
    disposeDb = dispose;

    // 1. Bootstrap Admin (User A)
    const bootstrapRes = await app.request(
      '/api/auth/bootstrap',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Investor Alice',
          email: 'alice@investor.test',
          password: 'Password123!',
        }),
      },
      { DB: testD1 }
    );
    expect(bootstrapRes.status).toBe(201);
    const rawACookie = bootstrapRes.headers.get('set-cookie') || '';
    userACookie = rawACookie.split(';')[0];

    // 2. Generate invite & register User B (Bob)
    const inviteRes = await app.request(
      '/api/admin/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: userACookie,
        },
        body: JSON.stringify({
          email: 'bob@investor.test',
          role: 'user',
        }),
      },
      { DB: testD1 }
    );
    expect(inviteRes.status).toBe(201);
    const inviteJson = (await inviteRes.json()) as ApiSuccessResponse<{ code: string }>;
    const inviteCode = inviteJson.data.code;

    const registerBRes = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Investor Bob',
          email: 'bob@investor.test',
          password: 'Password123!',
          code: inviteCode,
        }),
      },
      { DB: testD1 }
    );
    expect(registerBRes.status).toBe(201);
    const rawBCookie = registerBRes.headers.get('set-cookie') || '';
    userBCookie = rawBCookie.split(';')[0];
  });

  afterAll(async () => {
    if (disposeDb) {
      await disposeDb();
    }
  });

  describe('Asset Creation & Micro-Unit Valuation API', () => {
    let aaplAssetId: string;

    it('creates a stock asset with fractional shares and initial valuation', async () => {
      // 10.5 shares AAPL @ avg cost $150.00 (15000 cents), latest price $180.00 (18000 cents)
      const res = await app.request(
        '/api/investments/assets',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            assetType: 'stock',
            shares: '10.5',
            avgCostBasisCents: 15000,
            latestPriceCents: 18000,
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<InvestmentAssetData>;
      expect(json.success).toBe(true);
      expect(json.data.symbol).toBe('AAPL');
      expect(json.data.unitsMicro).toBe(10_500_000); // 10.5 * 10^6
      expect(json.data.sharesFormatted).toBe('10.5');
      // Cost: 10.5 * $150.00 = $1,575.00 (157,500 cents)
      expect(json.data.totalCostBasisCents).toBe(157_500);
      // Market value: 10.5 * $180.00 = $1,890.00 (189,000 cents)
      expect(json.data.totalMarketValueCents).toBe(189_000);
      // Gain: +$315.00 (+20%)
      expect(json.data.unrealizedGainLossCents).toBe(31_500);
      expect(json.data.unrealizedGainLossPercentage).toBe(20);

      aaplAssetId = json.data.id;
    });

    it('creates a crypto asset with high precision fractional units', async () => {
      // 0.25 BTC @ avg cost $50,000.00 (5,000,000 cents), latest price $60,000.00 (6,000,000 cents)
      const res = await app.request(
        '/api/investments/assets',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            symbol: 'BTC',
            name: 'Bitcoin',
            assetType: 'crypto',
            shares: '0.25',
            avgCostBasisCents: 5_000_000,
            latestPriceCents: 6_000_000,
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<InvestmentAssetData>;
      expect(json.data.unitsMicro).toBe(250_000); // 0.25 * 10^6
      // Cost: 0.25 * $50,000 = $12,500 (1,250,000 cents)
      expect(json.data.totalCostBasisCents).toBe(1_250_000);
      // Market value: 0.25 * $60,000 = $15,000 (1,500,000 cents)
      expect(json.data.totalMarketValueCents).toBe(1_500_000);
      expect(json.data.unrealizedGainLossCents).toBe(250_000);
    });

    it('rejects duplicate asset symbol for same user with 409 Conflict', async () => {
      const res = await app.request(
        '/api/investments/assets',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            symbol: 'AAPL',
            name: 'Apple Duplicate',
            assetType: 'stock',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(409);
    });

    it('fetches single asset with quotes history', async () => {
      const res = await app.request(
        `/api/investments/assets/${aaplAssetId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<InvestmentAssetData & { quotes: InvestmentQuoteData[] }>;
      expect(json.data.symbol).toBe('AAPL');
      expect(Array.isArray(json.data.quotes)).toBe(true);
      expect(json.data.quotes.length).toBeGreaterThanOrEqual(1);
      expect(json.data.quotes[0].priceCents).toBe(18000);
    });

    it('records a new manual price quote and updates latest asset price', async () => {
      // Record new quote for AAPL: $190.00 (19000 cents)
      const res = await app.request(
        '/api/investments/quotes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            assetId: aaplAssetId,
            priceCents: 19000,
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<InvestmentQuoteData>;
      expect(json.data.priceCents).toBe(19000);

      // Verify asset valuation updated
      const assetRes = await app.request(
        `/api/investments/assets/${aaplAssetId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const assetJson = (await assetRes.json()) as ApiSuccessResponse<InvestmentAssetData>;
      expect(assetJson.data.latestPriceCents).toBe(19000);
      // New market value: 10.5 * $190.00 = $1,995.00 (199,500 cents)
      expect(assetJson.data.totalMarketValueCents).toBe(199_500);
    });

    it('updates asset parameters via PATCH', async () => {
      const res = await app.request(
        `/api/investments/assets/${aaplAssetId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            shares: '20', // updated from 10.5 to 20 shares
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<InvestmentAssetData>;
      expect(json.data.sharesFormatted).toBe('20');
      expect(json.data.unitsMicro).toBe(20_000_000);
      // 20 shares * $190.00 = $3,800.00 (380,000 cents)
      expect(json.data.totalMarketValueCents).toBe(380_000);
    });
  });

  describe('Portfolio Summary & Allocation API', () => {
    it('returns composite portfolio valuation and asset allocation percentages', async () => {
      const res = await app.request(
        '/api/investments/portfolio',
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<InvestmentPortfolioSummary>;
      expect(json.success).toBe(true);
      expect(json.data.assetCount).toBe(2); // AAPL + BTC
      expect(json.data.totalPortfolioValueCents).toBeGreaterThan(0);
      expect(json.data.totalCostBasisCents).toBeGreaterThan(0);
      expect(json.data.allocation.length).toBe(2); // stock + crypto

      const totalAllocationPct = json.data.allocation.reduce((sum, item) => sum + item.percentage, 0);
      expect(Math.round(totalAllocationPct)).toBeCloseTo(100, 0);
    });
  });

  describe('CSV Import Engine API', () => {
    it('performs a dry-run validation reporting invalid rows without database commits', async () => {
      const res = await app.request(
        '/api/investments/import/csv',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            dryRun: true,
            rows: [
              {
                symbol: 'VTI',
                name: 'Vanguard Total Stock Market',
                assetType: 'etf',
                shares: '50',
                avgCostPerShareCents: 22000,
                latestPriceCents: 24000,
              },
              {
                symbol: 'INVALID',
                name: 'Bad Row',
                assetType: 'stock',
                shares: 'not-a-number',
                avgCostPerShareCents: 1000,
              },
            ],
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<CsvImportResponse>;
      expect(json.data.dryRun).toBe(true);
      expect(json.data.totalRows).toBe(2);
      expect(json.data.errorCount).toBe(1);
      expect(json.data.issues[0].symbol).toBe('INVALID');
      expect(json.data.importedAssets.length).toBe(0);

      // Verify VTI was NOT inserted into database
      const checkRes = await app.request(
        '/api/investments/assets',
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const checkJson = (await checkRes.json()) as ApiSuccessResponse<InvestmentAssetData[]>;
      expect(checkJson.data.some((a) => a.symbol === 'VTI')).toBe(false);
    });

    it('batch imports holdings atomically and recalculates existing positions', async () => {
      const res = await app.request(
        '/api/investments/import/csv',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            dryRun: false,
            rows: [
              {
                symbol: 'VTI',
                name: 'Vanguard Total Stock Market ETF',
                assetType: 'etf',
                shares: '50',
                avgCostPerShareCents: 22000,
                latestPriceCents: 25000,
              },
              {
                symbol: 'MSFT',
                name: 'Microsoft Corp',
                assetType: 'stock',
                shares: '15',
                avgCostPerShareCents: 40000,
                latestPriceCents: 42000,
              },
            ],
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<CsvImportResponse>;
      expect(json.data.dryRun).toBe(false);
      expect(json.data.validCount).toBe(2);
      expect(json.data.errorCount).toBe(0);
      expect(json.data.importedAssets.length).toBe(2);

      // Verify assets now exist
      const listRes = await app.request(
        '/api/investments/assets',
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const listJson = (await listRes.json()) as ApiSuccessResponse<InvestmentAssetData[]>;
      expect(listJson.data.some((a) => a.symbol === 'VTI')).toBe(true);
      expect(listJson.data.some((a) => a.symbol === 'MSFT')).toBe(true);
    });
  });

  describe('Net Worth Integration', () => {
    it('integrates investment holdings market valuation into Net Worth calculations', async () => {
      const res = await app.request(
        '/api/finance/overview',
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<FinanceOverviewData>;
      expect(json.data.netWorth).toBeDefined();

      // Check accountBreakdown includes investments
      const investmentEntries = json.data.netWorth.accountBreakdown.filter(
        (acc) => acc.type === 'investment'
      );
      expect(investmentEntries.length).toBeGreaterThanOrEqual(1);
      expect(json.data.netWorth.totalAssetsCents).toBeGreaterThan(0);
      expect(json.data.netWorth.netWorthCents).toBeGreaterThan(0);
    });
  });

  describe('Investment Transactions Ledger API', () => {
    let aaplAssetId: string;

    beforeAll(async () => {
      const listRes = await app.request(
        '/api/investments/assets',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const listJson = (await listRes.json()) as ApiSuccessResponse<InvestmentAssetData[]>;
      const aapl = listJson.data.find((a) => a.symbol === 'AAPL');
      aaplAssetId = aapl!.id;
    });

    it('records a buy transaction and recalculates weighted average cost basis', async () => {
      const res = await app.request(
        '/api/investments/transactions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            assetId: aaplAssetId,
            type: 'buy',
            date: '2026-10-18',
            shares: '5',
            pricePerUnitCents: 20000, // $200.00
            feeCents: 500, // $5.00
            notes: 'Follow-on purchase on pullback',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.type).toBe('buy');
      expect(json.data.sharesFormatted).toBe('5');
    });

    it('records a sell transaction and computes realized profit in integer cents', async () => {
      const res = await app.request(
        '/api/investments/transactions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            assetId: aaplAssetId,
            type: 'sell',
            date: '2026-10-19',
            shares: '5',
            pricePerUnitCents: 22000, // $220.00
            feeCents: 500,
            notes: 'Partial profit taking',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.type).toBe('sell');
      expect(json.data.realizedGainCents).toBeGreaterThan(0);
    });

    it('records a dividend income transaction', async () => {
      const res = await app.request(
        '/api/investments/transactions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            assetId: aaplAssetId,
            type: 'dividend',
            date: '2026-10-20',
            pricePerUnitCents: 50, // $0.50 per share
            notes: 'Q3 Dividend payout',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.type).toBe('dividend');
      expect(json.data.totalAmountCents).toBeGreaterThan(0);
    });

    it('exports investment holdings as standard CSV', async () => {
      const res = await app.request(
        '/api/investments/export/csv',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const csv = await res.text();
      expect(csv).toContain('symbol,name,assetType,shares');
      expect(csv).toContain('AAPL');
    });
  });

  describe('Private Attachment Storage & Access Control', () => {
    let attachmentId: string;

    it('validates file uploads: rejects unpermitted MIME types with 400', async () => {
      const res = await app.request(
        '/api/attachments',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            entityType: 'note',
            entityId: 'note_123',
            fileName: 'malicious.exe',
            fileSize: 1024,
            mimeType: 'application/x-msdownload',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_FILE_TYPE');
    });

    it('validates and records allowed private attachment metadata', async () => {
      const res = await app.request(
        '/api/attachments',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            entityType: 'note',
            entityId: 'note_123',
            fileName: 'trade_confirmation.pdf',
            fileSize: 45000,
            mimeType: 'application/pdf',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.fileName).toBe('trade_confirmation.pdf');
      attachmentId = json.data.id;
    });

    it('allows owner (User A) to access authorized private download', async () => {
      const res = await app.request(
        `/api/attachments/${attachmentId}/download`,
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain('attachment; filename="trade_confirmation.pdf"');
    });

    it('blocks User B from downloading User A private attachment with 404 (anti-enumeration)', async () => {
      const res = await app.request(
        `/api/attachments/${attachmentId}/download`,
        { headers: { Cookie: userBCookie } },
        { DB: testD1 }
      );

      expect(res.status).toBe(404);
    });
  });

  describe('User Isolation & Security Directives', () => {
    it('strictly isolates investment assets: User B cannot view User A holdings', async () => {
      const resB = await app.request(
        '/api/investments/assets',
        {
          headers: { Cookie: userBCookie },
        },
        { DB: testD1 }
      );

      expect(resB.status).toBe(200);
      const jsonB = (await resB.json()) as ApiSuccessResponse<InvestmentAssetData[]>;
      // User B should have 0 holdings
      expect(jsonB.data.length).toBe(0);
    });

    it('blocks User B from recording quotes on User A asset with 400/404', async () => {
      // Find AAPL asset from User A
      const resA = await app.request(
        '/api/investments/assets',
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const jsonA = (await resA.json()) as ApiSuccessResponse<InvestmentAssetData[]>;
      const userAAsset = jsonA.data[0];

      // User B attempts to submit quote for User A's asset
      const quoteRes = await app.request(
        '/api/investments/quotes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userBCookie,
          },
          body: JSON.stringify({
            assetId: userAAsset.id,
            priceCents: 20000,
          }),
        },
        { DB: testD1 }
      );

      expect(quoteRes.status).toBe(400);
    });
  });
});

