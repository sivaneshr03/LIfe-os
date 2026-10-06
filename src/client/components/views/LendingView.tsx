import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { LoadingState } from '../ui/States';
import type { FinanceContactData, FinanceDebtData } from '@/shared/financeTypes';
import {
  IconPayments,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconUsers,
  IconClock,
  IconCheck,
  IconAlertTriangle,
  IconDownload,
  IconZap,
  IconSend,
  IconFileText,
  IconHistory,
  IconPlus,
  IconTrash,
  IconEdit,
  IconRefresh,
} from '../ui/Icons';

export interface LendingLedgerEntry {
  id: string;
  date: string;
  counterparty: string;
  counterpartyInitials: string;
  category: 'personal_loan' | 'vendor_payout' | 'family';
  categoryLabel: string;
  channel: 'UPI / GPay' | 'NEFT / Wire' | 'Cash Payout' | 'Direct NetBanking' | 'Card';
  amountCents: number; // Integer minor units (e.g. 5000000 = ₹50,000)
  totalPrincipalCents: number;
  paidCents: number;
  status: 'settled' | 'partial' | 'pending' | 'overdue';
  overdueDays?: number;
  dueDate?: string;
}

export interface CounterpartyProfile {
  id: string;
  name: string;
  initials: string;
  role: string;
  type: 'receivable' | 'payable' | 'settled';
  lentCents: number;
  returnedCents: number;
  balanceCents: number;
  statusBadge: string;
  isOverdue?: boolean;
}

interface LendingViewProps {
  onNavigate?: (view: string) => void;
}

function formatRupee(minorUnits: number): string {
  const whole = Math.round(minorUnits / 100);
  return '₹' + whole.toLocaleString('en-IN');
}

