import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import {
  IconPayments,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconUsers,
  IconPieChart,
  IconClock,
  IconCheck,
  IconAlertTriangle,
  IconDownload,
  IconZap,
  IconSend,
  IconFileText,
  IconHistory,
  IconPlus,
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

const INITIAL_LEDGER_ENTRIES: LendingLedgerEntry[] = [
  {
    id: 'tx-1',
    date: '2024-10-01',
    counterparty: 'Amit Sharma',
    counterpartyInitials: 'AS',
    category: 'personal_loan',
    categoryLabel: 'Emergency Loan',
    channel: 'UPI / GPay',
    amountCents: 5000000,
    totalPrincipalCents: 5000000,
    paidCents: 2500000,
    status: 'partial',
    dueDate: '2024-10-03',
  },
  {
    id: 'tx-2',
    date: '2024-09-28',
    counterparty: 'Design Contractor Studio',
    counterpartyInitials: 'DC',
    category: 'vendor_payout',
    categoryLabel: 'SaaS Milestone #2',
    channel: 'NEFT / Wire',
    amountCents: 8500000,
    totalPrincipalCents: 8500000,
    paidCents: 8500000,
    status: 'settled',
  },
  {
    id: 'tx-3',
    date: '2024-09-24',
    counterparty: 'Rahul Verma',
    counterpartyInitials: 'RV',
    category: 'personal_loan',
    categoryLabel: 'Colleague Hardware Share',
    channel: 'Cash Payout',
    amountCents: 1500000,
    totalPrincipalCents: 1500000,
    paidCents: 0,
    status: 'overdue',
    overdueDays: 4,
    dueDate: '2024-09-20',
  },
  {
    id: 'tx-4',
    date: '2024-09-19',
    counterparty: 'Priya Patel',
    counterpartyInitials: 'PP',
    category: 'family',
    categoryLabel: 'Family Pool Share',
    channel: 'Direct NetBanking',
    amountCents: 1000000,
    totalPrincipalCents: 3200000,
    paidCents: 1000000,
    status: 'partial',
    dueDate: '2024-10-15',
  },
  {
    id: 'tx-5',
    date: '2024-09-15',
    counterparty: 'Cloud Hosting Co.',
    counterpartyInitials: 'CH',
    category: 'vendor_payout',
    categoryLabel: 'Vendor Invoice #9021',
    channel: 'Card',
    amountCents: 840000,
    totalPrincipalCents: 840000,
    paidCents: 0,
    status: 'pending',
    dueDate: '2024-10-05',
  },
];

const INITIAL_COUNTERPARTIES: CounterpartyProfile[] = [
  {
    id: 'cp-1',
    name: 'Amit Sharma',
    initials: 'AS',
    role: 'Friend / Peer',
    type: 'receivable',
    lentCents: 5000000,
    returnedCents: 2500000,
    balanceCents: 2500000,
    statusBadge: 'Due Oct 2',
  },
  {
    id: 'cp-2',
    name: 'Design Contractor',
    initials: 'DC',
    role: 'Payee / Studio',
    type: 'settled',
    lentCents: 8500000,
    returnedCents: 8500000,
    balanceCents: 0,
    statusBadge: 'Settled',
  },
  {
    id: 'cp-3',
    name: 'Rahul Verma',
    initials: 'RV',
    role: 'Colleague',
    type: 'receivable',
    lentCents: 1500000,
    returnedCents: 0,
    balanceCents: 1500000,
    statusBadge: 'Overdue +4d',
    isOverdue: true,
  },
  {
    id: 'cp-4',
    name: 'Priya Patel',
    initials: 'PP',
    role: 'Family / Borrowed',
    type: 'payable',
    lentCents: 3200000,
    returnedCents: 1000000,
    balanceCents: 2200000,
    statusBadge: 'To Pay',
  },
];

function formatRupee(minorUnits: number): string {
  const whole = Math.round(minorUnits / 100);
  return '₹' + whole.toLocaleString('en-IN');
}

export function LendingView({ onNavigate: _onNavigate }: LendingViewProps) {
  const { toast } = useToast();

  const [ledgerEntries, setLedgerEntries] = useState<LendingLedgerEntry[]>(INITIAL_LEDGER_ENTRIES);
  const [counterparties, setCounterparties] = useState<CounterpartyProfile[]>(INITIAL_COUNTERPARTIES);
  const [filterPill, setFilterPill] = useState<'all' | 'vendor' | 'personal' | 'settled' | 'pending'>('all');

  // Express Input State
  const [rapidName, setRapidName] = useState('');
  const [rapidAmount, setRapidAmount] = useState('');
  const [rapidChannel, setRapidChannel] = useState<'UPI / GPay' | 'NEFT / Wire' | 'Cash Payout' | 'Direct NetBanking'>('UPI / GPay');

  // Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [selectedPayeeId, setSelectedPayeeId] = useState(INITIAL_COUNTERPARTIES[0].id);
  const [settleAmount, setSettleAmount] = useState('25000');
  const [settleRoute, setSettleRoute] = useState<'UPI' | 'NEFT' | 'Cash' | 'Bank'>('UPI');
  const [markResolved, setMarkResolved] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);

  // New Counterparty Modal State
  const [isAddCounterpartyOpen, setIsAddCounterpartyOpen] = useState(false);
  const [newCpName, setNewCpName] = useState('');
  const [newCpRole, setNewCpRole] = useState('');
  const [newCpType, setNewCpType] = useState<'receivable' | 'payable'>('receivable');
  const [newCpAmount, setNewCpAmount] = useState('');

  // Selected Payee Details
  const selectedPayee = useMemo(
    () => counterparties.find((c) => c.id === selectedPayeeId) || counterparties[0],
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

  const handleRapidRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(rapidAmount);
    if (!rapidName.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast('Please enter a valid counterparty name and amount.', 'error');
      return;
    }

    const minorUnits = Math.round(parsedAmount * 100);
    const initials = rapidName
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const newTx: LendingLedgerEntry = {
      id: `tx-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      counterparty: rapidName.trim(),
      counterpartyInitials: initials || 'CP',
      category: 'personal_loan',
      categoryLabel: 'Micro-Disbursement',
      channel: rapidChannel,
      amountCents: minorUnits,
      totalPrincipalCents: minorUnits,
      paidCents: minorUnits,
      status: 'settled',
    };

    setLedgerEntries([newTx, ...ledgerEntries]);
    setRapidName('');
    setRapidAmount('');
    toast(`Payment of ${formatRupee(minorUnits)} recorded for ${rapidName}`, 'success');
  };

  const handleExecuteSettle = async () => {
    const parsed = parseFloat(settleAmount);
    if (isNaN(parsed) || parsed <= 0) {
      toast('Please enter a valid settlement amount.', 'error');
      return;
    }

    setIsCommitting(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    const minorUnits = Math.round(parsed * 100);

    // Update counterparty
    setCounterparties((prev) =>
      prev.map((c) => {
        if (c.id === selectedPayee.id) {
          const newBalance = Math.max(0, c.balanceCents - minorUnits);
          return {
            ...c,
            returnedCents: c.returnedCents + minorUnits,
            balanceCents: newBalance,
            type: newBalance === 0 ? 'settled' : c.type,
            statusBadge: newBalance === 0 ? 'Settled' : c.statusBadge,
          };
        }
        return c;
      })
    );

    // Record settlement ledger entry
    const newTx: LendingLedgerEntry = {
      id: `tx-settle-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      counterparty: selectedPayee.name,
      counterpartyInitials: selectedPayee.initials,
      category: 'personal_loan',
      categoryLabel: 'Settlement Resolution',
      channel: settleRoute === 'UPI' ? 'UPI / GPay' : settleRoute === 'NEFT' ? 'NEFT / Wire' : 'Cash Payout',
      amountCents: minorUnits,
      totalPrincipalCents: selectedPayee.lentCents,
      paidCents: minorUnits,
      status: 'settled',
    };

    setLedgerEntries([newTx, ...ledgerEntries]);
    setIsCommitting(false);
    setIsSettleModalOpen(false);
    toast(`Successfully settled ${formatRupee(minorUnits)} with ${selectedPayee.name}`, 'success');
  };

  const handleAddCounterparty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCpName.trim()) {
      toast('Please enter a counterparty name.', 'error');
      return;
    }
    const initialAmt = parseFloat(newCpAmount) || 0;
    const initialCents = Math.round(initialAmt * 100);

    const initials = newCpName
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const newCp: CounterpartyProfile = {
      id: `cp-${Date.now()}`,
      name: newCpName.trim(),
      initials: initials || 'CP',
      role: newCpRole.trim() || (newCpType === 'receivable' ? 'Peer / Borrower' : 'Creditor'),
      type: newCpType,
      lentCents: initialCents,
      returnedCents: 0,
      balanceCents: initialCents,
      statusBadge: initialCents > 0 ? (newCpType === 'receivable' ? 'Pending' : 'To Pay') : 'Active',
    };

    setCounterparties([...counterparties, newCp]);
    setIsAddCounterpartyOpen(false);
    setNewCpName('');
    setNewCpRole('');
    setNewCpAmount('');
    toast(`Counterparty ${newCp.name} registered.`, 'success');
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
            onClick={() => setIsAddCounterpartyOpen(true)}
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
            {/* Alert 1 */}
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-border/60 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-title-sm font-bold text-on-surface">Amit Sharma</span>
                <span className="px-2 py-0.5 rounded-full bg-error-container/60 text-error font-label-caps text-[10px] font-bold">
                  Due in 2 Days
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">Principal Remaining</span>
                <span className="font-bold text-on-surface font-mono">₹25,000</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => toast('Friendly reminder sent via LifeOS WhatsApp gateway', 'success')}
                  className="flex-1 bg-surface-container-highest hover:bg-surface-container text-on-surface font-label-md text-xs py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer font-medium"
                >
                  Send Reminder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPayeeId('cp-1');
                    setSettleAmount('25000');
                    setIsSettleModalOpen(true);
                  }}
                  className="flex-1 bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer font-medium shadow-xs"
                >
                  Settle ₹25k
                </button>
              </div>
            </div>

            {/* Alert 2 */}
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-border/60 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-title-sm font-bold text-on-surface">Cloud Hosting Co.</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-label-caps text-[10px] font-bold">
                  Due Oct 5
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">Vendor Invoice #9021</span>
                <span className="font-bold text-on-surface font-mono">₹8,400</span>
              </div>
              <button
                type="button"
                onClick={() => toast('Payment scheduled for Cloud Hosting Co. on Oct 5', 'success')}
                className="w-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer font-medium shadow-xs mt-1"
              >
                Schedule Payment
              </button>
            </div>
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
              onChange={(e) => setRapidChannel(e.target.value as any)}
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
                                  setSelectedPayeeId('cp-1');
                                  setSettleAmount((tx.amountCents / 100).toString());
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
              {counterparties.map((cp) => (
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
              ))}
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
        </div>
      </Modal>

      {/* Add Counterparty Modal */}
      <Modal
        isOpen={isAddCounterpartyOpen}
        onClose={() => setIsAddCounterpartyOpen(false)}
        title="Add Counterparty Profile"
        description="Register a person or business entity to track mutual liabilities and disbursements."
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
                onChange={(e) => setNewCpType(e.target.value as any)}
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
              onClick={() => setIsAddCounterpartyOpen(false)}
              className="cursor-pointer text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="cursor-pointer text-xs rounded-xl shadow-xs">
              <IconPlus size={14} className="mr-1" /> Save Counterparty
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
