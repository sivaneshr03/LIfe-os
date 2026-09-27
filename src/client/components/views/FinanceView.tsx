import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Card3D } from '../ui/Card3D';
import { LoadingState } from '../ui/States';
import { useToast } from '../ui/Toast';
import { IconPlus, IconRefreshCw, IconCreditCard, IconTrash, IconChevronRight } from '../ui/Icons';
import { CategoryPickerModal } from '../ui/CategoryPickerModal';
import { CategoryDropdown } from '../ui/CategoryDropdown';
import { MobileTransactionSheet } from '../ui/MobileTransactionSheet';
import type { KPIData } from '../ui/MobileTransactionSheet';
import { formatMoney, parseMoney } from '../../../shared/utils/money';
import type {
  FinanceOverviewData,
  FinanceAccountData,
  FinanceTransactionData,
  FinanceBudgetData,
  FinanceDebtData,
  CategoryData,
  ApiSuccessResponse,
  FinanceAccountType,
  FinanceTransactionType,
} from '../../../shared/types';
import { safeParseJson } from '../../lib/api';

export function FinanceView() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'transactions' | 'budgets' | 'debts'>('overview');

  const [overview, setOverview] = useState<FinanceOverviewData | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccountData[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransactionData[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudgetData[]>([]);
  const [debts, setDebts] = useState<FinanceDebtData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);

  // Category Picker State
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isMobileCatSheetOpen, setIsMobileCatSheetOpen] = useState(false);
  const [categoryPickerTarget, setCategoryPickerTarget] = useState<'txn' | 'budget'>('txn');

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isPayoffModalOpen, setIsPayoffModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<FinanceDebtData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New Account form state
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<FinanceAccountType>('checking');
  const [accBalance, setAccBalance] = useState('');
  const [accCurrency, setAccCurrency] = useState('INR');

  // New Transaction form state
  const [txnAccountId, setTxnAccountId] = useState('');
  const [txnCategoryId, setTxnCategoryId] = useState('');
  const [txnType, setTxnType] = useState<FinanceTransactionType>('expense');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnPayee, setTxnPayee] = useState('');
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10));

  // Transfer form state
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferNotes, setTransferNotes] = useState('');

  // Budget form state
  const [budgetCatId, setBudgetCatId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // Debt form state
  const [debtName, setDebtName] = useState('');
  const [debtCreditor, setDebtCreditor] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtApr, setDebtApr] = useState('18.5');
  const [debtMinPayment, setDebtMinPayment] = useState('');

  // Debt Payoff state
  const [payoffAmount, setPayoffAmount] = useState('');
  const [payoffPrincipal, setPayoffPrincipal] = useState('');
  const [payoffInterest, setPayoffInterest] = useState('');
  const [payoffDate, setPayoffDate] = useState(new Date().toISOString().slice(0, 10));

  const fetchFinanceData = useCallback(async () => {
    try {
      setLoading(true);
      const [ovRes, accRes, txnRes, budRes, debtRes, catRes] = await Promise.all([
        fetch('/api/finance/overview'),
        fetch('/api/finance/accounts'),
        fetch('/api/finance/transactions?pageSize=50'),
        fetch('/api/finance/budgets'),
        fetch('/api/finance/debts'),
        fetch('/api/categories?domain=finance'),
      ]);

      if (ovRes.ok) {
        const { data: ovJson } = await safeParseJson<ApiSuccessResponse<FinanceOverviewData>>(ovRes);
        if (ovJson?.data) setOverview(ovJson.data);
      }
      if (accRes.ok) {
        const { data: accJson } = await safeParseJson<ApiSuccessResponse<FinanceAccountData[]>>(accRes);
        if (accJson?.data) {
          setAccounts(accJson.data);
          if (accJson.data.length > 0 && !txnAccountId) {
            setTxnAccountId(accJson.data[0].id);
          }
          if (accJson.data.length >= 2 && !transferFromId) {
            setTransferFromId(accJson.data[0].id);
            setTransferToId(accJson.data[1].id);
          }
        }
      }
      if (txnRes.ok) {
        const { data: txnJson } = await safeParseJson<{ data: { items?: FinanceTransactionData[] } | FinanceTransactionData[] }>(txnRes);
        if (txnJson && Array.isArray(txnJson.data)) {
          setTransactions(txnJson.data);
        } else if (txnJson && txnJson.data && Array.isArray(txnJson.data.items)) {
          setTransactions(txnJson.data.items);
        }
      }
      if (budRes.ok) {
        const { data: budJson } = await safeParseJson<ApiSuccessResponse<FinanceBudgetData[]>>(budRes);
        if (budJson) setBudgets(budJson.data || []);
      }
      if (debtRes.ok) {
        const { data: debtJson } = await safeParseJson<ApiSuccessResponse<FinanceDebtData[]>>(debtRes);
        if (debtJson) setDebts(debtJson.data || []);
      }
      if (catRes.ok) {
        const { data: catJson } = await safeParseJson<ApiSuccessResponse<CategoryData[]>>(catRes);
        if (catJson) {
          setCategories(catJson.data || []);
          if (catJson.data && catJson.data.length > 0 && !budgetCatId) {
            setBudgetCatId(catJson.data[0].id);
          }
        }
      }
    } catch {
      addToast('Error loading financial data', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, txnAccountId, transferFromId, budgetCatId]);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  // Lookup map for category icons, colors, names, and parent hierarchy
  const categoryLookup = useMemo(() => {
    const map = new Map<
      string,
      { name: string; icon?: string | null; color?: string | null; parentName?: string; parentIcon?: string | null }
    >();
    for (const cat of categories) {
      map.set(cat.id, { name: cat.name, icon: cat.icon, color: cat.color });
      if (cat.subcategories) {
        for (const sub of cat.subcategories) {
          map.set(sub.id, {
            name: sub.name,
            icon: sub.icon,
            color: sub.color || cat.color,
            parentName: cat.name,
            parentIcon: cat.icon,
          });
        }
      }
    }
    return map;
  }, [categories]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;

    try {
      setSubmitting(true);
      const initialBalanceCents = accBalance.trim() ? parseMoney(accBalance.trim(), accCurrency) : 0;
      const res = await fetch('/api/finance/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: accName.trim(),
          type: accType,
          currency: accCurrency,
          initialBalanceCents,
        }),
      });

      if (!res.ok) throw new Error('Failed to create account');
      addToast('Account created', 'success');
      setIsAccountModalOpen(false);
      setAccName('');
      setAccBalance('');
      fetchFinanceData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error creating account', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txnAccountId || !txnAmount.trim()) return;

    try {
      setSubmitting(true);
      const targetAcc = accounts.find((a) => a.id === txnAccountId);
      const amountCents = parseMoney(txnAmount.trim(), targetAcc?.currency || 'USD');
      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: txnAccountId,
          categoryId: txnCategoryId || undefined,
          type: txnType,
          amountCents,
          transactionDate: txnDate,
          payee: txnPayee.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to post transaction');
      addToast('Transaction posted', 'success');
      setIsTxnModalOpen(false);
      setTxnAmount('');
      setTxnPayee('');
      fetchFinanceData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error posting transaction', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferFromId || !transferToId || !transferAmount.trim()) return;
    if (transferFromId === transferToId) {
      addToast('Source and destination accounts must be different', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const fromAcc = accounts.find((a) => a.id === transferFromId);
      const amountCents = parseMoney(transferAmount.trim(), fromAcc?.currency || 'USD');
      const res = await fetch('/api/finance/transactions/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccountId: transferFromId,
          toAccountId: transferToId,
          amountCents,
          transactionDate: transferDate,
          notes: transferNotes.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error('Transfer failed');
      addToast('Atomic transfer complete', 'success');
      setIsTransferModalOpen(false);
      setTransferAmount('');
      setTransferNotes('');
      fetchFinanceData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error executing transfer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetCatId || !budgetAmount.trim()) return;

    try {
      setSubmitting(true);
      const amountCents = parseMoney(budgetAmount.trim(), 'USD');
      const currentYM = new Date().toISOString().slice(0, 7);
      const res = await fetch('/api/finance/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: budgetCatId,
          period: budgetPeriod,
          yearMonth: currentYM,
          amountCents,
        }),
      });

      if (!res.ok) throw new Error('Failed to create budget');
      addToast('Budget saved', 'success');
      setIsBudgetModalOpen(false);
      setBudgetAmount('');
      fetchFinanceData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error creating budget', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtName.trim() || !debtCreditor.trim() || !debtAmount.trim()) return;

    try {
      setSubmitting(true);
      const totalOwedCents = parseMoney(debtAmount.trim(), 'USD');
      const interestRateBps = Math.round(Number(debtApr || '0') * 100);
      const minPmtCents = debtMinPayment.trim() ? parseMoney(debtMinPayment.trim(), 'USD') : 0;

      const res = await fetch('/api/finance/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: debtName.trim(),
          creditor: debtCreditor.trim(),
          totalOwedCents,
          interestRateBps,
          minimumPaymentCents: minPmtCents,
        }),
      });

      if (!res.ok) throw new Error('Failed to log debt');
      addToast('Debt recorded', 'success');
      setIsDebtModalOpen(false);
      setDebtName('');
      setDebtCreditor('');
      setDebtAmount('');
      fetchFinanceData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error recording debt', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDebtPayoff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !payoffAmount.trim()) return;

    try {
      setSubmitting(true);
      const totalCents = parseMoney(payoffAmount.trim(), 'USD');
      const principalCents = payoffPrincipal.trim() ? parseMoney(payoffPrincipal.trim(), 'USD') : totalCents;
      const interestCents = payoffInterest.trim() ? parseMoney(payoffInterest.trim(), 'USD') : 0;

      const res = await fetch(`/api/finance/debts/${selectedDebt.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: payoffDate,
          amountCents: totalCents,
          principalCents,
          interestCents,
          notes: 'Payoff contribution',
        }),
      });

      if (!res.ok) throw new Error('Failed to record payment');
      addToast('Debt payment recorded', 'success');
      setIsPayoffModalOpen(false);
      setPayoffAmount('');
      setPayoffPrincipal('');
      setPayoffInterest('');
      setSelectedDebt(null);
      fetchFinanceData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error recording payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Connecting to atomic financial ledger..." />;
  }

  const netWorthCents = overview?.netWorth.netWorthCents ?? 0;
  const assetsCents = overview?.netWorth.totalAssetsCents ?? 0;
  const liabilitiesCents = overview?.netWorth.totalLiabilitiesCents ?? 0;
  const incomeCents = overview?.monthlyIncomeCents ?? 0;
  const expenseCents = overview?.monthlyExpenseCents ?? 0;
  const savingsRate = overview?.monthlySavingsRatePercentage ?? 0;

  // KPI data for MobileTransactionSheet
  const selectedAccount = accounts.find((a) => a.id === txnAccountId);
  const activeCatBudget = budgets.find((b) => b.categoryId === txnCategoryId);
  const mobileSheetKpi: KPIData = {
    todaySpentCents: expenseCents,
    categorySpendCents: activeCatBudget?.spentCents ?? 0,
    accountBalanceCents: selectedAccount?.balanceCents ?? 0,
    budgetUsedPercent: activeCatBudget?.percentageUsed ?? 0,
    currency: selectedAccount?.currency ?? 'INR',
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            Personal Finance & Ledger
          </h1>
          <p className="text-xs text-foreground/60 mt-0.5">
            Double-entry atomic ledger, integer cents accounting, envelope budgets & net worth
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center sm:flex-wrap gap-2 w-full sm:w-auto">
          <Button onClick={() => setIsAccountModalOpen(true)} variant="secondary" size="sm" className="w-full sm:w-auto justify-center">
            <IconPlus size={13} />
            <span>Account</span>
          </Button>
          <Button onClick={() => setIsTransferModalOpen(true)} variant="secondary" size="sm" className="w-full sm:w-auto justify-center">
            <IconRefreshCw size={13} />
            <span>Transfer</span>
          </Button>
          <Button onClick={() => setIsBudgetModalOpen(true)} variant="secondary" size="sm" className="w-full sm:w-auto justify-center">
            <IconPlus size={13} />
            <span>Budget</span>
          </Button>
          <Button onClick={() => setIsDebtModalOpen(true)} variant="secondary" size="sm" className="w-full sm:w-auto justify-center">
            <IconPlus size={13} />
            <span>Debt</span>
          </Button>
          <Button onClick={() => setIsTxnModalOpen(true)} size="sm" className="col-span-2 sm:col-span-1 w-full sm:w-auto justify-center">
            <IconPlus size={13} />
            <span>Transaction</span>
          </Button>
        </div>
      </div>

      {/* Net Worth & Cashflow Cockpit with 3D Depth */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card3D
          maxTilt={6}
          className="p-5 bg-card/75 backdrop-blur-md border border-border/80 rounded-2xl shadow-xs hover:shadow-md space-y-1.5 glass-inner transition-all duration-300"
        >
          <span className="text-[10px] font-mono font-bold text-foreground/50 uppercase tracking-wider block translate-z-12">
            Total Net Worth
          </span>
          <div className="text-2xl font-mono font-extrabold text-foreground tracking-tight translate-z-20">
            {formatMoney(netWorthCents)}
          </div>
          <div className="text-[11px] text-foreground/50 font-mono translate-z-12">
            Assets: {formatMoney(assetsCents)} | Liab: {formatMoney(liabilitiesCents)}
          </div>
        </Card3D>

        <Card3D
          maxTilt={6}
          className="p-5 bg-card/75 backdrop-blur-md border border-border/80 rounded-2xl shadow-xs hover:shadow-md space-y-1.5 glass-inner transition-all duration-300"
        >
          <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block translate-z-12">
            Monthly Inflow
          </span>
          <div className="text-2xl font-mono font-extrabold text-emerald-500 tracking-tight translate-z-20">
            +{formatMoney(incomeCents)}
          </div>
          <div className="text-[11px] text-foreground/50 translate-z-12">Total cash inflows recorded this month</div>
        </Card3D>

        <Card3D
          maxTilt={6}
          className="p-5 bg-card/75 backdrop-blur-md border border-border/80 rounded-2xl shadow-xs hover:shadow-md space-y-1.5 glass-inner transition-all duration-300"
        >
          <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block translate-z-12">
            Monthly Outflow
          </span>
          <div className="text-2xl font-mono font-extrabold text-rose-500 tracking-tight translate-z-20">
            -{formatMoney(expenseCents)}
          </div>
          <div className="text-[11px] text-foreground/50 translate-z-12">Total debits recorded this month</div>
        </Card3D>

        <Card3D
          maxTilt={6}
          className="p-5 bg-card/75 backdrop-blur-md border border-border/80 rounded-2xl shadow-xs hover:shadow-md space-y-1.5 glass-inner transition-all duration-300"
        >
          <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider block translate-z-12">
            Savings Rate
          </span>
          <div className="text-2xl font-mono font-extrabold text-primary tracking-tight translate-z-20">{savingsRate}%</div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden translate-z-12">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
            />
          </div>
        </Card3D>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border/80 text-xs sm:text-sm font-semibold space-x-2 sm:space-x-6 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'accounts', label: `Accounts (${accounts.length})` },
          { id: 'transactions', label: `Ledger (${transactions.length})` },
          { id: 'budgets', label: `Budgets (${budgets.length})` },
          { id: 'debts', label: `Debts (${debts.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={clsx(
              'min-h-[44px] shrink-0 pb-3 px-2 sm:px-1 transition-all duration-150 border-b-2 cursor-pointer flex items-center touch-manipulation',
              activeTab === tab.id
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-foreground/60 hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabs Content */}
      {activeTab === 'overview' || activeTab === 'accounts' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-5 bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner shadow-xs space-y-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: acc.color || '#3b82f6' }}
                    />
                    <span className="text-sm font-bold text-foreground truncate">{acc.name}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-muted rounded-lg font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                    {acc.type}
                  </span>
                </div>
                <div className="text-xl font-extrabold text-foreground tracking-tight font-mono">
                  {formatMoney(acc.balanceCents, acc.currency)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2 font-mono">
                  <span>Transactions: {acc.transactionCount ?? 0}</span>
                  <span>{acc.currency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'transactions' && (
        <div className="bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border/80 bg-muted/20 font-bold text-xs uppercase tracking-wider text-foreground flex items-center justify-between">
            <span>Atomic Ledger Transactions</span>
            <span className="text-[11px] text-muted-foreground font-normal font-mono">Integer cents precision</span>
          </div>
          <div className="divide-y divide-border/40">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No ledger transactions recorded yet.
              </div>
            ) : (
              transactions.map((txn) => {
                const isIncome = txn.type === 'income';
                const isTransfer = txn.type === 'transfer';
                return (
                  <div
                    key={txn.id}
                    className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          'w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs',
                          isTransfer
                            ? 'bg-blue-500/10 text-blue-500'
                            : isIncome
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-rose-500/10 text-rose-500'
                        )}
                      >
                        {isTransfer ? '⇄' : isIncome ? '↓' : '↑'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                          {(() => {
                            const catDetail = txn.categoryId ? categoryLookup.get(txn.categoryId) : null;
                            if (catDetail) {
                              return (
                                <>
                                  {catDetail.parentName && (
                                    <span className="text-foreground/50 text-[11px] font-medium">
                                      {catDetail.parentIcon ? `${catDetail.parentIcon} ` : ''}{catDetail.parentName} ›
                                    </span>
                                  )}
                                  <span>{catDetail.icon ? `${catDetail.icon} ` : ''}{catDetail.name}</span>
                                </>
                              );
                            }
                            return <span>{txn.categoryName || txn.category || 'Uncategorized'}</span>;
                          })()}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {txn.transactionDate} {txn.notes && `• ${txn.notes}`}
                        </div>
                      </div>
                    </div>
                    <div
                      className={clsx(
                        'text-sm font-bold font-mono',
                        isTransfer
                          ? 'text-blue-500'
                          : isIncome
                          ? 'text-emerald-500'
                          : 'text-rose-500'
                      )}
                    >
                      {isTransfer ? '⇄ ' : isIncome ? '+' : '-'}
                      {formatMoney(txn.amountCents)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'budgets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.length === 0 ? (
            <div className="col-span-full p-8 text-center bg-card/70 backdrop-blur-sm border border-dashed border-border/80 rounded-2xl text-xs text-muted-foreground">
              No envelope budgets defined for this calendar month.
            </div>
          ) : (
            budgets.map((b) => (
              <div key={b.id} className="p-5 bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span>Category Envelope</span>
                  <span className="font-mono">{b.yearMonth}</span>
                </div>
                <div className="text-lg font-extrabold text-foreground font-mono">
                  Budget: {formatMoney(b.amountCents)}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  Spent: {formatMoney(b.spentCents || 0)} ({b.percentageUsed || 0}% used)
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={clsx(
                      'h-full transition-all duration-300',
                      (b.percentageUsed || 0) > 100 ? 'bg-rose-500' : 'bg-primary'
                    )}
                    style={{ width: `${Math.min(100, b.percentageUsed || 0)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'debts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {debts.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-card/70 backdrop-blur-sm border border-dashed border-border/80 rounded-2xl text-xs text-muted-foreground">
                No debts or loans tracked. Clean slate!
              </div>
            ) : (
              debts.map((d) => (
                <div key={d.id} className="p-5 bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground truncate">{d.name}</span>
                    <span
                      className={clsx(
                        'text-[10px] px-2 py-0.5 rounded-lg font-semibold uppercase font-mono',
                        d.isPaidOff ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                      )}
                    >
                      {d.isPaidOff ? 'Paid Off' : 'Active Debt'}
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-foreground font-mono">
                    Owed: {formatMoney(d.totalOwedCents)}
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-1 font-mono">
                    <div>Creditor: {d.creditor}</div>
                    <div>Interest: {(d.interestRateBps / 100).toFixed(2)}% APR</div>
                    <div>Min Payment: {formatMoney(d.minimumPaymentCents)}/mo</div>
                  </div>
                  {!d.isPaidOff && (
                    <Button
                      onClick={() => {
                        setSelectedDebt(d);
                        setPayoffAmount('');
                        setIsPayoffModalOpen(true);
                      }}
                      variant="secondary"
                      className="w-full text-xs cursor-pointer"
                    >
                      Record Payment
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* New Account Modal */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title="Create Financial Account"
        size="md"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <Input
            label="Account Name"
            required
            value={accName}
            onChange={(e) => setAccName(e.target.value)}
            placeholder="e.g. Primary Checking"
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                Account Type
              </label>
              <select
                value={accType}
                onChange={(e) => setAccType(e.target.value as FinanceAccountType)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer touch-manipulation"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit Card</option>
                <option value="cash">Cash / Physical</option>
                <option value="loan">Loan</option>
                <option value="investment">Investment Account</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                Currency
              </label>
              <select
                value={accCurrency}
                onChange={(e) => setAccCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-mono touch-manipulation"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
            </div>
          </div>

          <Input
            label="Initial Balance"
            value={accBalance}
            onChange={(e) => setAccBalance(e.target.value)}
            placeholder="0.00"
            className="font-mono"
          />

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAccountModalOpen(false)}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              {submitting ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Transaction Modal */}
      <Modal
        isOpen={isTxnModalOpen}
        onClose={() => setIsTxnModalOpen(false)}
        title="Record Transaction"
        size="md"
      >
        <form onSubmit={handleCreateTransaction} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
              Account
            </label>
            <select
              value={txnAccountId}
              onChange={(e) => setTxnAccountId(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-mono touch-manipulation"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatMoney(a.balanceCents, a.currency)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                Type
              </label>
              <select
                value={txnType}
                onChange={(e) => setTxnType(e.target.value as FinanceTransactionType)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer touch-manipulation"
              >
                <option value="expense">Expense (-)</option>
                <option value="income">Income (+)</option>
              </select>
            </div>

            <div>
              <Input
                label="Amount (₹)"
                required
                value={txnAmount}
                onChange={(e) => setTxnAmount(e.target.value)}
                placeholder="0.00"
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <CategoryDropdown
              value={txnCategoryId}
              onChange={(id) => setTxnCategoryId(id)}
              domain="finance"
              categories={categories}
              onCategoriesChange={fetchFinanceData}
              label="Category (Optional)"
              placeholder="Search or pick category (e.g. Food 🌮 > Lunch 🥗)..."
            />
            <button
              type="button"
              onClick={() => {
                setCategoryPickerTarget('txn');
                setIsMobileCatSheetOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 mt-1.5 px-3 py-2.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all touch-manipulation cursor-pointer min-h-[44px]"
            >
              <span>Browse Category Grid</span>
              <IconChevronRight size={13} />
            </button>
          </div>

          <Input
            label="Payee / Description"
            value={txnPayee}
            onChange={(e) => setTxnPayee(e.target.value)}
            placeholder="e.g. Grocery Store, Payroll"
          />

          <div>
            <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono cursor-pointer touch-manipulation"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsTxnModalOpen(false)}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              {submitting ? 'Posting...' : 'Post Transaction'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Transfer Funds Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Atomic Account Transfer"
        size="md"
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
              From Account (Source)
            </label>
            <select
              value={transferFromId}
              onChange={(e) => setTransferFromId(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-mono touch-manipulation"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatMoney(a.balanceCents, a.currency)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
              To Account (Destination)
            </label>
            <select
              value={transferToId}
              onChange={(e) => setTransferToId(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-mono touch-manipulation"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatMoney(a.balanceCents, a.currency)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Transfer Amount (₹)"
                required
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="100.00"
                className="font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                Transfer Date
              </label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono cursor-pointer touch-manipulation"
              />
            </div>
          </div>

          <Input
            label="Transfer Notes"
            value={transferNotes}
            onChange={(e) => setTransferNotes(e.target.value)}
            placeholder="e.g. Monthly savings contribution"
          />

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsTransferModalOpen(false)}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              {submitting ? 'Transferring...' : 'Execute Transfer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Budget Modal */}
      <Modal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        title="Create Envelope Budget"
        size="md"
      >
        <form onSubmit={handleCreateBudget} className="space-y-4">
          <div className="space-y-1">
            <CategoryDropdown
              value={budgetCatId}
              onChange={(id) => setBudgetCatId(id)}
              domain="finance"
              categories={categories}
              onCategoriesChange={fetchFinanceData}
              label="Category"
              placeholder="Search or pick category (e.g. Food 🌮 > Groceries 🛒)..."
              required
            />
            <button
              type="button"
              onClick={() => {
                setCategoryPickerTarget('budget');
                setIsMobileCatSheetOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 mt-1.5 px-3 py-2.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all touch-manipulation cursor-pointer min-h-[44px]"
            >
              <span>Browse Category Grid</span>
              <IconChevronRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Monthly Limit (₹)"
                required
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="400.00"
                className="font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                Period
              </label>
              <select
                value={budgetPeriod}
                onChange={(e) => setBudgetPeriod(e.target.value as 'monthly' | 'yearly')}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer touch-manipulation"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsBudgetModalOpen(false)}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              {submitting ? 'Saving...' : 'Save Budget'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Debt Modal */}
      <Modal
        isOpen={isDebtModalOpen}
        onClose={() => setIsDebtModalOpen(false)}
        title="Log Debt or Loan"
        size="md"
      >
        <form onSubmit={handleCreateDebt} className="space-y-4">
          <Input
            label="Debt Name"
            required
            value={debtName}
            onChange={(e) => setDebtName(e.target.value)}
            placeholder="e.g. Visa Credit Card, Auto Loan"
            autoFocus
          />

          <Input
            label="Creditor / Institution"
            required
            value={debtCreditor}
            onChange={(e) => setDebtCreditor(e.target.value)}
            placeholder="e.g. Chase, Dept of Education"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Input
                label="Total Owed (₹)"
                required
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                placeholder="1000.00"
                className="font-mono"
              />
            </div>

            <div>
              <Input
                label="APR (%)"
                value={debtApr}
                onChange={(e) => setDebtApr(e.target.value)}
                placeholder="18.5"
                className="font-mono"
              />
            </div>

            <div>
              <Input
                label="Min Pmt (₹)"
                value={debtMinPayment}
                onChange={(e) => setDebtMinPayment(e.target.value)}
                placeholder="35.00"
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDebtModalOpen(false)}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              {submitting ? 'Saving...' : 'Save Debt'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Debt Payoff Modal */}
      <Modal
        isOpen={isPayoffModalOpen && Boolean(selectedDebt)}
        onClose={() => setIsPayoffModalOpen(false)}
        title={`Payoff Contribution: ${selectedDebt?.name || ''}`}
        size="md"
      >
        <form onSubmit={handleDebtPayoff} className="space-y-4">
          <Input
            label="Total Payment Amount (₹)"
            required
            value={payoffAmount}
            onChange={(e) => setPayoffAmount(e.target.value)}
            placeholder="350.00"
            className="font-mono"
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Principal Component (₹)"
              value={payoffPrincipal}
              onChange={(e) => setPayoffPrincipal(e.target.value)}
              placeholder="Leave blank for full amount"
              className="font-mono"
            />

            <Input
              label="Interest Component (₹)"
              value={payoffInterest}
              onChange={(e) => setPayoffInterest(e.target.value)}
              placeholder="0.00"
              className="font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
              Payment Date
            </label>
            <input
              type="date"
              value={payoffDate}
              onChange={(e) => setPayoffDate(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono cursor-pointer touch-manipulation"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsPayoffModalOpen(false)}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              {submitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </Modal>
      {/* Hierarchical Category Picker Modal (desktop fallback) */}
      <CategoryPickerModal
        isOpen={isCategoryPickerOpen}
        onClose={() => setIsCategoryPickerOpen(false)}
        selectedCategoryId={categoryPickerTarget === 'txn' ? txnCategoryId : budgetCatId}
        onSelectCategory={(cat) => {
          if (categoryPickerTarget === 'txn') {
            setTxnCategoryId(cat.id);
          } else {
            setBudgetCatId(cat.id);
          }
        }}
        domain="finance"
        categories={categories}
        onCategoriesChange={fetchFinanceData}
      />
      {/* Mobile Category Selection Bottom Sheet */}
      <MobileTransactionSheet
        isOpen={isMobileCatSheetOpen}
        onClose={() => setIsMobileCatSheetOpen(false)}
        selectedCategoryId={categoryPickerTarget === 'txn' ? txnCategoryId : budgetCatId}
        onSelectCategory={(cat) => {
          if (categoryPickerTarget === 'txn') {
            setTxnCategoryId(cat.id);
          } else {
            setBudgetCatId(cat.id);
          }
        }}
        categories={categories}
        onCategoriesChange={fetchFinanceData}
        kpi={mobileSheetKpi}
        domain="finance"
      />
    </div>
  );
}
