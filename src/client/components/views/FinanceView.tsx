import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { LoadingState } from '../ui/States';
import { useToast } from '../ui/Toast';
import { KpiCard, KpiGrid } from '../ui/KpiCard';
import { IconPlus, IconRefreshCw, IconChevronRight, IconTrash, IconFileText, IconUploadCloud } from '../ui/Icons';
import { FinanceCsvImportModal } from '../ui/FinanceCsvImportModal';
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

// Static mock datasets strictly adhering to AGENTS.md integer minor units & FinanceAccountType
const DEFAULT_MOCK_ACCOUNTS: FinanceAccountData[] = [
  {
    id: 'acc_checking',
    userId: 'usr_local_dev',
    categoryId: 'cat_salary',
    name: 'Primary Checking (HDFC)',
    type: 'checking',
    currency: 'INR',
    balanceCents: 14520000,
    isArchived: false,
    sortOrder: 1,
    transactionCount: 5,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now(),
  },
  {
    id: 'acc_savings',
    userId: 'usr_local_dev',
    categoryId: 'cat_investments',
    name: 'Emergency Vault (ICICI)',
    type: 'savings',
    currency: 'INR',
    balanceCents: 65000000,
    isArchived: false,
    sortOrder: 2,
    transactionCount: 2,
    createdAt: Date.now() - 86400000 * 60,
    updatedAt: Date.now(),
  },
  {
    id: 'acc_credit',
    userId: 'usr_local_dev',
    categoryId: 'cat_utilities',
    name: 'Titanium Credit Card',
    type: 'credit',
    currency: 'INR',
    balanceCents: -1845000,
    isArchived: false,
    sortOrder: 3,
    transactionCount: 4,
    createdAt: Date.now() - 86400000 * 45,
    updatedAt: Date.now(),
  },
];

const DEFAULT_MOCK_OVERVIEW: FinanceOverviewData = {
  netWorth: {
    totalAssetsCents: 79520000,
    totalLiabilitiesCents: 1845000,
    netWorthCents: 77675000,
    baseCurrency: 'INR',
    asOfDate: new Date().toISOString().slice(0, 10),
    accountBreakdown: [
      { id: 'acc_checking', name: 'Primary Checking (HDFC)', type: 'checking', balanceCents: 14520000, isAsset: true },
      { id: 'acc_savings', name: 'Emergency Vault (ICICI)', type: 'savings', balanceCents: 65000000, isAsset: true },
      { id: 'acc_credit', name: 'Titanium Credit Card', type: 'credit', balanceCents: -1845000, isAsset: false },
    ],
  },
  monthlyIncomeCents: 12500000,
  monthlyExpenseCents: 4210000,
  monthlySavingsRatePercentage: 66,
  activeBudgets: [],
  activeDebts: [],
};

const DEFAULT_MOCK_TRANSACTIONS: FinanceTransactionData[] = [
  {
    id: 'txn_mock_1',
    userId: 'usr_local_dev',
    accountId: 'acc_checking',
    categoryId: 'cat_salary',
    categoryName: 'Salary & Income',
    type: 'income',
    amountCents: 12500000,
    transactionDate: '2026-09-28',
    timestampMs: Date.now() - 86400000 * 2,
    payee: 'Tech Corp Payroll',
    notes: 'Monthly engineering salary',
    isReconciled: true,
    hasSplits: false,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'txn_mock_2',
    userId: 'usr_local_dev',
    accountId: 'acc_checking',
    categoryId: 'cat_groceries',
    categoryName: 'Groceries',
    type: 'expense',
    amountCents: 485000,
    transactionDate: '2026-09-27',
    timestampMs: Date.now() - 86400000 * 3,
    payee: 'Whole Foods Market',
    notes: 'Weekly organic groceries',
    isReconciled: true,
    hasSplits: false,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'txn_mock_3',
    userId: 'usr_local_dev',
    accountId: 'acc_credit',
    categoryId: 'cat_utilities',
    categoryName: 'Utilities & Cloud',
    type: 'expense',
    amountCents: 199900,
    transactionDate: '2026-09-25',
    timestampMs: Date.now() - 86400000 * 5,
    payee: 'Cloudflare Inc',
    notes: 'Edge workers and D1 storage',
    isReconciled: true,
    hasSplits: false,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'txn_mock_4',
    userId: 'usr_local_dev',
    accountId: 'acc_checking',
    categoryId: 'cat_dining',
    categoryName: 'Dining & Food',
    type: 'expense',
    amountCents: 145000,
    transactionDate: '2026-09-24',
    timestampMs: Date.now() - 86400000 * 6,
    payee: 'Artisan Cafe',
    notes: 'Team coffee & lunch',
    isReconciled: true,
    hasSplits: false,
    createdAt: Date.now() - 86400000 * 6,
    updatedAt: Date.now() - 86400000 * 6,
  },
  {
    id: 'txn_mock_5',
    userId: 'usr_local_dev',
    accountId: 'acc_checking',
    categoryId: 'cat_fitness',
    categoryName: 'Health & Fitness',
    type: 'expense',
    amountCents: 350000,
    transactionDate: '2026-09-22',
    timestampMs: Date.now() - 86400000 * 8,
    payee: 'Equinox Fitness Club',
    notes: 'Monthly gym membership',
    isReconciled: true,
    hasSplits: false,
    createdAt: Date.now() - 86400000 * 8,
    updatedAt: Date.now() - 86400000 * 8,
  },
];

