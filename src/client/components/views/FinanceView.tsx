import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { LoadingState } from '../ui/States';
import { useToast } from '../ui/Toast';
import { KpiCard, KpiGrid } from '../ui/KpiCard';
import { IconPlus, IconRefreshCw, IconChevronRight, IconTrash, IconFileText, IconUploadCloud, IconEdit, IconSearch, IconCreditCard } from '../ui/Icons';
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

export function FinanceView() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'transactions' | 'budgets' | 'debts'>('overview');

  const [_overview, setOverview] = useState<FinanceOverviewData | null>(null);
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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<FinanceDebtData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<FinanceAccountData | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccountData | null>(null);

  const [editingBudget, setEditingBudget] = useState<FinanceBudgetData | null>(null);
  const [budgetToDelete, setBudgetToDelete] = useState<FinanceBudgetData | null>(null);
  const [isDeletingBudget, setIsDeletingBudget] = useState(false);

  const [editingDebt, setEditingDebt] = useState<FinanceDebtData | null>(null);
  const [debtToDelete, setDebtToDelete] = useState<FinanceDebtData | null>(null);
  const [isDeletingDebt, setIsDeletingDebt] = useState(false);

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

  // Transactions Filter & Edit State (Active Filters)
  const [txnSearch, setTxnSearch] = useState('');
  const [txnFilterType, setTxnFilterType] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [txnFilterCat, setTxnFilterCat] = useState<string>('all');
  const [isEditTxnModalOpen, setIsEditTxnModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<FinanceTransactionData | null>(null);
  const [editTxnAmount, setEditTxnAmount] = useState('');
  const [editTxnPayee, setEditTxnPayee] = useState('');
  const [editTxnDate, setEditTxnDate] = useState(new Date().toISOString().slice(0, 10));
  const [editTxnCategoryId, setEditTxnCategoryId] = useState('');
  const [editTxnType, setEditTxnType] = useState<FinanceTransactionType>('expense');

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

      setAccounts(loadedAccounts);
      setOverview(loadedOverview);
      setTransactions(loadedTransactions);
      setBudgets(loadedBudgets);
      setDebts(loadedDebts);
      setCategories(loadedCategories);

      if (loadedAccounts.length > 0) {
        setTxnAccountId((prev) => prev || loadedAccounts[0].id);
        if (loadedAccounts.length >= 2) {
          setTransferFromId((prev) => prev || loadedAccounts[0].id);
          setTransferToId((prev) => prev || loadedAccounts[1].id);
        } else {
          setTransferFromId((prev) => prev || loadedAccounts[0].id);
          setTransferToId((prev) => prev || loadedAccounts[0].id);
        }
      }
      if (loadedCategories.length > 0) {
        setBudgetCatId((prev) => prev || loadedCategories[0].id);
      }
    } catch {
      setAccounts([]);
      setOverview(null);
      setTransactions([]);
      setBudgets([]);
      setDebts([]);
      setCategories([]);
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

  const handleOpenCreateAccount = () => {
    setEditingAccount(null);
    setAccName('');
    setAccType('checking');
    setAccBalance('');
    setAccCurrency('INR');
    setAccErrors({});
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: FinanceAccountData) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccCurrency(acc.currency);
    setAccBalance('');
    setAccErrors({});
    setIsAccountModalOpen(true);
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

      if (editingAccount) {
        await fetch(`/api/finance/accounts/${editingAccount.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: accName.trim(),
            type: accType,
            currency: accCurrency,
          }),
        }).catch(() => null);

        setAccounts((prev) =>
          prev.map((a) =>
            a.id === editingAccount.id
              ? { ...a, name: accName.trim(), type: accType, currency: accCurrency, updatedAt: Date.now() }
              : a
          )
        );
        addToast(`Account "${accName.trim()}" updated`, 'success');
        setIsAccountModalOpen(false);
        setEditingAccount(null);
        setAccName('');
        setAccBalance('');
        fetchFinanceData();
        return;
      }

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

  // Real-time Delete Transaction with optimistic balance reversal
  const handleDeleteTransaction = async (txn: FinanceTransactionData) => {
    // 1. Optimistic real-time UI state update
    setTransactions((prev) => prev.filter((t) => t.id !== txn.id));

    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === txn.accountId) {
          const delta = txn.type === 'income' ? -txn.amountCents : txn.amountCents;
          return {
            ...acc,
            balanceCents: acc.balanceCents + delta,
            transactionCount: Math.max(0, (acc.transactionCount ?? 1) - 1),
          };
        }
        if (txn.type === 'transfer' && acc.id === txn.transferAccountId) {
          return {
            ...acc,
            balanceCents: acc.balanceCents - txn.amountCents,
            transactionCount: Math.max(0, (acc.transactionCount ?? 1) - 1),
          };
        }
        return acc;
      })
    );

    addToast(`Transaction "${txn.payee || txn.categoryName || 'Entry'}" deleted`, 'info');

    // 2. Background database sync
    try {
      await fetch(`/api/finance/transactions/${txn.id}`, { method: 'DELETE' });
    } catch {
      // offline/optimistic already applied
    }
  };

  // Real-time Edit Transaction handler
  const handleOpenEditTxn = (txn: FinanceTransactionData) => {
    setEditingTxn(txn);
    setEditTxnAmount((txn.amountCents / 100).toString());
    setEditTxnPayee(txn.payee || '');
    setEditTxnDate(txn.transactionDate);
    setEditTxnCategoryId(txn.categoryId || '');
    setEditTxnType(txn.type);
    setIsEditTxnModalOpen(true);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxn) return;
    const num = Number(editTxnAmount.trim());
    if (!editTxnAmount.trim() || isNaN(num) || num <= 0) {
      addToast('Amount must be a positive number', 'error');
      return;
    }

    const newAmountCents = Math.round(num * 100);
    const amountDelta = newAmountCents - editingTxn.amountCents;
    const selectedCat = categories.find((c) => c.id === editTxnCategoryId);

    const updatedTxn: FinanceTransactionData = {
      ...editingTxn,
      amountCents: newAmountCents,
      payee: editTxnPayee.trim() || undefined,
      transactionDate: editTxnDate,
      categoryId: editTxnCategoryId || undefined,
      categoryName: selectedCat?.name || editingTxn.categoryName,
      type: editTxnType,
      updatedAt: Date.now(),
    };

    // 1. Optimistic real-time UI state update
    setTransactions((prev) =>
      prev.map((t) => (t.id === editingTxn.id ? updatedTxn : t))
    );

    if (amountDelta !== 0) {
      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.id === editingTxn.accountId) {
            const balanceDelta = editingTxn.type === 'income' ? amountDelta : -amountDelta;
            return {
              ...acc,
              balanceCents: acc.balanceCents + balanceDelta,
            };
          }
          return acc;
        })
      );
    }

    addToast('Transaction updated', 'success');
    setIsEditTxnModalOpen(false);
    setEditingTxn(null);

    // 2. Background database sync
    try {
      await fetch(`/api/finance/transactions/${editingTxn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: newAmountCents,
          payee: editTxnPayee.trim() || undefined,
          transactionDate: editTxnDate,
          categoryId: editTxnCategoryId || undefined,
        }),
      });
    } catch {
      // offline/optimistic already applied
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

  const handleOpenCreateBudget = () => {
    setEditingBudget(null);
    setBudgetCatId('');
    setBudgetAmount('');
    setBudgetPeriod('monthly');
    setBudgetErrors({});
    setIsBudgetModalOpen(true);
  };

  const handleOpenEditBudget = (b: FinanceBudgetData) => {
    setEditingBudget(b);
    setBudgetCatId(b.categoryId);
    setBudgetAmount((b.amountCents / 100).toString());
    setBudgetPeriod(b.period);
    setBudgetErrors({});
    setIsBudgetModalOpen(true);
  };

  const confirmDeleteBudget = async () => {
    if (!budgetToDelete) return;
    const b = budgetToDelete;
    try {
      setIsDeletingBudget(true);
      await fetch(`/api/finance/budgets/${b.id}`, { method: 'DELETE' }).catch(() => null);
      setBudgets((prev) => prev.filter((item) => item.id !== b.id));
      addToast('Budget envelope deleted', 'success');
      setBudgetToDelete(null);
      fetchFinanceData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error deleting budget', 'error');
    } finally {
      setIsDeletingBudget(false);
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

      if (editingBudget) {
        await fetch(`/api/finance/budgets/${editingBudget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountCents,
            period: budgetPeriod,
          }),
        }).catch(() => null);

        setBudgets((prev) =>
          prev.map((b) =>
            b.id === editingBudget.id
              ? {
                  ...b,
                  amountCents,
                  period: budgetPeriod,
                  remainingCents: Math.max(0, amountCents - b.spentCents),
                  percentageUsed: amountCents > 0 ? Math.round((b.spentCents / amountCents) * 100) : 0,
                  updatedAt: Date.now(),
                }
              : b
          )
        );
        addToast('Budget updated', 'success');
        setIsBudgetModalOpen(false);
        setEditingBudget(null);
        setBudgetAmount('');
        fetchFinanceData();
        return;
      }

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

  const handleOpenCreateDebt = () => {
    setEditingDebt(null);
    setDebtName('');
    setDebtCreditor('');
    setDebtAmount('');
    setDebtApr('18.5');
    setDebtMinPayment('');
    setDebtErrors({});
    setIsDebtModalOpen(true);
  };

  const handleOpenEditDebt = (d: FinanceDebtData) => {
    setEditingDebt(d);
    setDebtName(d.name);
    setDebtCreditor(d.creditor);
    setDebtAmount((d.totalOwedCents / 100).toString());
    setDebtApr((d.interestRateBps / 100).toString());
    setDebtMinPayment(d.minimumPaymentCents ? (d.minimumPaymentCents / 100).toString() : '');
    setDebtErrors({});
    setIsDebtModalOpen(true);
  };

  const confirmDeleteDebt = async () => {
    if (!debtToDelete) return;
    const d = debtToDelete;
    try {
      setIsDeletingDebt(true);
      await fetch(`/api/finance/debts/${d.id}`, { method: 'DELETE' }).catch(() => null);
      setDebts((prev) => prev.filter((item) => item.id !== d.id));
      addToast(`Debt "${d.name}" deleted`, 'success');
      setDebtToDelete(null);
      fetchFinanceData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error deleting debt', 'error');
    } finally {
      setIsDeletingDebt(false);
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

      if (editingDebt) {
        await fetch(`/api/finance/debts/${editingDebt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: debtName.trim(),
            creditor: debtCreditor.trim(),
            totalOwedCents,
            interestRateBps,
            minimumPaymentCents: minPmtCents,
          }),
        }).catch(() => null);

        setDebts((prev) =>
          prev.map((d) =>
            d.id === editingDebt.id
              ? {
                  ...d,
                  name: debtName.trim(),
                  creditor: debtCreditor.trim(),
                  totalOwedCents,
                  remainingBalanceCents: Math.max(0, totalOwedCents - d.totalPaidCents),
                  interestRateBps,
                  minimumPaymentCents: minPmtCents,
                  updatedAt: Date.now(),
                }
              : d
          )
        );
        addToast(`Debt "${debtName.trim()}" updated`, 'success');
        setIsDebtModalOpen(false);
        setEditingDebt(null);
        fetchFinanceData();
        return;
      }

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

  // ─── Reactive Dynamic Calculations Driven Directly by User Entries (Data Binding) ───
  // Note: All hooks MUST execute unconditionally before any early returns to avoid React Hook order mismatch
  const totalEntriesCount = transactions.length;

  // Compute summary metrics dynamically via entries.reduce(...)
  const derivedIncomeCents = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amountCents, 0);
  }, [transactions]);

  const derivedExpenseCents = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amountCents, 0);
  }, [transactions]);

  // Variance: Inflows minus Outflows
  const derivedCashflowVarianceCents = derivedIncomeCents - derivedExpenseCents;

  // Savings rate % dynamically calculated
  const derivedSavingsRate = derivedIncomeCents > 0
    ? Math.max(0, Math.round((derivedCashflowVarianceCents / derivedIncomeCents) * 100))
    : 0;

  // Assets dynamically reconciled from account entries
  const derivedAssetsCents = useMemo(() => {
    return accounts
      .filter((a) => a.isAsset !== false && a.type !== 'credit' && a.type !== 'loan')
      .reduce((sum, a) => sum + Math.max(0, a.balanceCents), 0);
  }, [accounts]);

  // Liabilities dynamically reconciled from credit accounts & debts
  const derivedLiabilitiesCents = useMemo(() => {
    const accLiab = accounts.reduce((sum, a) => {
      if (a.isAsset === false || a.type === 'credit' || a.type === 'loan') {
        return sum + Math.abs(a.balanceCents);
      }
      if (a.balanceCents < 0) {
        return sum + Math.abs(a.balanceCents);
      }
      return sum;
    }, 0);
    const debtLiab = debts
      .filter((d) => !d.isPaidOff)
      .reduce((sum, d) => sum + (d.remainingBalanceCents || 0), 0);
    return accLiab + debtLiab;
  }, [accounts, debts]);

  // Net Liquid Balance / Net Worth
  const derivedNetWorthCents = derivedAssetsCents - derivedLiabilitiesCents;

  // Active filters on journal entries
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesType = txnFilterType === 'all' || t.type === txnFilterType;
      const matchesCat = txnFilterCat === 'all' || t.categoryId === txnFilterCat;
      const q = txnSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (t.payee && t.payee.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.categoryName && t.categoryName.toLowerCase().includes(q));
      return matchesType && matchesCat && matchesSearch;
    });
  }, [transactions, txnFilterType, txnFilterCat, txnSearch]);

  const filteredTotalAmount = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + t.amountCents, 0);
  }, [filteredTransactions]);

  const activeFilterCount =
    (txnFilterType !== 'all' ? 1 : 0) +
    (txnFilterCat !== 'all' ? 1 : 0) +
    (txnSearch.trim() !== '' ? 1 : 0);

  // KPI data for MobileTransactionSheet
  const selectedAccount = accounts.find((a) => a.id === txnAccountId);
  const activeCatBudget = budgets.find((b) => b.categoryId === txnCategoryId);
  const mobileSheetKpi: KPIData = {
    todaySpentCents: derivedExpenseCents,
    categorySpendCents: activeCatBudget?.spentCents ?? 0,
    accountBalanceCents: selectedAccount?.balanceCents ?? 0,
    budgetUsedPercent: activeCatBudget?.percentageUsed ?? 0,
    currency: selectedAccount?.currency ?? 'INR',
  };

  if (loading) {
    return <LoadingState message="Connecting to atomic financial ledger..." />;
  }

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
            onClick={handleOpenCreateAccount}
            variant="outline"
            size="sm"
            className="cursor-pointer text-xs rounded-xl shadow-xs"
          >
            <IconPlus size={14} className="mr-1 text-on-surface-variant" />
            <span>Account</span>
          </Button>
          <Button
            onClick={handleOpenCreateBudget}
            variant="outline"
            size="sm"
            className="cursor-pointer text-xs rounded-xl shadow-xs"
          >
            <IconPlus size={14} className="mr-1 text-on-surface-variant" />
            <span>Budget</span>
          </Button>
          <Button
            onClick={handleOpenCreateDebt}
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

      {/* ─── Net Worth & Cashflow Telemetry Bento Grid (Strict 2x2 Mobile / 4-Col Grid) ─── */}
      <KpiGrid cols="4">
        {/* KPI 1: Net Liquid Balance */}
        <KpiCard
          title="Total Net Liquid Balance"
          value={safeFormatMoney(derivedNetWorthCents)}
          subtitle={`Assets: ${safeFormatMoney(derivedAssetsCents)} • Liab: ${safeFormatMoney(derivedLiabilitiesCents)}`}
          color={derivedNetWorthCents >= 0 ? 'default' : 'rose'}
          trend={{
            value: `${accounts.length} Accounts`,
            isPositive: derivedNetWorthCents >= 0,
          }}
        />

        {/* KPI 2: Cash Inflows (Reactive Sum of Income Entries) */}
        <KpiCard
          title="Monthly Cash Inflow"
          value={`+${safeFormatMoney(derivedIncomeCents)}`}
          subtitle={`${transactions.filter((t) => t.type === 'income').length} credits • ${totalEntriesCount} total entries`}
          color="emerald"
          trend={{
            value: `${transactions.filter((t) => t.type === 'income').length} entries`,
            isPositive: true,
          }}
        />

        {/* KPI 3: Cash Outflows (Reactive Sum of Expense Entries) */}
        <KpiCard
          title="Monthly Burn & Outflow"
          value={`-${safeFormatMoney(derivedExpenseCents)}`}
          subtitle={`${transactions.filter((t) => t.type === 'expense').length} debits logged`}
          color="rose"
          trend={{
            value: `${transactions.filter((t) => t.type === 'expense').length} entries`,
            isPositive: false,
          }}
        />

        {/* KPI 4: Net Variance & Retention Rate */}
        <KpiCard
          title="Net Variance & Rate"
          value={`${derivedCashflowVarianceCents >= 0 ? '+' : ''}${safeFormatMoney(derivedCashflowVarianceCents)} (${derivedSavingsRate}%)`}
          subtitle={
            derivedCashflowVarianceCents >= 0
              ? 'Net surplus cash retained'
              : 'Deficit cash burn variance'
          }
          color={derivedCashflowVarianceCents >= 0 ? 'primary' : 'rose'}
          progressBar={{ value: derivedSavingsRate }}
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
          {accounts.length === 0 ? (
            <div className="p-8 text-center bg-surface-container-lowest border border-dashed border-border/80 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center mx-auto text-on-surface-variant">
                <IconCreditCard size={24} />
              </div>
              <h3 className="font-title-sm text-base font-bold text-on-surface">No financial accounts yet</h3>
              <p className="font-body-sm text-xs text-on-surface-variant max-w-sm mx-auto">
                Add your checking, savings, credit cards, or cash vaults to begin logging atomic double-entry records.
              </p>
              <Button onClick={handleOpenCreateAccount} variant="primary" size="sm" className="mt-2">
                <IconPlus size={14} className="mr-1.5" />
                Add Your First Account
              </Button>
            </div>
          ) : (
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
                        onClick={() => handleOpenEditAccount(acc)}
                        title="Edit account"
                        aria-label={`Edit account ${acc.name}`}
                        className="p-1.5 text-outline hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <IconEdit size={14} />
                      </button>
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
          )}
        </div>
      ) : null}

      {activeTab === 'transactions' && (
        <div className="bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm overflow-hidden space-y-3 p-4 sm:p-5">
          {/* Header & Active Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline-md text-base sm:text-lg font-bold text-on-surface">
                  Atomic Ledger Transactions
                </span>
                <span className="font-label-caps text-xs px-2 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-mono font-semibold">
                  {transactions.length} Total Entries
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Dynamic ledger records with instant balance sync on Create, Update, and Delete.
              </p>
            </div>

            {/* Filter Pill Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type Pills */}
              <div className="flex items-center p-0.5 rounded-xl bg-surface-container-low border border-border/60 text-xs">
                {(['all', 'expense', 'income', 'transfer'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTxnFilterType(t)}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer touch-manipulation',
                      txnFilterType === t
                        ? 'bg-surface-container-highest text-on-surface shadow-xs font-bold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Category Filter */}
              <select
                value={txnFilterCat}
                onChange={(e) => setTxnFilterCat(e.target.value)}
                className="px-2.5 py-1 rounded-xl text-xs bg-surface-container-low border border-border/60 text-on-surface focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search & Reactive Filter Summary Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low/50 p-3 rounded-xl border border-border/50 text-xs">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={txnSearch}
                onChange={(e) => setTxnSearch(e.target.value)}
                placeholder="Search payee or notes..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-surface-container-lowest border border-border/60 text-on-surface placeholder:text-on-surface-variant focus:outline-none"
              />
            </div>

            {/* Reactive Summary Statistics */}
            <div className="flex items-center gap-3 font-mono text-[11px] text-on-surface-variant">
              <span>
                Matching:{' '}
                <strong className="text-on-surface">{filteredTransactions.length}</strong> / {transactions.length}
              </span>
              <span>•</span>
              <span>
                Filtered Sum:{' '}
                <strong className="text-primary font-bold">{safeFormatMoney(filteredTotalAmount)}</strong>
              </span>
              {activeFilterCount > 0 && (
                <>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTxnSearch('');
                      setTxnFilterType('all');
                      setTxnFilterCat('all');
                    }}
                    className="text-xs text-rose-500 hover:underline font-sans cursor-pointer"
                  >
                    Clear Filters ({activeFilterCount})
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Transaction Entries List */}
          <div className="divide-y divide-surface-container-low border border-border/60 rounded-xl overflow-hidden bg-surface-container-lowest">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                <p>No transactions match the selected filter criteria.</p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTxnSearch('');
                      setTxnFilterType('all');
                      setTxnFilterCat('all');
                    }}
                    className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            ) : (
              filteredTransactions.map((txn) => {
                const isIncome = txn.type === 'income';
                const isTransfer = txn.type === 'transfer';
                return (
                  <div
                    key={txn.id}
                    className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-muted/30 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={clsx(
                          'w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0',
                          isTransfer
                            ? 'bg-blue-500/10 text-blue-500'
                            : isIncome
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-rose-500/10 text-rose-500'
                        )}
                      >
                        {isTransfer ? '⇄' : isIncome ? '↓' : '↑'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground flex items-center gap-1.5 flex-wrap truncate">
                          {(() => {
                            const catDetail = txn.categoryId ? categoryLookup.get(txn.categoryId) : null;
                            if (catDetail) {
                              return (
                                <>
                                  {catDetail.parentName && (
                                    <span className="text-foreground/50 text-[11px] font-medium truncate">
                                      {catDetail.parentIcon ? `${catDetail.parentIcon} ` : ''}{catDetail.parentName} ›
                                    </span>
                                  )}
                                  <span className="truncate">{catDetail.icon ? `${catDetail.icon} ` : ''}{catDetail.name}</span>
                                </>
                              );
                            }
                            return <span className="truncate">{txn.categoryName || 'Uncategorized'}</span>;
                          })()}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono truncate">
                          {txn.transactionDate} {txn.payee && `• ${txn.payee}`} {txn.notes && `(${txn.notes})`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div
                        className={clsx(
                          'text-sm font-bold font-mono whitespace-nowrap',
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

                      {/* Action buttons (Edit & Delete) with instant sync */}
                      <div className="flex items-center gap-1 pl-2 border-l border-border/50">
                        <button
                          type="button"
                          onClick={() => handleOpenEditTxn(txn)}
                          className="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title="Edit transaction"
                          aria-label="Edit transaction"
                        >
                          <IconEdit size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(txn)}
                          className="p-1.5 rounded-lg text-rose-500/70 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Delete transaction"
                          aria-label="Delete transaction"
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
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
            <div className="col-span-full p-8 text-center bg-surface-container-lowest border border-dashed border-border/80 rounded-2xl text-xs text-on-surface-variant font-mono space-y-3">
              <p>No envelope budgets defined for this calendar month.</p>
              <Button onClick={handleOpenCreateBudget} variant="primary" size="sm" className="cursor-pointer rounded-xl">
                <IconPlus size={14} className="mr-1" /> Create Budget
              </Button>
            </div>
          ) : (
            budgets.map((b) => (
              <div key={b.id} className="p-5 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm space-y-2 hover:border-primary/40 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between text-xs font-bold text-on-surface">
                  <span className="font-title-sm text-title-sm truncate mr-2">{b.categoryName || 'Category Envelope'}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-outline px-1.5 py-0.5 rounded bg-surface-container text-[11px]">{b.yearMonth}</span>
                    <button
                      type="button"
                      onClick={() => handleOpenEditBudget(b)}
                      title="Edit budget"
                      aria-label="Edit budget"
                      className="p-1.5 text-outline hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <IconEdit size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBudgetToDelete(b)}
                      title="Delete budget"
                      aria-label="Delete budget"
                      className="p-1.5 text-outline hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
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
              <div className="col-span-full p-8 text-center bg-surface-container-lowest border border-dashed border-border/80 rounded-2xl text-xs text-on-surface-variant font-mono space-y-3">
                <p>No debts or loans tracked. Clean slate!</p>
                <Button onClick={handleOpenCreateDebt} variant="primary" size="sm" className="cursor-pointer rounded-xl">
                  <IconPlus size={14} className="mr-1" /> Log Debt
                </Button>
              </div>
            ) : (
              debts.map((d) => (
                <div key={d.id} className="p-5 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm space-y-3 hover:border-primary/40 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <span className="font-title-sm text-title-sm font-bold text-on-surface truncate mr-2">{d.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={clsx(
                          'text-[10px] px-2 py-0.5 rounded-lg font-semibold uppercase font-mono',
                          d.isPaidOff ? 'bg-secondary-container/50 text-secondary' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        )}
                      >
                        {d.isPaidOff ? 'Paid Off' : 'Active Debt'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditDebt(d)}
                        title="Edit debt"
                        aria-label={`Edit debt ${d.name}`}
                        className="p-1.5 text-outline hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <IconEdit size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDebtToDelete(d)}
                        title="Delete debt"
                        aria-label={`Delete debt ${d.name}`}
                        className="p-1.5 text-outline hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
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

      {/* Account Modal (Create or Edit) */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => {
          setIsAccountModalOpen(false);
          setEditingAccount(null);
        }}
        title={editingAccount ? 'Edit Financial Account' : 'Create Financial Account'}
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

          {!editingAccount && (
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
          )}

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsAccountModalOpen(false);
                setEditingAccount(null);
              }}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              {editingAccount ? 'Save Changes' : 'Create Account'}
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

      {/* Budget Modal (Create or Edit) */}
      <Modal
        isOpen={isBudgetModalOpen}
        onClose={() => {
          setIsBudgetModalOpen(false);
          setEditingBudget(null);
        }}
        title={editingBudget ? 'Edit Envelope Budget' : 'Create Envelope Budget'}
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
              onClick={() => {
                setIsBudgetModalOpen(false);
                setEditingBudget(null);
              }}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              {editingBudget ? 'Update Budget' : 'Save Budget'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Debt Modal (Create or Edit) */}
      <Modal
        isOpen={isDebtModalOpen}
        onClose={() => {
          setIsDebtModalOpen(false);
          setEditingDebt(null);
        }}
        title={editingDebt ? 'Edit Debt or Loan' : 'Log Debt or Loan'}
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
              onClick={() => {
                setIsDebtModalOpen(false);
                setEditingDebt(null);
              }}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              {editingDebt ? 'Update Debt' : 'Save Debt'}
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

      {/* Confirmation Modal for Budget Deletion */}
      <ConfirmationModal
        isOpen={Boolean(budgetToDelete)}
        onClose={() => setBudgetToDelete(null)}
        onConfirm={confirmDeleteBudget}
        isLoading={isDeletingBudget}
        title="Delete Envelope Budget"
        description={`Are you sure you want to delete the budget envelope for "${budgetToDelete?.categoryName || 'this category'}"?`}
        confirmLabel="Delete Budget"
        variant="destructive"
      />

      {/* Confirmation Modal for Debt Deletion */}
      <ConfirmationModal
        isOpen={Boolean(debtToDelete)}
        onClose={() => setDebtToDelete(null)}
        onConfirm={confirmDeleteDebt}
        isLoading={isDeletingDebt}
        title="Delete Debt Record"
        description={`Are you sure you want to delete "${debtToDelete?.name}"? All associated payoff records and tracking history will be permanently removed.`}
        confirmLabel="Delete Debt"
        variant="destructive"
      />

      {/* Edit Transaction Modal with Instant Real-Time Sync */}
      <Modal
        isOpen={isEditTxnModalOpen}
        onClose={() => {
          setIsEditTxnModalOpen(false);
          setEditingTxn(null);
        }}
        title="Edit Ledger Transaction"
        description="Updates transaction details and dynamically syncs account balance and 2x2 KPI metrics."
        size="md"
      >
        <form onSubmit={handleUpdateTransaction} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">
              Payee / Entity
            </label>
            <Input
              value={editTxnPayee}
              onChange={(e) => setEditTxnPayee(e.target.value)}
              placeholder="e.g. AWS Cloud, Whole Foods"
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">
                Amount (₹ / USD)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={editTxnAmount}
                onChange={(e) => setEditTxnAmount(e.target.value)}
                required
                className="text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">
                Transaction Date
              </label>
              <Input
                type="date"
                value={editTxnDate}
                onChange={(e) => setEditTxnDate(e.target.value)}
                required
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">
              Category
            </label>
            <select
              value={editTxnCategoryId}
              onChange={(e) => setEditTxnCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-muted/50 border border-border/80 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsEditTxnModalOpen(false);
                setEditingTxn(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

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
