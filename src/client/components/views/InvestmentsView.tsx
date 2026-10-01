import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { LoadingState } from '../ui/States';
import { useToast } from '../ui/Toast';
import { IconPlus, IconTrendingUp, IconFileText, IconRefreshCw, IconTrash } from '../ui/Icons';
import { CsvDropzone } from '../ui/CsvDropzone';
import { KpiCard, KpiGrid } from '../ui/KpiCard';
import { formatMoney, parseMoney } from '../../../shared/utils/money';
import type {
  InvestmentPortfolioSummary,
  InvestmentAssetData,
  InvestmentTransactionData,
  InvestmentTransactionType,
  AssetType,
  ApiSuccessResponse,
  CsvImportResponse,
} from '../../../shared/types';
import { safeParseJson } from '../../lib/api';

export function InvestmentsView() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<InvestmentPortfolioSummary | null>(null);
  const [assets, setAssets] = useState<InvestmentAssetData[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTransactionData[]>([]);
  const [activeTab, setActiveTab] = useState<'holdings' | 'transactions' | 'allocation'>('holdings');

  // Modals
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Asset deletion state
  const [assetToDelete, setAssetToDelete] = useState<InvestmentAssetData | null>(null);
  const [isDeletingAsset, setIsDeletingAsset] = useState(false);

  // Form validation errors
  const [assetErrors, setAssetErrors] = useState<Record<string, string>>({});
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string>>({});
  const [tradeErrors, setTradeErrors] = useState<Record<string, string>>({});

  // New Asset form
  const [sym, setSym] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AssetType>('stock');
  const [shares, setShares] = useState('1');
  const [avgCost, setAvgCost] = useState('');
  const [price, setPrice] = useState('');

  // Quote form
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [newQuotePrice, setNewQuotePrice] = useState('');

  // Transaction form
  const [txAssetId, setTxAssetId] = useState('');
  const [txType, setTxType] = useState<InvestmentTransactionType>('buy');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txShares, setTxShares] = useState('1');
  const [txPrice, setTxPrice] = useState('');
  const [txFee, setTxFee] = useState('0');
  const [txNotes, setTxNotes] = useState('');

  // CSV Import state
  const [csvText, setCsvText] = useState(
    'symbol,name,assetType,shares,avgCostPerShareCents,latestPriceCents\nVOO,Vanguard S&P 500,etf,10,45000,48000\nETH,Ethereum,crypto,2.5,250000,280000'
  );
  const [csvResult, setCsvResult] = useState<CsvImportResponse | null>(null);

  const fetchInvestments = useCallback(async () => {
    try {
      setLoading(true);
      const [pRes, aRes, tRes] = await Promise.all([
        fetch('/api/investments/portfolio'),
        fetch('/api/investments/assets'),
        fetch('/api/investments/transactions'),
      ]);

      if (pRes.ok) {
        const { data: pJson } = await safeParseJson<ApiSuccessResponse<InvestmentPortfolioSummary>>(pRes);
        if (pJson?.data) setPortfolio(pJson.data);
      }
      if (aRes.ok) {
        const { data: aJson } = await safeParseJson<ApiSuccessResponse<InvestmentAssetData[]>>(aRes);
        if (aJson?.data) {
          setAssets(aJson.data);
          if (aJson.data.length > 0 && !selectedAssetId) {
            setSelectedAssetId(aJson.data[0].id);
            setTxAssetId(aJson.data[0].id);
          }
        }
      }
      if (tRes.ok) {
        const { data: tJson } = await safeParseJson<ApiSuccessResponse<InvestmentTransactionData[]>>(tRes);
        if (tJson?.data) setTransactions(tJson.data);
      }
    } catch {
      addToast('Error loading investments', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, selectedAssetId]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const confirmDeleteAsset = async () => {
    if (!assetToDelete) return;
    const asset = assetToDelete;
    try {
      setIsDeletingAsset(true);
      const res = await fetch(`/api/investments/assets/${asset.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const { data: errJson } = await safeParseJson<{ error?: { message?: string } | string }>(res);
        const msg = typeof errJson?.error === 'string' ? errJson.error : errJson?.error?.message;
        throw new Error(msg || 'Failed to delete asset');
      }
      addToast(`Asset "${asset.symbol}" deleted from portfolio`, 'success');
      setAssetToDelete(null);
      fetchInvestments();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error deleting asset', 'error');
    } finally {
      setIsDeletingAsset(false);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!sym.trim()) errors.symbol = 'Symbol is required';
    if (!name.trim()) errors.name = 'Asset name is required';
    const sharesNum = Number(shares.trim());
    if (!shares.trim() || isNaN(sharesNum) || sharesNum < 0) {
      errors.shares = 'Shares must be a valid non-negative number';
    }
    if (avgCost.trim()) {
      const costNum = Number(avgCost.trim());
      if (isNaN(costNum) || costNum < 0) {
        errors.avgCost = 'Average cost must be a non-negative number';
      }
    }
    if (price.trim()) {
      const priceNum = Number(price.trim());
      if (isNaN(priceNum) || priceNum < 0) {
        errors.price = 'Price must be a non-negative number';
      }
    }
    if (Object.keys(errors).length > 0) {
      setAssetErrors(errors);
      return;
    }
    setAssetErrors({});

    try {
      setSubmitting(true);
      const costCents = avgCost ? parseMoney(avgCost) : 0;
      const priceCents = price ? parseMoney(price) : 0;

      const res = await fetch('/api/investments/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: sym.trim().toUpperCase(),
          name: name.trim(),
          assetType: type,
          shares: shares || '0',
          avgCostBasisCents: costCents,
          latestPriceCents: priceCents,
        }),
      });

      if (!res.ok) {
        const { data: errJson } = await safeParseJson<{ error?: string }>(res);
        throw new Error(errJson?.error || 'Failed to create asset');
      }

      addToast('Asset added to portfolio', 'success');
      setIsAssetModalOpen(false);
      setSym('');
      setName('');
      setShares('1');
      setAvgCost('');
      setPrice('');
      fetchInvestments();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error creating asset', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!selectedAssetId) errors.assetId = 'Please select an asset';
    const quoteNum = Number(newQuotePrice.trim());
    if (!newQuotePrice.trim() || isNaN(quoteNum) || quoteNum <= 0) {
      errors.price = 'Price quote must be greater than 0';
    }
    if (Object.keys(errors).length > 0) {
      setQuoteErrors(errors);
      return;
    }
    setQuoteErrors({});

    try {
      setSubmitting(true);
      const priceCents = parseMoney(newQuotePrice);
      const res = await fetch('/api/investments/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAssetId,
          priceCents,
        }),
      });

      if (!res.ok) throw new Error('Failed to record quote');
      addToast('Price quote recorded', 'success');
      setIsQuoteModalOpen(false);
      setNewQuotePrice('');
      fetchInvestments();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error recording quote', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!txAssetId) errors.assetId = 'Please select an asset';
    const sharesNum = Number(txShares.trim());
    if (!txShares.trim() || isNaN(sharesNum) || sharesNum <= 0) {
      errors.shares = 'Shares quantity must be greater than 0';
    }
    const priceNum = Number(txPrice.trim());
    if (!txPrice.trim() || isNaN(priceNum) || priceNum <= 0) {
      errors.price = 'Price per unit must be greater than 0';
    }
    if (txFee.trim()) {
      const feeNum = Number(txFee.trim());
      if (isNaN(feeNum) || feeNum < 0) {
        errors.fee = 'Fee cannot be negative';
      }
    }
    if (Object.keys(errors).length > 0) {
      setTradeErrors(errors);
      return;
    }
    setTradeErrors({});

    try {
      setSubmitting(true);
      const priceCents = txPrice ? parseMoney(txPrice) : 0;
      const feeCents = txFee ? parseMoney(txFee) : 0;

      const res = await fetch('/api/investments/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: txAssetId,
          type: txType,
          date: txDate,
          shares: txShares || '0',
          pricePerUnitCents: priceCents,
          feeCents,
          notes: txNotes || undefined,
        }),
      });

      if (!res.ok) {
        const { data: errJson } = await safeParseJson<{ error?: string }>(res);
        throw new Error(errJson?.error || 'Failed to record transaction');
      }

      addToast(`Recorded ${txType.toUpperCase()} transaction`, 'success');
      setIsTransactionModalOpen(false);
      setTxShares('1');
      setTxPrice('');
      setTxFee('0');
      setTxNotes('');
      fetchInvestments();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Transaction error', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessCsv = async (dryRun: boolean) => {
    try {
      setSubmitting(true);
      const lines = csvText.trim().split('\n').filter(Boolean);
      if (lines.length <= 1) {
        throw new Error('CSV text must contain headers and at least one data row');
      }

      const headers = lines[0].split(',').map((h) => h.trim());
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        const rowObj: Record<string, unknown> = {};
        headers.forEach((h, idx) => {
          const val = cols[idx];
          if (h === 'avgCostPerShareCents' || h === 'latestPriceCents') {
            rowObj[h] = parseInt(val, 10);
          } else {
            rowObj[h] = val;
          }
        });
        rows.push(rowObj);
      }

      const res = await fetch('/api/investments/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, rows }),
      });

      const { data: json } = await safeParseJson<ApiSuccessResponse<CsvImportResponse>>(res);
      if (json?.data) {
        setCsvResult(json.data);
      }

      if (!dryRun && json?.data && json.data.validCount > 0) {
        addToast(`Successfully imported ${json.data.validCount} holdings`, 'success');
        setIsCsvModalOpen(false);
        fetchInvestments();
      }
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'CSV processing error', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInstantCsvUpload = async ({
    csvText: incomingCsv,
  }: {
    csvText: string;
    file: File;
    rowCount: number;
  }) => {
    setCsvText(incomingCsv);
    const lines = incomingCsv.trim().split('\n').filter(Boolean);
    if (lines.length <= 1) {
      throw new Error('CSV text must contain headers and at least one data row');
    }

    const headers = lines[0].split(',').map((h) => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const rowObj: Record<string, unknown> = {};
      headers.forEach((h, idx) => {
        const val = cols[idx];
        if (h === 'avgCostPerShareCents' || h === 'latestPriceCents') {
          rowObj[h] = parseInt(val, 10);
        } else {
          rowObj[h] = val;
        }
      });
      rows.push(rowObj);
    }

    const res = await fetch('/api/investments/import/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: false, rows }),
    });

    const { data: json, error: jsonErr } =
      await safeParseJson<ApiSuccessResponse<CsvImportResponse>>(res);
    if (!res.ok || !json?.data) {
      throw new Error(
        jsonErr || (json as any)?.error?.message || 'CSV processing error'
      );
    }

    setCsvResult(json.data);
    fetchInvestments();
    return json.data;
  };

  if (loading) {
    return <LoadingState message="Calculating portfolio valuations & allocations..." />;
  }

  const portfolioValueCents = portfolio?.totalPortfolioValueCents ?? 0;
  const costBasisCents = portfolio?.totalCostBasisCents ?? 0;
  const gainLossCents = portfolio?.totalUnrealizedGainLossCents ?? 0;
  const gainLossPct = portfolio?.totalUnrealizedGainLossPercentage ?? 0;
  const realizedGainCents = portfolio?.totalRealizedGainLossCents ?? 0;
  const totalDividendsCents = portfolio?.totalDividendsCents ?? 0;
  const isPositiveGain = gainLossCents >= 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-up">
      {/* ─── Executive Header & Actions ─── */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
              Investments & Portfolio
            </h1>
            <span className="font-label-caps text-xs px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-mono font-semibold">
              {assets.length} Holdings
            </span>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <a
            href="/api/investments/export/csv"
            download
            className="h-9 px-3 text-xs font-semibold bg-surface-container-low hover:bg-surface-container text-on-surface rounded-xl border border-border/70 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <IconFileText size={14} className="text-on-surface-variant" />
            <span>Export</span>
          </a>
          <Button
            onClick={() => setIsCsvModalOpen(true)}
            variant="secondary"
            size="sm"
            className="rounded-xl border-border/70"
          >
            <IconFileText size={14} />
            <span>Import CSV</span>
          </Button>
          <Button
            onClick={() => {
              if (assets.length > 0) {
                setTxAssetId(assets[0].id);
                setIsTransactionModalOpen(true);
              } else {
                addToast('Add an asset first before recording transactions', 'info');
              }
            }}
            variant="secondary"
            size="sm"
            className="rounded-xl border-border/70"
          >
            <IconRefreshCw size={14} />
            <span>Record Trade</span>
          </Button>
          <Button
            onClick={() => setIsQuoteModalOpen(true)}
            variant="secondary"
            size="sm"
            className="rounded-xl border-border/70"
          >
            <IconTrendingUp size={14} />
            <span>Quote</span>
          </Button>
          <Button
            onClick={() => setIsAssetModalOpen(true)}
            variant="primary"
            size="sm"
            className="rounded-xl shadow-sm hover:shadow-[0_4px_16px_rgba(70,72,212,0.28)]"
          >
            <IconPlus size={14} />
            <span>Add Asset</span>
          </Button>
        </div>
      </div>

      {/* ─── Portfolio Metrics Bento Grid ─── */}
      <KpiGrid cols="5">
        <KpiCard
          title="Portfolio Value"
          value={formatMoney(portfolioValueCents)}
          subtitle={`${assets.length} held positions`}
          color="default"
        />

        <KpiCard
          title="Total Cost Basis"
          value={formatMoney(costBasisCents)}
          subtitle="Invested principal"
          color="default"
        />

        <KpiCard
          title="Unrealized P&L"
          value={`${isPositiveGain ? '+' : ''}${formatMoney(gainLossCents)}`}
          trend={{
            value: `${gainLossPct}%`,
            isPositive: isPositiveGain,
          }}
          subtitle={`${isPositiveGain ? '+' : ''}${gainLossPct}% open return`}
          color={isPositiveGain ? 'emerald' : 'rose'}
        />

        <KpiCard
          title="Realized P&L"
          value={`${realizedGainCents >= 0 ? '+' : ''}${formatMoney(realizedGainCents)}`}
          subtitle="From closed positions"
          color={realizedGainCents >= 0 ? 'emerald' : 'rose'}
        />

        <KpiCard
          title="Dividends Income"
          value={formatMoney(totalDividendsCents)}
          subtitle="Total cash payouts"
          color="primary"
        />
      </KpiGrid>

      {/* ─── Tabs ─── */}
      <div className="flex border-b border-border/70 text-xs sm:text-sm font-semibold space-x-2 sm:space-x-6 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('holdings')}
          className={clsx(
            'min-h-[44px] shrink-0 pb-3 px-2 sm:px-1 transition-all duration-150 border-b-2 cursor-pointer flex items-center font-title-sm text-title-sm',
            activeTab === 'holdings'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          )}
        >
          Positions ({assets.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={clsx(
            'min-h-[44px] shrink-0 pb-3 px-2 sm:px-1 transition-all duration-150 border-b-2 cursor-pointer flex items-center font-title-sm text-title-sm',
            activeTab === 'transactions'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          )}
        >
          Transactions Ledger ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('allocation')}
          className={clsx(
            'min-h-[44px] shrink-0 pb-3 px-2 sm:px-1 transition-all duration-150 border-b-2 cursor-pointer flex items-center font-title-sm text-title-sm',
            activeTab === 'allocation'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          )}
        >
          Asset Allocation
        </button>
      </div>

      {/* Tab: Holdings */}
      {activeTab === 'holdings' && (
        <div className="bg-surface-container-lowest border border-border/70 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border/60 bg-surface-container-low/40 font-bold font-title-sm text-on-surface flex items-center justify-between">
            <span className="font-headline-md text-title-sm">Holdings & Valuations</span>
            <span className="font-label-caps text-label-caps text-outline font-mono">10⁻⁶ Minor units</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-foreground/70 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Asset</th>
                  <th className="py-2.5 px-4 font-semibold">Type</th>
                  <th className="py-2.5 px-4 font-semibold">Shares Held</th>
                  <th className="py-2.5 px-4 font-semibold">Avg Cost</th>
                  <th className="py-2.5 px-4 font-semibold">Latest Price</th>
                  <th className="py-2.5 px-4 font-semibold">Market Value</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Unrealized P&L</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-foreground/50">
                      No holdings in your portfolio yet. Click &quot;+ Add Asset&quot; or &quot;Import CSV&quot; to begin.
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => {
                    const isGain = asset.unrealizedGainLossCents >= 0;
                    return (
                      <tr key={asset.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-bold text-foreground">
                          <div>{asset.symbol}</div>
                          <div className="text-[11px] font-normal text-foreground/60 truncate max-w-xs">
                            {asset.name}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-muted rounded font-semibold text-[10px] uppercase tracking-wider text-foreground/70">
                            {asset.assetType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          {asset.sharesFormatted}
                        </td>
                        <td className="py-3 px-4 text-foreground/70 font-mono">
                          {formatMoney(asset.avgCostBasisCents)}
                        </td>
                        <td className="py-3 px-4 text-foreground font-mono font-medium">
                          {formatMoney(asset.latestPriceCents)}
                        </td>
                        <td className="py-3 px-4 font-extrabold text-foreground font-mono">
                          {formatMoney(asset.totalMarketValueCents)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div
                            className={clsx(
                              'font-bold font-mono',
                              isGain ? 'text-emerald-500' : 'text-rose-500'
                            )}
                          >
                            {isGain ? '+' : ''}
                            {formatMoney(asset.unrealizedGainLossCents)}
                          </div>
                          <div
                            className={clsx(
                              'text-[10px]',
                              isGain ? 'text-emerald-500' : 'text-rose-500'
                            )}
                          >
                            {isGain ? '+' : ''}
                            {asset.unrealizedGainLossPercentage}%
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setAssetToDelete(asset)}
                            title={`Delete ${asset.symbol}`}
                            aria-label={`Delete asset ${asset.symbol}`}
                            className="neo-btn neo-btn-sm neo-btn-icon neo-btn-delete min-w-[28px] min-h-[28px]"
                          >
                            <IconTrash size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Transactions */}
      {activeTab === 'transactions' && (
        <div className="bg-card border border-border rounded-token overflow-hidden shadow-xs">
          <div className="p-3 border-b border-border bg-muted/20 font-bold text-xs uppercase tracking-wider text-foreground">
            Investment Transactions History
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-foreground/70 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Date</th>
                  <th className="py-2.5 px-4 font-semibold">Symbol</th>
                  <th className="py-2.5 px-4 font-semibold">Type</th>
                  <th className="py-2.5 px-4 font-semibold">Shares</th>
                  <th className="py-2.5 px-4 font-semibold">Price</th>
                  <th className="py-2.5 px-4 font-semibold">Total Amount</th>
                  <th className="py-2.5 px-4 font-semibold">Fee</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Realized Gain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-foreground/50">
                      No transactions recorded yet. Click &quot;Record Trade&quot; above to log buy/sell orders.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-foreground/70">{tx.date}</td>
                      <td className="py-3 px-4 font-bold text-foreground">{tx.symbol}</td>
                      <td className="py-3 px-4">
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded font-semibold text-[10px] uppercase tracking-wider',
                            tx.type === 'buy' && 'bg-emerald-500/10 text-emerald-500',
                            tx.type === 'sell' && 'bg-rose-500/10 text-rose-500',
                            tx.type === 'dividend' && 'bg-sky-500/10 text-sky-500',
                            tx.type === 'fee' && 'bg-amber-500/10 text-amber-500'
                          )}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{tx.sharesFormatted}</td>
                      <td className="py-3 px-4 font-mono">{formatMoney(tx.pricePerUnitCents)}</td>
                      <td className="py-3 px-4 font-bold font-mono">{formatMoney(tx.totalAmountCents)}</td>
                      <td className="py-3 px-4 font-mono text-foreground/60">{formatMoney(tx.feeCents)}</td>
                      <td className="py-3 px-4 text-right font-mono">
                        {tx.realizedGainCents !== null ? (
                          <span
                            className={
                              tx.realizedGainCents >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'
                            }
                          >
                            {tx.realizedGainCents >= 0 ? '+' : ''}
                            {formatMoney(tx.realizedGainCents)}
                          </span>
                        ) : (
                          <span className="text-foreground/40">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Allocation */}
      {activeTab === 'allocation' && (
        <div className="p-5 bg-card border border-border rounded-token shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-foreground">Asset Class Allocation</h3>
          {portfolio && portfolio.allocation.length > 0 ? (
            <div className="space-y-3">
              <div className="flex h-4 w-full rounded-full overflow-hidden bg-muted">
                {portfolio.allocation.map((item, idx) => {
                  const colors = ['bg-primary', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500', 'bg-violet-500'];
                  return (
                    <div
                      key={item.assetType}
                      className={clsx('h-full', colors[idx % colors.length])}
                      style={{ width: `${item.percentage}%` }}
                      title={`${item.assetType}: ${item.percentage}% (${formatMoney(item.marketValueCents)})`}
                    />
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {portfolio.allocation.map((item) => (
                  <div key={item.assetType} className="p-3 bg-muted/20 border border-border rounded-token space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase text-foreground">
                      <span>{item.assetType}</span>
                      <span>{item.percentage}%</span>
                    </div>
                    <div className="text-base font-extrabold text-foreground font-mono">
                      {formatMoney(item.marketValueCents)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-foreground/50">
              No holdings available for allocation calculation.
            </div>
          )}
        </div>
      )}

      {/* Record Transaction Modal */}
      <Modal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        title="Record Investment Trade"
        size="md"
      >
        <form onSubmit={handleRecordTransaction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                Select Asset <span className="text-rose-500">*</span>
              </label>
              <select
                value={txAssetId}
                onChange={(e) => setTxAssetId(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-mono touch-manipulation"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.symbol} ({a.sharesFormatted} units)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                Transaction Type
              </label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value as InvestmentTransactionType)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer touch-manipulation"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="dividend">Dividend</option>
                <option value="fee">Fee</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">Date</label>
              <input
                type="date"
                required
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono cursor-pointer touch-manipulation"
              />
            </div>
            <Input
              label="Shares Quantity"
              required
              value={txShares}
              onChange={(e) => setTxShares(e.target.value)}
              placeholder="1.0"
              className="font-mono"
              error={tradeErrors.shares}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Price per Unit (₹)"
              type="number"
              step="0.01"
              required
              value={txPrice}
              onChange={(e) => setTxPrice(e.target.value)}
              placeholder="150.00"
              className="font-mono"
              error={tradeErrors.price}
            />
            <Input
              label="Fee (₹)"
              type="number"
              step="0.01"
              value={txFee}
              onChange={(e) => setTxFee(e.target.value)}
              placeholder="0.00"
              className="font-mono"
              error={tradeErrors.fee}
            />
          </div>

          <Input
            label="Notes / Order ID"
            value={txNotes}
            onChange={(e) => setTxNotes(e.target.value)}
            placeholder="e.g. Limit order filled"
          />

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsTransactionModalOpen(false)}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              Record Transaction
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Asset Modal */}
      <Modal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        title="Add Portfolio Holding"
        size="md"
      >
        <form onSubmit={handleCreateAsset} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Symbol"
              required
              value={sym}
              onChange={(e) => setSym(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL, BTC, VTI"
              className="font-mono uppercase"
              error={assetErrors.symbol}
              autoFocus
            />
            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                Asset Class
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AssetType)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer touch-manipulation"
              >
                <option value="stock">Stock</option>
                <option value="mutual_fund">Mutual Fund</option>
                <option value="etf">ETF</option>
                <option value="crypto">Crypto</option>
                <option value="real_estate">Real Estate</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <Input
            label="Asset Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Apple Inc."
            error={assetErrors.name}
          />

          <Input
            label="Quantity / Units (up to 6 decimals)"
            required
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="1.5"
            className="font-mono"
            error={assetErrors.shares}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Avg Cost Per Unit (₹)"
              type="number"
              step="0.01"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              placeholder="150.00"
              className="font-mono"
              error={assetErrors.avgCost}
            />
            <Input
              label="Latest Price (₹)"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="180.00"
              className="font-mono"
              error={assetErrors.price}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAssetModalOpen(false)}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              Add Holding
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Quote Modal */}
      <Modal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        title="Record Price Quote"
        size="md"
      >
        <form onSubmit={handleRecordQuote} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
              Select Asset
            </label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-mono touch-manipulation"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} - {a.name} (Current: {formatMoney(a.latestPriceCents)})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="New Price Quote (₹)"
            type="number"
            step="0.01"
            required
            value={newQuotePrice}
            onChange={(e) => setNewQuotePrice(e.target.value)}
            placeholder="0.00"
            className="font-mono"
            error={quoteErrors.price}
            autoFocus
          />

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsQuoteModalOpen(false)}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              Record Quote
            </Button>
          </div>
        </form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        title="CSV Portfolio Importer"
        description="Bulk import holdings with pre-flight dry-run validation"
        size="lg"
      >
        <div className="space-y-4">
          <CsvDropzone
            mutationFn={handleInstantCsvUpload}
            queryKeyToInvalidate={['investments']}
            processingMessage="Importing holdings to Cloudflare D1..."
            title="Drop Portfolio CSV to Import"
            description="Automatic parsing & pre-flight verification. Immediately saves to database."
            expectedFormatHint="symbol, name, assetType, shares, avgCostPerShareCents, latestPriceCents"
          />

          <details className="text-xs text-foreground/75 cursor-pointer group">
            <summary className="font-semibold text-foreground/70 hover:text-foreground py-1">
              Manual CSV Textarea & Dry-Run Inspector
            </summary>
            <div className="mt-2 space-y-2">
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full p-3 font-mono text-base sm:text-xs bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed touch-manipulation min-h-[120px]"
              />
            </div>
          </details>

          {csvResult && (
            <div className="p-3.5 bg-card/60 border border-border/80 rounded-xl space-y-2 text-xs">
              <div className="font-bold flex items-center justify-between">
                <span>Validation Summary:</span>
                <span className="font-mono">
                  {csvResult.validCount} Valid | {csvResult.errorCount} Errors
                </span>
              </div>
              {csvResult.issues.length > 0 && (
                <div className="space-y-1 text-rose-500 font-mono text-[11px] max-h-32 overflow-y-auto">
                  {csvResult.issues.map((iss, i) => (
                    <div key={i}>
                      Row {iss.row}: {iss.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleProcessCsv(true)}
              isLoading={submitting}
              disabled={submitting}
              size="sm"
              className="w-full sm:w-auto"
            >
              Dry-Run Validate
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCsvModalOpen(false)}
                disabled={submitting}
                size="sm"
                className="flex-1 sm:flex-initial"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => handleProcessCsv(false)}
                isLoading={submitting}
                disabled={submitting}
                size="sm"
                className="flex-1 sm:flex-initial"
              >
                Commit Import
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Asset Deletion */}
      <ConfirmationModal
        isOpen={Boolean(assetToDelete)}
        onClose={() => setAssetToDelete(null)}
        onConfirm={confirmDeleteAsset}
        isLoading={isDeletingAsset}
        title="Delete Portfolio Holding"
        description={`Are you sure you want to delete ${assetToDelete?.symbol} (${assetToDelete?.name})? All recorded purchase history and allocation weighting will be removed.`}
        confirmLabel="Delete Asset"
        variant="destructive"
      />
    </div>
  );
}

