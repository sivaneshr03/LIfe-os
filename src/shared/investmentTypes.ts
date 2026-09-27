export type AssetType = 'stock' | 'mutual_fund' | 'etf' | 'crypto' | 'real_estate' | 'other';
export type QuoteSource = 'manual' | 'csv_import' | 'trade_derived';
export type InvestmentTransactionType =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'fee'
  | 'split'
  | 'transfer_in'
  | 'transfer_out';

export interface InvestmentAssetData {
  id: string;
  userId: string;
  accountId?: string | null;
  symbol: string;
  name: string;
  assetType: AssetType;
  unitsMicro: number;
  sharesFormatted: string;
  avgCostBasisCents: number;
  latestPriceCents: number;
  latestPriceAt: number | null;
  totalMarketValueCents: number;
  totalCostBasisCents: number;
  unrealizedGainLossCents: number;
  unrealizedGainLossPercentage: number;
  realizedGainLossCents: number;
  createdAt: number;
  updatedAt: number;
}

export interface InvestmentTransactionData {
  id: string;
  userId: string;
  assetId: string;
  accountId?: string | null;
  symbol: string;
  type: InvestmentTransactionType;
  date: string;
  unitsMicro: number;
  sharesFormatted: string;
  pricePerUnitCents: number;
  totalAmountCents: number;
  feeCents: number;
  realizedGainCents: number | null;
  notes: string | null;
  createdAt: number;
}

export interface InvestmentQuoteData {
  id: string;
  assetId: string;
  priceCents: number;
  recordedAt: number;
  source: QuoteSource;
}

export interface PortfolioAllocationItem {
  assetType: AssetType;
  marketValueCents: number;
  percentage: number;
}

export interface InvestmentPortfolioSummary {
  totalPortfolioValueCents: number;
  totalCostBasisCents: number;
  totalUnrealizedGainLossCents: number;
  totalUnrealizedGainLossPercentage: number;
  totalRealizedGainLossCents: number;
  totalDividendsCents: number;
  totalFeesCents: number;
  assetCount: number;
  allocation: PortfolioAllocationItem[];
}

export interface InvestmentPerformancePoint {
  date: string;
  portfolioValueCents: number;
  costBasisCents: number;
  cumulativeReturnPercentage: number;
}

export interface InvestmentPerformanceData {
  timeframe: string;
  points: InvestmentPerformancePoint[];
  totalReturnCents: number;
  totalReturnPercentage: number;
}

export interface CsvImportHoldingRow {
  symbol: string;
  name: string;
  assetType: AssetType;
  shares: string | number;
  avgCostPerShareCents: number;
  latestPriceCents?: number;
}

export interface CsvImportValidationIssue {
  row: number;
  symbol?: string;
  field: string;
  message: string;
}

export interface CsvImportResponse {
  dryRun: boolean;
  totalRows: number;
  validCount: number;
  errorCount: number;
  issues: CsvImportValidationIssue[];
  importedAssets: InvestmentAssetData[];
}