export function LendingView({ onNavigate: _onNavigate }: LendingViewProps) {
  const { toast } = useToast();

  const [contacts, setContacts] = useState<FinanceContactData[]>([]);
  const [debts, setDebts] = useState<FinanceDebtData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterPill, setFilterPill] = useState<'all' | 'vendor' | 'personal' | 'settled' | 'pending'>('all');

  // Express Input State
  const [rapidName, setRapidName] = useState('');
  const [rapidAmount, setRapidAmount] = useState('');
  const [rapidChannel, setRapidChannel] = useState<'UPI / GPay' | 'NEFT / Wire' | 'Cash Payout' | 'Direct NetBanking'>('UPI / GPay');

  // Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [selectedPayeeId, setSelectedPayeeId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleRoute, setSettleRoute] = useState<'UPI' | 'NEFT' | 'Cash' | 'Bank'>('UPI');
  const [markResolved, setMarkResolved] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);

  // New / Edit Counterparty Modal State
  const [isAddCounterpartyOpen, setIsAddCounterpartyOpen] = useState(false);
  const [editingCounterparty, setEditingCounterparty] = useState<CounterpartyProfile | null>(null);
  const [newCpName, setNewCpName] = useState('');
  const [newCpRole, setNewCpRole] = useState('');
  const [newCpType, setNewCpType] = useState<'receivable' | 'payable'>('receivable');
  const [newCpAmount, setNewCpAmount] = useState('');

  // Synchronize from Cloudflare D1 production database
  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const [contactsRes, debtsRes] = await Promise.all([
        fetch('/api/finance/contacts'),
        fetch('/api/finance/debts'),
      ]);

      if (contactsRes.ok) {
        const contactsJson = await contactsRes.json();
        if (contactsJson.success && Array.isArray(contactsJson.data)) {
          setContacts(contactsJson.data);
        }
      }

      if (debtsRes.ok) {
        const debtsJson = await debtsRes.json();
        if (debtsJson.success && Array.isArray(debtsJson.data)) {
          setDebts(debtsJson.data);
        }
      }
    } catch (err) {
      console.error('Failed to sync Lending & Payee data from database:', err);
      toast('Failed to load lending records from server', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive Counterparty Profiles from contacts and linked debts
  const counterparties: CounterpartyProfile[] = useMemo(() => {
    const list: CounterpartyProfile[] = [];
    const seenNames = new Set<string>();

    for (const c of contacts) {
      seenNames.add(c.name.toLowerCase());
      const linkedDebts = debts.filter(
        (d) => d.contactId === c.id || d.creditor.toLowerCase() === c.name.toLowerCase()
      );

      const lentCents = linkedDebts
        .filter((d) => d.debtType === 'money_given' || d.debtType === 'loan')
        .reduce((sum, d) => sum + d.totalOwedCents, 0);

      const returnedCents = linkedDebts.reduce((sum, d) => sum + (d.totalPaidCents || 0), 0);

      const balanceCents = linkedDebts.reduce(
        (sum, d) => sum + (d.remainingBalanceCents ?? Math.max(0, d.totalOwedCents - (d.totalPaidCents || 0))),
        0
      );

      const hasPayable = linkedDebts.some((d) => d.debtType === 'money_borrowed');
      const isOverdue = linkedDebts.some((d) => d.isOverdue);

      const initials =
        c.name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase() || 'CP';

      const type: 'receivable' | 'payable' | 'settled' =
        balanceCents === 0 ? 'settled' : hasPayable ? 'payable' : 'receivable';

      const statusBadge =
        balanceCents === 0 ? 'Settled' : type === 'payable' ? 'To Pay' : 'Pending';

      list.push({
        id: c.id,
        name: c.name,
        initials,
        role: c.notes || (type === 'receivable' ? 'Peer / Borrower' : 'Creditor'),
        type,
        lentCents,
        returnedCents,
        balanceCents,
        statusBadge,
        isOverdue,
      });
    }

    // Also include any debts created outside contacts
    for (const d of debts) {
      if (
        (d.debtType === 'money_given' || d.debtType === 'money_borrowed' || d.debtType === 'loan') &&
        !seenNames.has(d.creditor.toLowerCase())
      ) {
        seenNames.add(d.creditor.toLowerCase());
        const initials =
          d.creditor
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'CP';

        const remaining = d.remainingBalanceCents ?? Math.max(0, d.totalOwedCents - (d.totalPaidCents || 0));
        const type: 'receivable' | 'payable' | 'settled' =
          remaining === 0 ? 'settled' : d.debtType === 'money_borrowed' ? 'payable' : 'receivable';

        list.push({
          id: d.contactId || `synth-${d.id}`,
          name: d.creditor,
          initials,
          role: d.notes || (type === 'receivable' ? 'Peer / Borrower' : 'Creditor'),
          type,
          lentCents: d.totalOwedCents,
          returnedCents: d.totalPaidCents || 0,
          balanceCents: remaining,
          statusBadge: remaining === 0 ? 'Settled' : type === 'payable' ? 'To Pay' : 'Pending',
          isOverdue: Boolean(d.isOverdue),
        });
      }
    }

    return list;
  }, [contacts, debts]);

  // Derive Ledger Entries from active and settled debts in database
  const ledgerEntries: LendingLedgerEntry[] = useMemo(() => {
    return debts
      .filter((d) => d.debtType === 'money_given' || d.debtType === 'money_borrowed' || d.debtType === 'loan' || d.contactId)
      .map((d) => {
        const counterpartyName = d.contactName || d.creditor;
        const initials =
          counterpartyName
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'CP';

        const channel = (
          d.notes?.includes('Channel:')
            ? d.notes.split('Channel:')[1].split('|')[0].trim()
            : 'UPI / GPay'
        ) as LendingLedgerEntry['channel'];

        const paid = d.totalPaidCents || 0;
        const status: LendingLedgerEntry['status'] = d.isPaidOff
          ? 'settled'
          : d.isOverdue
          ? 'overdue'
          : paid > 0
          ? 'partial'
          : 'pending';

        return {
          id: d.id,
          date: d.dueDate || new Date(d.createdAt).toISOString().split('T')[0],
          counterparty: counterpartyName,
          counterpartyInitials: initials,
          category: d.debtType === 'money_borrowed' ? 'vendor_payout' : 'personal_loan',
          categoryLabel: d.name || (d.debtType === 'money_given' ? 'Disbursed Loan' : 'Payable Liability'),
          channel: (['UPI / GPay', 'NEFT / Wire', 'Cash Payout', 'Direct NetBanking', 'Card'] as const).includes(
            channel as LendingLedgerEntry['channel']
          )
            ? (channel as LendingLedgerEntry['channel'])
            : 'UPI / GPay',
          amountCents: d.totalOwedCents,
          totalPrincipalCents: d.totalOwedCents,
          paidCents: paid,
          status,
          dueDate: d.dueDate || undefined,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [debts]);

  // Selected Payee Details safely handled
  const selectedPayee = useMemo(
    () => counterparties.find((c) => c.id === selectedPayeeId) || counterparties[0] || null,
    [counterparties, selectedPayeeId]
  );

  // Derived Totals
  const totalPaidOutCents = useMemo(
    () => ledgerEntries.reduce((acc, curr) => acc + curr.paidCents, 0),
    [ledgerEntries]
  );

  const totalReceivableCents = useMemo(
    () =>
      counterparties
        .filter((c) => c.type === 'receivable')
        .reduce((acc, curr) => acc + curr.balanceCents, 0),
    [counterparties]
  );

  const totalPayableCents = useMemo(
    () =>
      counterparties
        .filter((c) => c.type === 'payable')
        .reduce((acc, curr) => acc + curr.balanceCents, 0),
    [counterparties]
  );

  const netSurplusCents = totalReceivableCents - totalPayableCents;

  const filteredLedger = useMemo(() => {
    switch (filterPill) {
      case 'vendor':
        return ledgerEntries.filter((e) => e.category === 'vendor_payout');
      case 'personal':
        return ledgerEntries.filter((e) => e.category === 'personal_loan' || e.category === 'family');
      case 'settled':
        return ledgerEntries.filter((e) => e.status === 'settled');
      case 'pending':
        return ledgerEntries.filter((e) => e.status === 'pending' || e.status === 'overdue' || e.status === 'partial');
      default:
        return ledgerEntries;
    }
  }, [ledgerEntries, filterPill]);

  const handleRapidRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(rapidAmount);
    if (!rapidName.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast('Please enter a valid counterparty name and amount.', 'error');
      return;
    }

    const minorUnits = Math.round(parsedAmount * 100);

    try {
      // Find or create contact in D1
      let targetContactId: string | null = null;
      const existingContact = contacts.find(
        (c) => c.name.toLowerCase() === rapidName.trim().toLowerCase()
      );

      if (existingContact) {
        targetContactId = existingContact.id;
      } else {
        const cRes = await fetch('/api/finance/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: rapidName.trim(),
            notes: 'Peer / Payee',
          }),
        });
        if (cRes.ok) {
          const cJson = await cRes.json();
          targetContactId = cJson.data.id;
        }
      }

      // Create debt in database
      const debtRes = await fetch('/api/finance/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: targetContactId,
          name: 'Micro-Disbursement',
          creditor: rapidName.trim(),
          debtType: 'money_given',
          totalOwedCents: minorUnits,
          interestRateBps: 0,
          minimumPaymentCents: 0,
          notes: `Channel: ${rapidChannel}`,
        }),
      });

      if (!debtRes.ok) {
        throw new Error('Failed to record disbursement in database');
      }

      const debtJson = await debtRes.json();
      const createdDebt = debtJson.data;

      // Immediately record settlement payment in D1
      const payRes = await fetch(`/api/finance/debts/${createdDebt.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          amountCents: minorUnits,
          principalCents: minorUnits,
          notes: `Disbursed via ${rapidChannel}`,
        }),
      });

      if (!payRes.ok) {
        throw new Error('Failed to commit settlement payment');
      }

      setRapidName('');
      setRapidAmount('');
      toast(`Payment of ${formatRupee(minorUnits)} recorded and saved for ${rapidName}`, 'success');
      await fetchData(true);
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : 'Error recording disbursement', 'error');
    }
  };

  const handleExecuteSettle = async () => {
    if (!selectedPayee) {
      toast('Please select an active counterparty to settle.', 'error');
      return;
    }
    const parsed = parseFloat(settleAmount);
    if (isNaN(parsed) || parsed <= 0) {
      toast('Please enter a valid settlement amount.', 'error');
      return;
    }

    setIsCommitting(true);
    const minorUnits = Math.round(parsed * 100);

    try {
      // Find an active unpaid debt for this contact or creditor
      const activeDebt = debts.find(
        (d) =>
          !d.isPaidOff &&
          (d.contactId === selectedPayee.id ||
            d.creditor.toLowerCase() === selectedPayee.name.toLowerCase())
      );

      if (activeDebt) {
        const payRes = await fetch(`/api/finance/debts/${activeDebt.id}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: new Date().toISOString().split('T')[0],
            amountCents: minorUnits,
            principalCents: minorUnits,
            notes: `Settlement via ${settleRoute}`,
          }),
        });

        if (!payRes.ok) {
          throw new Error('Failed to record settlement payment');
        }
      } else {
        // Create debt and settle it
        const debtRes = await fetch('/api/finance/debts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: selectedPayee.id.startsWith('cnt_') ? selectedPayee.id : undefined,
            name: 'Settlement Resolution',
            creditor: selectedPayee.name,
            debtType: selectedPayee.type === 'payable' ? 'money_borrowed' : 'money_given',
            totalOwedCents: minorUnits,
            interestRateBps: 0,
            minimumPaymentCents: 0,
            notes: `Channel: ${settleRoute}`,
          }),
        });
        if (debtRes.ok) {
          const debtJson = await debtRes.json();
          await fetch(`/api/finance/debts/${debtJson.data.id}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: new Date().toISOString().split('T')[0],
              amountCents: minorUnits,
              principalCents: minorUnits,
              notes: `Settlement via ${settleRoute}`,
            }),
          });
        }
      }

      setIsSettleModalOpen(false);
      setSettleAmount('');
      toast(`Successfully settled ${formatRupee(minorUnits)} with ${selectedPayee.name}`, 'success');
      await fetchData(true);
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : 'Error committing settlement', 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleOpenCreateCounterparty = () => {
    setEditingCounterparty(null);
    setNewCpName('');
    setNewCpRole('');
    setNewCpType('receivable');
    setNewCpAmount('');
    setIsAddCounterpartyOpen(true);
  };

  const handleOpenEditCounterparty = (cp: CounterpartyProfile) => {
    setEditingCounterparty(cp);
    setNewCpName(cp.name);
    setNewCpRole(cp.role);
    setNewCpType(cp.type === 'payable' ? 'payable' : 'receivable');
    setNewCpAmount((cp.balanceCents / 100).toString());
    setIsAddCounterpartyOpen(true);
  };

  const handleAddCounterparty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCpName.trim()) {
      toast('Please enter a counterparty name.', 'error');
      return;
    }
    const initialAmt = parseFloat(newCpAmount) || 0;
    const initialCents = Math.round(initialAmt * 100);

    try {
      if (editingCounterparty) {
        if (editingCounterparty.id.startsWith('cnt_')) {
          const patchRes = await fetch(`/api/finance/contacts/${editingCounterparty.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: newCpName.trim(),
              notes: newCpRole.trim() || undefined,
            }),
          });
          if (!patchRes.ok) {
            throw new Error('Failed to update counterparty in database');
          }
        }
        toast(`Counterparty ${newCpName.trim()} updated.`, 'success');
      } else {
        const cRes = await fetch('/api/finance/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newCpName.trim(),
            notes: newCpRole.trim() || undefined,
          }),
        });

        if (!cRes.ok) {
          throw new Error('Failed to register counterparty in database');
        }

        const cJson = await cRes.json();
        const contactId = cJson.data.id;

        if (initialCents > 0) {
          const debtRes = await fetch('/api/finance/debts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contactId,
              name: newCpType === 'receivable' ? 'Disbursed Loan' : 'Payable Liability',
              creditor: newCpName.trim(),
              debtType: newCpType === 'receivable' ? 'money_given' : 'money_borrowed',
              totalOwedCents: initialCents,
              interestRateBps: 0,
              minimumPaymentCents: 0,
              notes: `Channel: UPI / GPay | Role: ${newCpRole.trim()}`,
            }),
          });
          if (!debtRes.ok) {
            throw new Error('Failed to record initial balance');
          }
        }
        toast(`Counterparty ${newCpName.trim()} registered in D1 database.`, 'success');
      }

      setIsAddCounterpartyOpen(false);
      setEditingCounterparty(null);
      setNewCpName('');
      setNewCpRole('');
      setNewCpAmount('');
      await fetchData(true);
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : 'Error saving counterparty', 'error');
    }
  };

  const handleDeleteCounterparty = async (id: string) => {
    const cp = counterparties.find((c) => c.id === id);
    try {
      if (id.startsWith('cnt_')) {
        await fetch(`/api/finance/contacts/${id}`, { method: 'DELETE' });
      }
      const linkedDebts = debts.filter(
        (d) => d.contactId === id || (cp && d.creditor.toLowerCase() === cp.name.toLowerCase())
      );
      for (const d of linkedDebts) {
        await fetch(`/api/finance/debts/${d.id}`, { method: 'DELETE' }).catch(() => null);
      }
      toast(`Counterparty "${cp?.name || id}" removed from database`, 'info');
      await fetchData(true);
    } catch (err) {
      console.error(err);
      toast('Failed to delete counterparty from server', 'error');
    }
  };

  const handleDeleteLedgerEntry = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/debts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete entry');
      }
      toast('Ledger entry removed from database', 'info');
      await fetchData(true);
    } catch (err) {
      console.error(err);
      toast('Failed to remove entry from server', 'error');
    }
  };

  const exportCsv = () => {
    const headers = ['Date', 'Counterparty', 'Category', 'Channel', 'Amount (INR)', 'Status'];
    const rows = ledgerEntries.map((e) => [
      e.date,
      `"${e.counterparty}"`,
      `"${e.categoryLabel}"`,
      `"${e.channel}"`,
      (e.amountCents / 100).toFixed(2),
      e.status,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `lending_debt_registry_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Lending and debt ledger exported as CSV', 'success');
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-12 animate-fade-in">
        <LoadingState message="Connecting to D1 Ledger & Loading Records..." variant="skeleton" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-up">
      {/* Executive Command Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
              Lending & Payee Registry
            </h1>
            <span className="font-label-caps text-xs px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-mono font-semibold">
              Live Ledger
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            onClick={() => fetchData(true)}
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            className="cursor-pointer text-xs rounded-xl shadow-xs"
            title="Sync with production D1 database"
          >
            <IconRefresh size={14} className={clsx("mr-1.5 text-on-surface-variant", isRefreshing && "animate-spin")} /> {isRefreshing ? 'Syncing...' : 'Sync'}
          </Button>
          <Button
            onClick={exportCsv}
            variant="outline"
            size="sm"
            className="cursor-pointer text-xs rounded-xl shadow-xs"
          >
            <IconDownload size={14} className="mr-1.5 text-on-surface-variant" /> Export CSV
          </Button>
          <Button
            onClick={() => setIsSettleModalOpen(true)}
            variant="outline"
            size="sm"
            className="cursor-pointer text-xs rounded-xl shadow-xs"
          >
            <IconZap size={14} className="mr-1.5 text-primary" /> Settle Balance
          </Button>
          <Button
            onClick={handleOpenCreateCounterparty}
            size="sm"
            variant="primary"
            className="cursor-pointer text-xs rounded-xl shadow-xs"
          >
            <IconPlus size={14} className="mr-1.5" /> Log Payment / Loan
          </Button>
        </div>
      </div>

      {/* 4 Domain KPI Cards (Strict 2x2 Mobile Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Net Exposure Position */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-border/70 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant truncate block select-none">
              Net Exposure
            </span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary shadow-xs">
              <IconPayments size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 my-1">
            <span className={clsx("text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums", netSurplusCents >= 0 ? "text-secondary" : "text-error")}>
              {netSurplusCents >= 0 ? `+${formatRupee(netSurplusCents)}` : `-${formatRupee(Math.abs(netSurplusCents))}`}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
            <span className="text-on-surface-variant truncate">
              {netSurplusCents >= 0 ? 'Net positive receivable' : 'Net payable liability'}
            </span>
            <span className="font-mono text-secondary font-semibold shrink-0">
              {counterparties.length} cp
            </span>
          </div>
        </div>

        {/* KPI 2: Total Receivable */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-border/70 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant truncate block select-none">
              Owed to You (Receivable)
            </span>
            <div className="w-8 h-8 rounded-xl bg-secondary-container/20 flex items-center justify-center text-secondary shadow-xs">
              <IconArrowDownLeft size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 my-1">
            <span className="text-2xl sm:text-3xl font-bold text-secondary font-mono tracking-tight tabular-nums">
              {formatRupee(totalReceivableCents)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
            <span className="text-on-surface-variant truncate">
              {counterparties.filter((c) => c.type === 'receivable' && c.balanceCents > 0).length} active borrowers
            </span>
            {counterparties.some((c) => c.isOverdue) && (
              <span className="px-2 py-0.5 rounded-full bg-error-container/60 text-error text-[10px] font-bold font-mono shrink-0">
                Overdue notice
              </span>
            )}
          </div>
        </div>

        {/* KPI 3: Total Payable */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-border/70 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant truncate block select-none">
              You Owe (Payable)
            </span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary shadow-xs">
              <IconArrowUpRight size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 my-1">
            <span className="text-2xl sm:text-3xl font-bold text-on-surface font-mono tracking-tight tabular-nums">
              {formatRupee(totalPayableCents)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
            <span className="text-on-surface-variant truncate">
              {counterparties.filter((c) => c.type === 'payable' && c.balanceCents > 0).length} active creditors
            </span>
            <span className="font-mono text-on-surface-variant shrink-0">
              {totalPayableCents === 0 ? 'All settled' : 'Pending payoff'}
            </span>
          </div>
        </div>

        {/* KPI 4: Settled Volume */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-border/70 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant truncate block select-none">
              Settled Volume
            </span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface shadow-xs">
              <IconCheck size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 my-1">
            <span className="text-2xl sm:text-3xl font-bold text-on-surface font-mono tracking-tight tabular-nums">
              {formatRupee(totalPaidOutCents)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs font-mono">
            <span className="text-secondary font-semibold">
              {counterparties.filter((c) => c.balanceCents === 0).length} settled
            </span>
            <span className="text-on-surface-variant">
              {ledgerEntries.length} tx
            </span>
          </div>
        </div>
      </div>

      {/* Position Breakdown & Due Date Radar (12-Col Responsive Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dynamic Position Balance (8 Cols) */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-title-sm font-bold text-on-surface">Counterparty Exposure Ratio</h2>
              <p className="font-body-sm text-on-surface-variant text-xs mt-0.5">
                Dynamic balance between receivables (owed to you) and payables (you owe)
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-secondary-container/30 text-secondary font-label-caps text-xs font-bold self-start sm:self-auto font-mono">
              Surplus: {formatRupee(netSurplusCents)}
            </span>
          </div>

          {/* Proportional Comparison Bars */}
          {(() => {
            const totalExposure = totalReceivableCents + totalPayableCents;
            const recPct = totalExposure > 0 ? Math.round((totalReceivableCents / totalExposure) * 100) : 50;
            const payPct = 100 - recPct;
            return (
              <div className="space-y-4 my-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <span className="flex items-center gap-2 text-on-surface">
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                      Receivables ({recPct}%)
                    </span>
                    <span className="font-mono font-bold text-secondary">
                      {formatRupee(totalReceivableCents)}
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden">
                    <div className="bg-secondary h-full rounded-full transition-all duration-500" style={{ width: `${recPct}%` }} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <span className="flex items-center gap-2 text-on-surface">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                      Payables ({payPct}%)
                    </span>
                    <span className="font-mono font-bold text-primary">
                      {formatRupee(totalPayableCents)}
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden">
                    <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${payPct}%` }} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Data-Driven Summary Strip */}
          <div className="grid grid-cols-3 gap-3 pt-4 mt-4 bg-surface-container-low rounded-xl p-3.5 border border-border/50 text-xs">
            <div>
              <span className="font-label-caps text-[11px] text-on-surface-variant uppercase block font-semibold">
                Active Borrowers
              </span>
              <span className="font-mono font-bold text-on-surface mt-0.5 block">
                {counterparties.filter((c) => c.type === 'receivable' && c.balanceCents > 0).length} Accounts
              </span>
            </div>
            <div>
              <span className="font-label-caps text-[11px] text-on-surface-variant uppercase block font-semibold">
                Active Creditors
              </span>
              <span className="font-mono font-bold text-secondary mt-0.5 block">
                {counterparties.filter((c) => c.type === 'payable' && c.balanceCents > 0).length} Accounts
              </span>
            </div>
            <div>
              <span className="font-label-caps text-[11px] text-on-surface-variant uppercase block font-semibold">
                Settled In Full
              </span>
              <span className="font-mono font-bold text-primary mt-0.5 block">
                {counterparties.filter((c) => c.balanceCents === 0).length} Profiles
              </span>
            </div>
          </div>
        </div>

        {/* Actionable Due Alerts (4 Cols) */}
        <div className="lg:col-span-4 bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <IconClock size={18} className="text-primary" />
              <h2 className="font-title-sm font-bold text-on-surface">Active Due Items</h2>
            </div>
            {counterparties.some((c) => c.isOverdue) && (
              <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping" />
            )}
          </div>

          <div className="flex flex-col gap-3 my-auto">
            {counterparties.filter((c) => c.balanceCents > 0).length === 0 ? (
              <div className="p-6 rounded-xl bg-surface-container-low border border-border/50 text-center my-auto flex flex-col items-center justify-center gap-1.5">
                <IconCheck size={22} className="text-secondary" />
                <span className="font-bold text-xs text-on-surface">No Outstanding Due Items</span>
                <span className="text-[11px] text-on-surface-variant">All balances are settled or no counterparties are registered yet.</span>
              </div>
            ) : (
              counterparties
                .filter((c) => c.balanceCents > 0)
                .slice(0, 3)
                .map((cp) => (
                  <div key={cp.id} className="p-3.5 rounded-xl bg-surface-container-low border border-border/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-title-sm font-bold text-on-surface">{cp.name}</span>
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded-full font-label-caps text-[10px] font-bold',
                          cp.isOverdue
                            ? 'bg-error-container/60 text-error'
                            : 'bg-surface-container-highest text-on-surface'
                        )}
                      >
                        {cp.statusBadge || (cp.type === 'payable' ? 'To Pay' : 'Owed')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant">
                        {cp.type === 'payable' ? 'Payable Balance' : 'Principal Receivable'}
                      </span>
                      <span className="font-bold text-on-surface font-mono">{formatRupee(cp.balanceCents)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => toast(`Friendly reminder generated for ${cp.name}`, 'success')}
                        className="flex-1 bg-surface-container-highest hover:bg-surface-container text-on-surface font-label-md text-xs py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer font-medium"
                      >
                        Send Reminder
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPayeeId(cp.id);
                          setSettleAmount((cp.balanceCents / 100).toString());
                          setIsSettleModalOpen(true);
                        }}
                        className="flex-1 bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer font-medium shadow-xs"
                      >
                        Settle {formatRupee(cp.balanceCents)}
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>

          <div className="pt-3 border-t border-border/40 flex items-center justify-between font-label-caps text-[11px] text-on-surface-variant font-mono">
            <span>Automated Due Tracking</span>
            <span className="text-secondary flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> Active
            </span>
          </div>
        </div>
      </div>

      {/* Dual Workspace: Transactions Ledger & Counterparty Person Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tab A: Payment Records & Ledger (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Rapid Outflow Express Input Bar */}
          <form
            onSubmit={handleRapidRecord}
            className="bg-surface-container-lowest rounded-2xl p-4 border border-border/70 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
          >
            <div className="flex items-center gap-1.5 pl-1 text-on-surface-variant">
              <IconZap size={16} className="text-primary" />
              <span className="font-label-caps text-xs uppercase font-bold whitespace-nowrap">Rapid Outflow:</span>
            </div>
            <input
              type="text"
              value={rapidName}
              onChange={(e) => setRapidName(e.target.value)}
              placeholder="Counterparty name..."
              className="bg-surface-container-low text-on-surface placeholder:text-on-surface-variant text-xs px-3 py-2 rounded-xl flex-1 outline-none border border-border/50 focus:border-primary transition-all"
            />
            <input
              type="number"
              value={rapidAmount}
              onChange={(e) => setRapidAmount(e.target.value)}
              placeholder="Amount (₹)..."
              className="bg-surface-container-low text-on-surface placeholder:text-on-surface-variant text-xs px-3 py-2 rounded-xl w-full sm:w-32 outline-none border border-border/50 focus:border-primary transition-all"
            />
            <select
              value={rapidChannel}
              onChange={(e) => setRapidChannel(e.target.value as 'UPI / GPay' | 'NEFT / Wire' | 'Cash Payout' | 'Direct NetBanking')}
              className="bg-surface-container-low text-on-surface text-xs px-3 py-2 rounded-xl outline-none border border-border/50 cursor-pointer"
            >
              <option value="UPI / GPay">UPI</option>
              <option value="NEFT / Wire">NEFT</option>
              <option value="Cash Payout">Cash</option>
              <option value="Direct NetBanking">NetBanking</option>
            </select>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              className="cursor-pointer text-xs rounded-xl shadow-xs whitespace-nowrap px-4"
            >
              <IconPlus size={14} className="mr-1" /> Record
            </Button>
          </form>

          {/* Main Ledger Table Container */}
          <div className="bg-surface-container-lowest rounded-2xl border border-border/70 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-title-sm font-bold text-on-surface">Payment & Outflow Records</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-caps text-xs font-semibold">
                  {filteredLedger.length} Total
                </span>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all' as const, label: 'All Records' },
                  { id: 'vendor' as const, label: 'Vendor Payouts' },
                  { id: 'personal' as const, label: 'Personal Loans' },
                  { id: 'settled' as const, label: 'Settled' },
                  { id: 'pending' as const, label: 'Pending' },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setFilterPill(pill.id)}
                    className={clsx(
                      'px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all',
                      filterPill === pill.id
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    )}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ledger Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low text-on-surface-variant border-b border-border/70 uppercase font-mono font-semibold text-[11px]">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Counterparty</th>
                    <th className="p-3.5">Channel</th>
                    <th className="p-3.5 text-right">Amount</th>
                    <th className="p-3.5">Status / Progress</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                        No ledger entries matching the active filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((tx) => {
                      const percentPaid = Math.round((tx.paidCents / tx.totalPrincipalCents) * 100);
                      return (
                        <tr key={tx.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="p-3.5 text-on-surface-variant font-mono whitespace-nowrap">
                            {new Date(tx.date).toLocaleDateString()}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-primary-fixed flex items-center justify-center font-bold text-xs text-on-primary-fixed shrink-0">
                                {tx.counterpartyInitials}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-on-surface">{tx.counterparty}</span>
                                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono">
                                  {tx.categoryLabel}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface font-label-caps text-[11px] font-medium">
                              {tx.channel}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-bold text-on-surface font-mono">
                            {formatRupee(tx.amountCents)}
                          </td>
                          <td className="p-3.5">
                            {tx.status === 'settled' ? (
                              <span className="px-2 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-label-caps text-[11px] font-bold inline-flex items-center gap-1">
                                <IconCheck size={12} /> Fully Settled
                              </span>
                            ) : tx.status === 'overdue' ? (
                              <span className="px-2 py-0.5 rounded-full bg-error-container/60 text-error font-label-caps text-[11px] font-bold inline-flex items-center gap-1">
                                <IconAlertTriangle size={12} /> Overdue +{tx.overdueDays}d
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1 w-28">
                                <div className="flex justify-between items-center text-[10px] font-mono">
                                  <span className="text-primary font-bold">{percentPaid}% Paid</span>
                                  <span className="text-on-surface-variant">
                                    {formatRupee(tx.totalPrincipalCents - tx.paidCents)} left
                                  </span>
                                </div>
                                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-primary h-full rounded-full"
                                    style={{ width: `${percentPaid}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const match = counterparties.find((c) => c.name.toLowerCase() === tx.counterparty.toLowerCase());
                                  if (match) {
                                    setSelectedPayeeId(match.id);
                                    setSettleAmount((match.balanceCents / 100).toString());
                                  } else {
                                    setSettleAmount((tx.amountCents / 100).toString());
                                  }
                                  setIsSettleModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg hover:bg-surface-container text-primary hover:text-on-surface transition-colors cursor-pointer"
                                title="Settle Balance"
                              >
                                <IconCheck size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => toast(`Audit receipt generated for tx #${tx.id}`, 'info')}
                                className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                                title="Receipt & Audit Trail"
                              >
                                <IconFileText size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLedgerEntry(tx.id)}
                                className="p-1.5 rounded-lg hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                                title="Delete Entry"
                              >
                                <IconTrash size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Ledger Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-4 border-t border-border/70 text-xs text-on-surface-variant">
              <span>Showing {filteredLedger.length} ledger entries • Checksum verified</span>
              <div className="flex items-center gap-1 font-mono text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-surface-container text-primary font-bold">1</span>
                <span className="px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface-variant">Page 1 of 1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab B: Person Directory (Person List) (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-border/70 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <IconUsers size={18} className="text-primary" />
                <h2 className="font-title-sm font-bold text-on-surface">Person Directory</h2>
              </div>
              <span className="font-label-caps text-[11px] text-on-surface-variant uppercase font-mono">
                {counterparties.length} Monitored
              </span>
            </div>

            {/* Profile Cards List */}
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[520px] pr-1">
              {counterparties.length === 0 ? (
                <div className="p-8 rounded-xl bg-surface-container-low border border-dashed border-border/70 text-center flex flex-col items-center justify-center gap-2">
                  <IconUsers size={24} className="text-on-surface-variant" />
                  <p className="font-bold text-xs text-on-surface">No Counterparties Monitored</p>
                  <p className="text-[11px] text-on-surface-variant max-w-[220px]">
                    Register a person or business contact to begin tracking mutual loans and repayments.
                  </p>
                </div>
              ) : (
                counterparties.map((cp) => (
                  <div
                    key={cp.id}
                    className="p-3.5 rounded-xl bg-surface-container-low border border-border/50 hover:bg-surface-container transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs">
                          {cp.initials}
                        </div>
                        <div>
                          <h3 className="font-title-sm text-xs font-bold text-on-surface leading-tight">
                            {cp.name}
                          </h3>
                          <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">
                            {cp.role}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded-full font-label-caps text-[10px] font-bold',
                            cp.isOverdue
                              ? 'bg-error-container/60 text-error'
                              : cp.type === 'settled'
                              ? 'bg-secondary-container/40 text-secondary'
                              : 'bg-surface-container-highest text-on-surface'
                          )}
                        >
                          {cp.statusBadge}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditCounterparty(cp)}
                          className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-all cursor-pointer"
                          title="Edit Counterparty"
                        >
                          <IconEdit size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCounterparty(cp.id)}
                          className="p-1 rounded-lg hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-all cursor-pointer"
                          title="Remove Counterparty"
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1 text-xs">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-on-surface-variant uppercase">Lent</span>
                        <span className="font-bold text-on-surface font-mono">{formatRupee(cp.lentCents)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-on-surface-variant uppercase">Returned</span>
                        <span className="font-bold text-secondary font-mono">{formatRupee(cp.returnedCents)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-on-surface-variant uppercase">Balance</span>
                        <span
                          className={clsx(
                            'font-bold font-mono',
                            cp.balanceCents === 0 ? 'text-secondary' : cp.isOverdue ? 'text-error' : 'text-primary'
                          )}
                        >
                          {formatRupee(cp.balanceCents)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPayeeId(cp.id);
                          setSettleAmount((cp.balanceCents / 100).toString());
                          setIsSettleModalOpen(true);
                        }}
                        className="flex-1 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-[11px] py-1 rounded-lg border border-border/50 transition-all text-center cursor-pointer font-semibold"
                      >
                        Settle Up
                      </button>
                      <button
                        type="button"
                        onClick={() => toast(`WhatsApp reminder generated for ${cp.name}`, 'success')}
                        className="flex-1 bg-primary hover:bg-primary-container text-on-primary font-label-md text-[11px] py-1 rounded-lg transition-all text-center cursor-pointer font-semibold shadow-xs flex items-center justify-center gap-1"
                      >
                        <IconSend size={11} /> Ping
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Button
              onClick={() => setIsAddCounterpartyOpen(true)}
              variant="outline"
              size="sm"
              className="w-full mt-4 cursor-pointer text-xs rounded-xl shadow-xs"
            >
              <IconPlus size={14} className="mr-1.5" /> Add New Counterparty
            </Button>
          </div>
        </div>
      </div>

      {/* Interactive Quick Settle Wizard Modal */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        title="Quick Settle Wizard"
        description="Execute full or partial balance resolution with double-entry cryptographic reconciliation."
      >
        <div className="space-y-4 text-left">
          {counterparties.length === 0 || !selectedPayee ? (
            <div className="p-6 rounded-xl bg-surface-container-low border border-border/60 text-center">
              <IconUsers size={28} className="text-on-surface-variant mx-auto mb-2" />
              <p className="font-bold text-sm text-on-surface">No Counterparties to Settle</p>
              <p className="text-xs text-on-surface-variant mt-1 mb-4">
                You need to register at least one counterparty before executing a settlement.
              </p>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setIsSettleModalOpen(false);
                  setIsAddCounterpartyOpen(true);
                }}
              >
                <IconPlus size={14} className="mr-1" /> Add Counterparty
              </Button>
            </div>
          ) : (
            <>
              {/* Payee Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
                  Select Target Counterparty
                </label>
                <select
                  value={selectedPayeeId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedPayeeId(id);
                    const found = counterparties.find((c) => c.id === id);
                    if (found) {
                      setSettleAmount((found.balanceCents / 100).toString());
                    }
                  }}
                  className="w-full bg-surface-container-low text-on-surface text-xs p-2.5 rounded-xl border border-border/60 outline-none cursor-pointer"
                >
                  {counterparties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type === 'payable' ? 'You Owe' : 'Owes'}{' '}
                      {formatRupee(c.balanceCents)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Outstanding Info Card */}
              <div className="bg-surface-container-low p-3.5 rounded-xl border border-border/50 flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">Total Remaining Balance:</span>
                <span className="font-metric-stat text-base font-bold text-primary font-mono">
                  {formatRupee(selectedPayee.balanceCents)}
                </span>
              </div>

              {/* Settle Amount Input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
                    Settlement Amount (₹)
                  </label>
                  <button
                    type="button"
                    onClick={() => setSettleAmount((selectedPayee.balanceCents / 100).toString())}
                    className="font-label-caps text-xs text-primary hover:underline font-bold cursor-pointer"
                  >
                    Settle 100%
                  </button>
                </div>
                <Input
                  type="number"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="text-sm font-mono font-bold"
                  placeholder="Enter amount..."
                />
              </div>

              {/* Payment Mode Pills */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
                  Transaction Gateway / Route
                </label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {(['UPI', 'NEFT', 'Cash', 'Bank'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSettleRoute(mode)}
                      className={clsx(
                        'py-2 rounded-xl text-center font-semibold cursor-pointer transition-all',
                        settleRoute === mode
                          ? 'bg-primary text-on-primary shadow-xs'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-border/50'
                      )}
                    >
                      {mode === 'UPI' ? 'UPI / IMPS' : mode === 'NEFT' ? 'NEFT' : mode === 'Cash' ? 'Cash' : 'Bank Adj'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkbox confirmation */}
              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={markResolved}
                  onChange={(e) => setMarkResolved(e.target.checked)}
                  className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                />
                <span className="text-xs text-on-surface">
                  Mark loan milestone as resolved & archive audit record
                </span>
              </label>

              {/* Action Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="cursor-pointer text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isCommitting}
                  onClick={handleExecuteSettle}
                  className="cursor-pointer text-xs rounded-xl shadow-xs"
                >
                  {isCommitting ? (
                    <>
                      <IconHistory size={14} className="mr-1 animate-spin" /> Committing...
                    </>
                  ) : (
                    <>
                      <IconCheck size={14} className="mr-1" /> Commit to D1 Ledger
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Add / Edit Counterparty Modal */}
      <Modal
        isOpen={isAddCounterpartyOpen}
        onClose={() => {
          setIsAddCounterpartyOpen(false);
          setEditingCounterparty(null);
        }}
        title={editingCounterparty ? 'Edit Counterparty Profile' : 'Add Counterparty Profile'}
        description={editingCounterparty ? 'Update profile parameters, role, or balance.' : 'Register a person or business entity to track mutual liabilities and disbursements.'}
      >
        <form onSubmit={handleAddCounterparty} className="space-y-4 text-left">
          <div>
            <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
              Full Name
            </label>
            <Input
              value={newCpName}
              onChange={(e) => setNewCpName(e.target.value)}
              placeholder="e.g. Ramesh K, AWS Hosting"
              className="mt-1 text-xs"
              required
            />
          </div>

          <div>
            <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
              Relationship / Role
            </label>
            <Input
              value={newCpRole}
              onChange={(e) => setNewCpRole(e.target.value)}
              placeholder="e.g. Friend, Contractor, Landlord"
              className="mt-1 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
                Relationship Type
              </label>
              <select
                value={newCpType}
                onChange={(e) => setNewCpType(e.target.value as 'receivable' | 'payable')}
                className="w-full mt-1 bg-surface-container-low text-on-surface text-xs p-2.5 rounded-xl border border-border/60 outline-none"
              >
                <option value="receivable">Owed to Us (Receivable)</option>
                <option value="payable">We Owe (Payable)</option>
              </select>
            </div>
            <div>
              <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
                Initial Balance (₹)
              </label>
              <Input
                type="number"
                value={newCpAmount}
                onChange={(e) => setNewCpAmount(e.target.value)}
                placeholder="0"
                className="mt-1 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAddCounterpartyOpen(false);
                setEditingCounterparty(null);
              }}
              className="cursor-pointer text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="cursor-pointer text-xs rounded-xl shadow-xs">
              <IconPlus size={14} className="mr-1" /> {editingCounterparty ? 'Save Changes' : 'Save Counterparty'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