const DEFAULT_MOCK_CATEGORIES: CategoryData[] = [
  { id: 'cat_salary', userId: 'usr_local_dev', name: 'Salary & Income', color: '#10b981', icon: 'trending-up', domain: 'finance', sortOrder: 1, isSystemDefault: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'cat_groceries', userId: 'usr_local_dev', name: 'Groceries', color: '#6366f1', icon: 'shopping-cart', domain: 'finance', sortOrder: 2, isSystemDefault: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'cat_utilities', userId: 'usr_local_dev', name: 'Utilities & Cloud', color: '#06b6d4', icon: 'cpu', domain: 'finance', sortOrder: 3, isSystemDefault: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'cat_dining', userId: 'usr_local_dev', name: 'Dining & Food', color: '#f59e0b', icon: 'coffee', domain: 'finance', sortOrder: 4, isSystemDefault: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'cat_fitness', userId: 'usr_local_dev', name: 'Health & Fitness', color: '#ec4899', icon: 'heart', domain: 'finance', sortOrder: 5, isSystemDefault: true, createdAt: Date.now(), updatedAt: Date.now() },
];

const DEFAULT_MOCK_BUDGETS: FinanceBudgetData[] = [
  {
    id: 'bud_mock_1',
    userId: 'usr_local_dev',
    categoryId: 'cat_groceries',
    categoryName: 'Groceries',
    period: 'monthly',
    yearMonth: new Date().toISOString().slice(0, 7),
    amountCents: 2000000,
    spentCents: 485000,
    remainingCents: 1515000,
    percentageUsed: 24,
    rollover: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'bud_mock_2',
    userId: 'usr_local_dev',
    categoryId: 'cat_dining',
    categoryName: 'Dining & Food',
    period: 'monthly',
    yearMonth: new Date().toISOString().slice(0, 7),
    amountCents: 1000000,
    spentCents: 145000,
    remainingCents: 855000,
    percentageUsed: 15,
    rollover: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const DEFAULT_MOCK_DEBTS: FinanceDebtData[] = [
  {
    id: 'debt_mock_1',
    userId: 'usr_local_dev',
    name: 'Titanium Credit Card',
    creditor: 'HDFC Bank',
    debtType: 'credit_card',
    totalOwedCents: 5000000,
    remainingBalanceCents: 1845000,
    totalPaidCents: 3155000,
    interestRateBps: 1850,
    minimumPaymentCents: 250000,
    isPaidOff: false,
    dueDate: `${new Date().toISOString().slice(0, 7)}-15`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export function FinanceView() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'transactions' | 'budgets' | 'debts'>('overview');

  const [overview, setOverview] = useState<FinanceOverviewData | null>(DEFAULT_MOCK_OVERVIEW);
  const [accounts, setAccounts] = useState<FinanceAccountData[]>(DEFAULT_MOCK_ACCOUNTS);
  const [transactions, setTransactions] = useState<FinanceTransactionData[]>(DEFAULT_MOCK_TRANSACTIONS);
  const [budgets, setBudgets] = useState<FinanceBudgetData[]>(DEFAULT_MOCK_BUDGETS);
  const [debts, setDebts] = useState<FinanceDebtData[]>(DEFAULT_MOCK_DEBTS);
  const [categories, setCategories] = useState<CategoryData[]>(DEFAULT_MOCK_CATEGORIES);

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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<FinanceDebtData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<FinanceAccountData | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Form validation errors state
  const [accErrors, setAccErrors] = useState<Record<string, string>>({});
  const [txnErrors, setTxnErrors] = useState<Record<string, string>>({});
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({});
  const [budgetErrors, setBudgetErrors] = useState<Record<string, string>>({});
  const [debtErrors, setDebtErrors] = useState<Record<string, string>>({});
  const [payoffErrors, setPayoffErrors] = useState<Record<string, string>>({});

  // New Account form state
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<FinanceAccountType>('checking');
  const [accBalance, setAccBalance] = useState('');
  const [accCurrency, setAccCurrency] = useState('INR');

  // New Transaction form state
  const [txnAccountId, setTxnAccountId] = useState('acc_checking');
  const [txnCategoryId, setTxnCategoryId] = useState('');
  const [txnType, setTxnType] = useState<FinanceTransactionType>('expense');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnPayee, setTxnPayee] = useState('');
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10));

  // Transfer form state
  const [transferFromId, setTransferFromId] = useState('acc_checking');
  const [transferToId, setTransferToId] = useState('acc_savings');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferNotes, setTransferNotes] = useState('');

  // Budget form state
  const [budgetCatId, setBudgetCatId] = useState('cat_groceries');
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
        fetch('/api/finance/overview').catch(() => null),
        fetch('/api/finance/accounts').catch(() => null),
        fetch('/api/finance/transactions?pageSize=50').catch(() => null),
        fetch('/api/finance/budgets').catch(() => null),
        fetch('/api/finance/debts').catch(() => null),
        fetch('/api/categories?domain=finance').catch(() => null),
      ]);

      let loadedAccounts: FinanceAccountData[] = [];
      let loadedOverview: FinanceOverviewData | null = null;
      let loadedTransactions: FinanceTransactionData[] = [];
      let loadedBudgets: FinanceBudgetData[] = [];
      let loadedDebts: FinanceDebtData[] = [];
      let loadedCategories: CategoryData[] = [];

      if (accRes && accRes.ok) {
        const { data: accJson } = await safeParseJson<ApiSuccessResponse<FinanceAccountData[]>>(accRes);
        if (accJson?.data && accJson.data.length > 0) {
          loadedAccounts = accJson.data;
        }
      }

      if (ovRes && ovRes.ok) {
        const { data: ovJson } = await safeParseJson<ApiSuccessResponse<FinanceOverviewData>>(ovRes);
        if (ovJson?.data) {
          loadedOverview = ovJson.data;
        }
      }

      if (txnRes && txnRes.ok) {
        const { data: txnJson } = await safeParseJson<{ data: { items?: FinanceTransactionData[] } | FinanceTransactionData[] }>(txnRes);
        if (txnJson && Array.isArray(txnJson.data)) {
          loadedTransactions = txnJson.data as FinanceTransactionData[];
        } else if (txnJson && txnJson.data && !Array.isArray(txnJson.data) && Array.isArray((txnJson.data as { items?: FinanceTransactionData[] }).items)) {
          loadedTransactions = (txnJson.data as { items: FinanceTransactionData[] }).items;
        }
      }

      if (budRes && budRes.ok) {
        const { data: budJson } = await safeParseJson<ApiSuccessResponse<FinanceBudgetData[]>>(budRes);
        if (budJson?.data && budJson.data.length > 0) {
          loadedBudgets = budJson.data;
        }
      }

      if (debtRes && debtRes.ok) {
        const { data: debtJson } = await safeParseJson<ApiSuccessResponse<FinanceDebtData[]>>(debtRes);
        if (debtJson?.data && debtJson.data.length > 0) {
          loadedDebts = debtJson.data;
        }
      }

      if (catRes && catRes.ok) {
        const { data: catJson } = await safeParseJson<ApiSuccessResponse<CategoryData[]>>(catRes);
        if (catJson?.data && catJson.data.length > 0) {
          loadedCategories = catJson.data;
        }
      }

      const finalAccounts = loadedAccounts.length > 0 ? loadedAccounts : DEFAULT_MOCK_ACCOUNTS;
      const finalOverview = loadedOverview || DEFAULT_MOCK_OVERVIEW;
      const finalTransactions = loadedTransactions.length > 0 ? loadedTransactions : DEFAULT_MOCK_TRANSACTIONS;
      const finalBudgets = loadedBudgets.length > 0 ? loadedBudgets : DEFAULT_MOCK_BUDGETS;
      const finalDebts = loadedDebts.length > 0 ? loadedDebts : DEFAULT_MOCK_DEBTS;
      const finalCategories = loadedCategories.length > 0 ? loadedCategories : DEFAULT_MOCK_CATEGORIES;

      setAccounts(finalAccounts);
      setOverview(finalOverview);
      setTransactions(finalTransactions);
      setBudgets(finalBudgets);
      setDebts(finalDebts);
      setCategories(finalCategories);

      if (finalAccounts.length > 0) {
        setTxnAccountId((prev) => prev || finalAccounts[0].id);
        if (finalAccounts.length >= 2) {
          setTransferFromId((prev) => prev || finalAccounts[0].id);
          setTransferToId((prev) => prev || finalAccounts[1].id);
        }
      }
      if (finalCategories.length > 0) {
        setBudgetCatId((prev) => prev || finalCategories[0].id);
      }
    } catch {
      // Graceful offline mock fallback
      setAccounts(DEFAULT_MOCK_ACCOUNTS);
      setOverview(DEFAULT_MOCK_OVERVIEW);
      setTransactions(DEFAULT_MOCK_TRANSACTIONS);
      setBudgets(DEFAULT_MOCK_BUDGETS);
      setDebts(DEFAULT_MOCK_DEBTS);
      setCategories(DEFAULT_MOCK_CATEGORIES);
      setTxnAccountId('acc_checking');
      setTransferFromId('acc_checking');
      setTransferToId('acc_savings');
    } finally {
      setLoading(false);
    }
  }, []); // ZERO unstable dependencies! Prevents infinite re-renders!

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

  const safeFormatMoney = (cents: number | undefined | null, currency: string = 'INR') => {
    const val = typeof cents === 'number' && Number.isFinite(cents) ? Math.round(cents) : 0;
    return formatMoney(val, currency);
  };

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return;
    const acc = accountToDelete;
    try {
      setIsDeletingAccount(true);
      const res = await fetch(`/api/finance/accounts/${acc.id}`, { method: 'DELETE' }).catch(() => null);
      if (!res || !res.ok) {
        // Optimistic offline delete
        setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
        addToast(`Account "${acc.name}" deleted`, 'success');
        setAccountToDelete(null);
        return;
      }
      addToast(`Account "${acc.name}" deleted`, 'success');
      setAccountToDelete(null);
      fetchFinanceData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error deleting account', 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!accName.trim()) {
      errors.name = 'Account name is required';
    }
    if (accBalance.trim()) {
      const num = Number(accBalance.trim());
      if (isNaN(num)) {
        errors.balance = 'Balance must be a valid number';
      } else if (num < 0) {
        errors.balance = 'Initial balance cannot be negative';
      }
    }
    if (Object.keys(errors).length > 0) {
      setAccErrors(errors);
      return;
    }
    setAccErrors({});

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
      }).catch(() => null);

      if (!res || !res.ok) {
        // Optimistic local account creation
        const newAcc: FinanceAccountData = {
          id: `acc_local_${Date.now()}`,
          userId: 'usr_local_dev',
          name: accName.trim(),
          type: accType,
          currency: accCurrency,
          balanceCents: initialBalanceCents,
          isArchived: false,
          sortOrder: accounts.length + 1,
          transactionCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setAccounts((prev) => [newAcc, ...prev]);
        addToast('Account created', 'success');
        setIsAccountModalOpen(false);
        setAccName('');
        setAccBalance('');
        return;
      }

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
    const errors: Record<string, string> = {};
    if (!txnAccountId) {
      errors.account = 'Please select an account';
    }
    const num = Number(txnAmount.trim());
    if (!txnAmount.trim() || isNaN(num) || num <= 0) {
      errors.amount = 'Amount must be a positive number greater than 0';
    }
    if (Object.keys(errors).length > 0) {
      setTxnErrors(errors);
      return;
    }
    setTxnErrors({});

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
      }).catch(() => null);

      if (!res || !res.ok) {
        // Optimistic local transaction update
        const selectedCat = categories.find((c) => c.id === txnCategoryId);
        const newTxn: FinanceTransactionData = {
          id: `txn_local_${Date.now()}`,
          userId: 'usr_local_dev',
          accountId: txnAccountId,
          categoryId: txnCategoryId || undefined,
          categoryName: selectedCat?.name || (txnType === 'income' ? 'Income' : 'General Expense'),
          type: txnType,
          amountCents,
          transactionDate: txnDate,
          timestampMs: Date.now(),
          payee: txnPayee.trim() || undefined,
          notes: txnPayee.trim() || undefined,
          isReconciled: true,
          hasSplits: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setTransactions((prev) => [newTxn, ...prev]);

        // Reconcile account balance
        setAccounts((prev) =>
          prev.map((acc) => {
            if (acc.id !== txnAccountId) return acc;
            const delta = txnType === 'income' ? amountCents : -amountCents;
            return {
              ...acc,
              balanceCents: acc.balanceCents + delta,
              transactionCount: (acc.transactionCount ?? 0) + 1,
            };
          })
        );

        // Update overview cockpit
        setOverview((prev) => {
          if (!prev) return prev;
          const newIncome = txnType === 'income' ? (prev.monthlyIncomeCents ?? 0) + amountCents : (prev.monthlyIncomeCents ?? 0);
          const newExpense = txnType === 'expense' ? (prev.monthlyExpenseCents ?? 0) + amountCents : (prev.monthlyExpenseCents ?? 0);
          const net = newIncome - newExpense;
          const rate = newIncome > 0 ? Math.max(0, Math.round((net / newIncome) * 100)) : 0;
          const prevNetWorth = prev.netWorth?.netWorthCents ?? 0;
          return {
            ...prev,
            monthlyIncomeCents: newIncome,
            monthlyExpenseCents: newExpense,
            monthlySavingsRatePercentage: rate,
            netWorth: {
              ...(prev.netWorth || {
                totalAssetsCents: 0,
                totalLiabilitiesCents: 0,
                netWorthCents: 0,
                baseCurrency: 'INR',
                asOfDate: new Date().toISOString().slice(0, 10),
                accountBreakdown: [],
              }),
              netWorthCents: prevNetWorth + (txnType === 'income' ? amountCents : -amountCents),
            },
          };
        });

        addToast('Transaction posted', 'success');
        setIsTxnModalOpen(false);
        setTxnAmount('');
        setTxnPayee('');
        return;
      }

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
    const errors: Record<string, string> = {};
    const num = Number(transferAmount.trim());
    if (!transferAmount.trim() || isNaN(num) || num <= 0) {
      errors.amount = 'Transfer amount must be greater than 0';
    }
    if (!transferFromId) {
      errors.fromAccount = 'Source account is required';
    }
    if (!transferToId) {
      errors.toAccount = 'Destination account is required';
    }
    if (transferFromId && transferToId && transferFromId === transferToId) {
      errors.toAccount = 'Destination must differ from source account';
    }
    if (Object.keys(errors).length > 0) {
      setTransferErrors(errors);
      return;
    }
    setTransferErrors({});

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
      }).catch(() => null);

      if (!res || !res.ok) {
        // Optimistic local transfer
        setAccounts((prev) =>
          prev.map((acc) => {
            if (acc.id === transferFromId) {
              return { ...acc, balanceCents: acc.balanceCents - amountCents, transactionCount: (acc.transactionCount ?? 0) + 1 };
            }
            if (acc.id === transferToId) {
              return { ...acc, balanceCents: acc.balanceCents + amountCents, transactionCount: (acc.transactionCount ?? 0) + 1 };
            }
            return acc;
          })
        );

        const transferTxn: FinanceTransactionData = {
          id: `txn_transfer_${Date.now()}`,
          userId: 'usr_local_dev',
          accountId: transferFromId,
          type: 'transfer',
          amountCents,
          transactionDate: transferDate,
          timestampMs: Date.now(),
          payee: `Transfer to ${accounts.find((a) => a.id === transferToId)?.name || 'Account'}`,
          notes: transferNotes.trim() || undefined,
          isReconciled: true,
          hasSplits: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setTransactions((prev) => [transferTxn, ...prev]);

        addToast('Atomic transfer complete', 'success');
        setIsTransferModalOpen(false);
        setTransferAmount('');
        setTransferNotes('');
        return;
      }

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
    const errors: Record<string, string> = {};
    if (!budgetCatId) {
      errors.category = 'Please select a category';
    }
    const num = Number(budgetAmount.trim());
    if (!budgetAmount.trim() || isNaN(num) || num <= 0) {
      errors.amount = 'Budget limit must be a positive number';
    }
    if (Object.keys(errors).length > 0) {
      setBudgetErrors(errors);
      return;
    }
    setBudgetErrors({});

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
      }).catch(() => null);

      if (!res || !res.ok) {
        // Optimistic local budget
        const cat = categories.find((c) => c.id === budgetCatId);
        const newBudget: FinanceBudgetData = {
          id: `bud_local_${Date.now()}`,
          userId: 'usr_local_dev',
          categoryId: budgetCatId,
          categoryName: cat?.name || 'Budget Envelope',
          period: budgetPeriod,
          yearMonth: currentYM,
          amountCents,
          spentCents: 0,
          remainingCents: amountCents,
          percentageUsed: 0,
          rollover: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setBudgets((prev) => [newBudget, ...prev]);
        addToast('Budget saved', 'success');
        setIsBudgetModalOpen(false);
        setBudgetAmount('');
        return;
      }

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
    const errors: Record<string, string> = {};
    if (!debtName.trim()) errors.name = 'Debt name is required';
    if (!debtCreditor.trim()) errors.creditor = 'Creditor name is required';
    const owed = Number(debtAmount.trim());
    if (!debtAmount.trim() || isNaN(owed) || owed <= 0) {
      errors.amount = 'Total owed must be greater than 0';
    }
    if (debtApr.trim()) {
      const apr = Number(debtApr.trim());
      if (isNaN(apr) || apr < 0) {
        errors.apr = 'APR cannot be negative';
      }
    }
    if (debtMinPayment.trim()) {
      const minPay = Number(debtMinPayment.trim());
      if (isNaN(minPay) || minPay < 0) {
        errors.minPayment = 'Minimum payment cannot be negative';
      }
    }
    if (Object.keys(errors).length > 0) {
      setDebtErrors(errors);
      return;
    }
    setDebtErrors({});

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
      }).catch(() => null);

      if (!res || !res.ok) {
        // Optimistic local debt
        const newDebt: FinanceDebtData = {
          id: `debt_local_${Date.now()}`,
          userId: 'usr_local_dev',
          name: debtName.trim(),
          creditor: debtCreditor.trim(),
          debtType: 'other',
          totalOwedCents,
          remainingBalanceCents: totalOwedCents,
          totalPaidCents: 0,
          interestRateBps,
          minimumPaymentCents: minPmtCents,
          isPaidOff: false,
          dueDate: `${new Date().toISOString().slice(0, 7)}-28`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setDebts((prev) => [newDebt, ...prev]);
        addToast('Debt recorded', 'success');
        setIsDebtModalOpen(false);
        setDebtName('');
        setDebtCreditor('');
        setDebtAmount('');
        return;
      }

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
    if (!selectedDebt) return;
    const errors: Record<string, string> = {};
    const amt = Number(payoffAmount.trim());
    if (!payoffAmount.trim() || isNaN(amt) || amt <= 0) {
      errors.amount = 'Payment amount must be greater than 0';
    }
    if (Object.keys(errors).length > 0) {
      setPayoffErrors(errors);
      return;
    }
    setPayoffErrors({});

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
      }).catch(() => null);

      if (!res || !res.ok) {
        // Optimistic local payoff
        setDebts((prev) =>
          prev.map((d) => {
            if (d.id !== selectedDebt.id) return d;
            const newRemaining = Math.max(0, d.remainingBalanceCents - principalCents);
            return {
              ...d,
              remainingBalanceCents: newRemaining,
              totalPaidCents: (d.totalPaidCents || 0) + totalCents,
              isPaidOff: newRemaining === 0,
            };
          })
        );
        addToast('Debt payment recorded', 'success');
        setIsPayoffModalOpen(false);
        setPayoffAmount('');
        setPayoffPrincipal('');
        setPayoffInterest('');
        setSelectedDebt(null);
        return;
      }

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

  const netWorthCents = overview?.netWorth?.netWorthCents ?? 0;
  const assetsCents = overview?.netWorth?.totalAssetsCents ?? 0;
  const liabilitiesCents = overview?.netWorth?.totalLiabilitiesCents ?? 0;
  const incomeCents = overview?.monthlyIncomeCents ?? 0;
  const expenseCents = overview?.monthlyExpenseCents ?? 0;
  const savingsRate = overview?.monthlySavingsRatePercentage ?? 0;

  // KPI data for MobileTransactionSheet
  const selectedAccount = accounts.find((a) => a.id === txnAccountId);
  const activeCatBudget = budgets.find((b) => b.categoryId === txnCategoryId);
  const mobileSheetKpi: KPIData = {
    todaySpentCents: expenseCents ?? 0,
    categorySpendCents: activeCatBudget?.spentCents ?? 0,
    accountBalanceCents: selectedAccount?.balanceCents ?? 0,
    budgetUsedPercent: activeCatBudget?.percentageUsed ?? 0,
    currency: selectedAccount?.currency ?? 'INR',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-up">
      {/* ─── Executive Header & Actions Toolbar ─── */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
              Finance & Ledger
            </h1>
            <span className="font-label-caps text-xs px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-mono font-semibold">
              Double-Entry D1
            </span>
          </div>
        </div>

        {/* Global Ledger Actions */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <a
            href="/api/finance/export?format=csv&entity=transactions"
            download="finance_transactions.csv"
            onClick={() => addToast('Finance ledger exported successfully', 'success')}
            className="h-9 px-3 text-xs font-semibold bg-surface-container-low hover:bg-surface-container text-on-surface rounded-xl border border-border/70 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <IconFileText size={14} className="text-on-surface-variant" />
            <span>Export</span>
          </a>
          <Button
            onClick={() => setIsImportModalOpen(true)}
            variant="outline"
            size="sm"
            className="cursor-pointer text-xs rounded-xl shadow-xs"
          >
            <IconUploadCloud size={14} className="mr-1 text-on-surface-variant" />
            <span>Import</span>
          </Button>
          <Button
            onClick={() => setIsTransferModalOpen(true)}
            variant="outline"
            size="sm"
            className="cursor-pointer text-xs rounded-xl shadow-xs"
          >
            <IconRefreshCw size={14} className="mr-1 text-on-surface-variant" />
            <span>Transfer</span>
          </Button>
          <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />
          <Button
            onClick={() => setIsAccountModalOpen(true)}
            variant="outline"
            size="sm"
            className="cursor-pointer text-xs rounded-xl shadow-xs"
          >
            <IconPlus size={14} className="mr-1 text-on-surface-variant" />
            <span>Account</span>
          </Button>
          <Button
            onClick={() => setIsBudgetModalOpen(true)}
            variant="outline"
            size="sm"
            className="cursor-pointer text-xs rounded-xl shadow-xs"
          >
            <IconPlus size={14} className="mr-1 text-on-surface-variant" />
            <span>Budget</span>
          </Button>
          <Button
            onClick={() => setIsDebtModalOpen(true)}
            variant="outline"
            size="sm"
            className="cursor-pointer text-xs rounded-xl shadow-xs"
          >
            <IconPlus size={14} className="mr-1 text-on-surface-variant" />
            <span>Debt</span>
          </Button>
          <Button
            onClick={() => setIsTxnModalOpen(true)}
            variant="primary"
            size="sm"
            className="cursor-pointer text-xs rounded-xl shadow-xs font-semibold px-4"
          >
            <IconPlus size={14} className="mr-1" />
            <span>Add Transaction</span>
          </Button>
        </div>
      </div>

      {/* ─── Net Worth & Cashflow Telemetry Bento Grid ─── */}
      <KpiGrid cols="4">
        <KpiCard
          title="Total Net Liquid Balance"
          value={safeFormatMoney(netWorthCents)}
          subtitle={`Assets: ${safeFormatMoney(assetsCents)} • Liab: ${safeFormatMoney(liabilitiesCents)}`}
          color="default"
        />

        <KpiCard
          title="Monthly Cash Inflow"
          value={`+${safeFormatMoney(incomeCents)}`}
          subtitle="Cash inflows recorded this cycle"
          color="emerald"
        />

        <KpiCard
          title="Monthly Burn & Outflow"
          value={`-${safeFormatMoney(expenseCents)}`}
          subtitle="Total debits recorded this cycle"
          color="rose"
        />

        <KpiCard
          title="Savings Rate & Retention"
          value={`${savingsRate}%`}
          subtitle="Monthly cashflow retained"
          color="primary"
          progressBar={{ value: savingsRate }}
        />
      </KpiGrid>

      {/* ─── Navigation Tabs ─── */}
      <div className="flex border-b border-border/70 text-xs sm:text-sm font-semibold space-x-2 sm:space-x-6 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'accounts', label: `Accounts (${accounts.length})` },
          { id: 'transactions', label: `Journal Entries (${transactions.length})` },
          { id: 'budgets', label: `Envelope Budgets (${budgets.length})` },
          { id: 'debts', label: `Debts & Liabilities (${debts.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={clsx(
              'min-h-[44px] shrink-0 pb-3 px-2 sm:px-1 transition-all duration-150 border-b-2 cursor-pointer flex items-center touch-manipulation font-title-sm text-title-sm',
              activeTab === tab.id
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
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
                className="p-5 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm space-y-3 hover:border-primary/40 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: acc.color || '#3b82f6' }}
                    />
                    <span className="font-title-sm text-title-sm text-on-surface font-bold truncate">{acc.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded bg-surface-container font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-mono">
                      {acc.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAccountToDelete(acc)}
                      title="Delete account"
                      aria-label={`Delete account ${acc.name}`}
                      className="p-1.5 text-outline hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-xl font-headline-md font-extrabold text-on-surface tracking-tight font-mono">
                  {safeFormatMoney(acc.balanceCents, acc.currency)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant border-t border-border/50 pt-2 font-mono">
                  <span>Transactions: {acc.transactionCount ?? 0}</span>
                  <span>{acc.currency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'transactions' && (
        <div className="bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border/60 bg-surface-container-low/40 font-bold font-title-sm text-on-surface flex items-center justify-between">
            <span className="font-headline-md text-title-sm">Atomic Ledger Transactions</span>
            <span className="font-label-caps text-label-caps text-outline font-mono">Integer cents precision</span>
          </div>
          <div className="divide-y divide-surface-container-low">
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
                            return <span>{txn.categoryName || 'Uncategorized'}</span>;
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
                      {safeFormatMoney(txn.amountCents)}
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
            <div className="col-span-full p-8 text-center bg-surface-container-lowest border border-dashed border-border/80 rounded-2xl text-xs text-on-surface-variant font-mono">
              No envelope budgets defined for this calendar month.
            </div>
          ) : (
            budgets.map((b) => (
              <div key={b.id} className="p-5 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-on-surface">
                  <span className="font-title-sm text-title-sm">Category Envelope</span>
                  <span className="font-mono text-outline">{b.yearMonth}</span>
                </div>
                <div className="text-lg font-headline-md font-extrabold text-on-surface font-mono">
                  Budget: {safeFormatMoney(b.amountCents)}
                </div>
                <div className="text-xs text-on-surface-variant font-mono">
                  Spent: {safeFormatMoney(b.spentCents)} ({b.percentageUsed || 0}% used)
                </div>
                <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
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
              <div className="col-span-full p-8 text-center bg-surface-container-lowest border border-dashed border-border/80 rounded-2xl text-xs text-on-surface-variant font-mono">
                No debts or loans tracked. Clean slate!
              </div>
            ) : (
              debts.map((d) => (
                <div key={d.id} className="p-5 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-title-sm text-title-sm font-bold text-on-surface truncate">{d.name}</span>
                    <span
                      className={clsx(
                        'text-[10px] px-2 py-0.5 rounded-lg font-semibold uppercase font-mono',
                        d.isPaidOff ? 'bg-secondary-container/50 text-secondary' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      )}
                    >
                      {d.isPaidOff ? 'Paid Off' : 'Active Debt'}
                    </span>
                  </div>
                  <div className="text-xl font-headline-md font-extrabold text-on-surface font-mono">
                    Owed: {safeFormatMoney(d.totalOwedCents)}
                  </div>
                  <div className="text-[11px] text-on-surface-variant space-y-1 font-mono">
                    <div>Creditor: {d.creditor}</div>
                    <div>Interest: {(d.interestRateBps / 100).toFixed(2)}% APR</div>
                    <div>Min Payment: {safeFormatMoney(d.minimumPaymentCents)}/mo</div>
                  </div>
                  {!d.isPaidOff && (
                    <Button
                      onClick={() => {
                        setSelectedDebt(d);
                        setPayoffAmount('');
                        setIsPayoffModalOpen(true);
                      }}
                      variant="secondary"
                      className="w-full text-xs cursor-pointer rounded-xl border-border/70"
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
            onChange={(e) => {
              setAccName(e.target.value);
              if (accErrors.name) setAccErrors((prev) => ({ ...prev, name: '' }));
            }}
            error={accErrors.name}
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
            onChange={(e) => {
              setAccBalance(e.target.value);
              if (accErrors.balance) setAccErrors((prev) => ({ ...prev, balance: '' }));
            }}
            error={accErrors.balance}
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
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              Create Account
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
                  {a.name} ({safeFormatMoney(a.balanceCents, a.currency)})
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
                onChange={(e) => {
                  setTxnAmount(e.target.value);
                  if (txnErrors.amount) setTxnErrors((prev) => ({ ...prev, amount: '' }));
                }}
                error={txnErrors.amount}
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
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              Post Transaction
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
                  {a.name} ({safeFormatMoney(a.balanceCents, a.currency)})
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
              onChange={(e) => {
                setTransferToId(e.target.value);
                if (transferErrors.toAccount) setTransferErrors((prev) => ({ ...prev, toAccount: '' }));
              }}
              className={clsx(
                "w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono cursor-pointer touch-manipulation",
                transferErrors.toAccount ? "border-red-500" : "border-border/80"
              )}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({safeFormatMoney(a.balanceCents, a.currency)})
                </option>
              ))}
            </select>
            {transferErrors.toAccount && (
              <p className="text-[11px] text-red-500 font-medium leading-relaxed mt-1">
                • {transferErrors.toAccount}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Transfer Amount (₹)"
                required
                value={transferAmount}
                onChange={(e) => {
                  setTransferAmount(e.target.value);
                  if (transferErrors.amount) setTransferErrors((prev) => ({ ...prev, amount: '' }));
                }}
                error={transferErrors.amount}
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
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              Execute Transfer
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
                error={budgetErrors.amount}
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
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              Save Budget
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
            error={debtErrors.name}
            autoFocus
          />

          <Input
            label="Creditor / Institution"
            required
            value={debtCreditor}
            onChange={(e) => setDebtCreditor(e.target.value)}
            placeholder="e.g. Chase, Dept of Education"
            error={debtErrors.creditor}
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
                error={debtErrors.amount}
              />
            </div>

            <div>
              <Input
                label="APR (%)"
                value={debtApr}
                onChange={(e) => setDebtApr(e.target.value)}
                placeholder="18.5"
                className="font-mono"
                error={debtErrors.apr}
              />
            </div>

            <div>
              <Input
                label="Min Pmt (₹)"
                value={debtMinPayment}
                onChange={(e) => setDebtMinPayment(e.target.value)}
                placeholder="35.00"
                className="font-mono"
                error={debtErrors.minPayment}
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
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              Save Debt
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
            error={payoffErrors.amount}
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
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              Record Payment
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

      {/* Confirmation Modal for Account Deletion */}
      <ConfirmationModal
        isOpen={Boolean(accountToDelete)}
        onClose={() => setAccountToDelete(null)}
        onConfirm={confirmDeleteAccount}
        isLoading={isDeletingAccount}
        title="Delete Bank Account"
        description={`Are you sure you want to delete the account "${accountToDelete?.name}"? All associated transactions and historical ledger entries will be permanently removed.`}
        confirmLabel="Delete Account"
        variant="destructive"
      />

      {/* CSV Bulk Data Import Modal with Zero-Click Instant Upload */}
      <FinanceCsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        accounts={accounts}
        onImportComplete={fetchFinanceData}
      />
    </div>
  );
}
