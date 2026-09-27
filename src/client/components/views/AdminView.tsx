import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { UnauthorizedState, LoadingState, ErrorState } from '../ui/States';
import {
  IconShield,
  IconRefresh,
  IconActivity,
  IconUsers,
  IconSettings,
  IconLock,
  IconPlus,
} from '../ui/Icons';
import type {
  PublicUser,
  AuditEventData,
  ApiResponse,
  InviteData,
  ImportExportJobData,
} from '../../../shared/types';
import { safeParseJson } from '../../lib/api';

interface SystemOverviewStats {
  users: number;
  activeSessions: number;
  maxAllowedUsers: number;
  modules: {
    tasks: number;
    notes: number;
    financeTransactions: number;
    financeAccounts: number;
    financeDebts: number;
    financeBudgets: number;
    investmentAssets: number;
    goals: number;
    habits: number;
    trackers: number;
    workouts: number;
    reminders: number;
    notifications: number;
    jobs: number;
  };
  system: {
    environment: string;
    database: string;
    uptimeSeconds: number;
    timestamp: number;
  };
}

export function AdminView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'jobs' | 'audit'>('overview');
  const [stats, setStats] = useState<SystemOverviewStats | null>(null);
  const [usersList, setUsersList] = useState<(PublicUser & { activeSessionCount: number })[]>([]);
  const [invitesList, setInvitesList] = useState<InviteData[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEventData[]>([]);
  const [jobsList, setJobsList] = useState<ImportExportJobData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'user' | 'admin'>('user');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<InviteData | null>(null);

  // Destructive action confirmation modals
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning';
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    variant: 'danger',
    onConfirm: async () => {},
  });

  // Audit filter state
  const [auditFilter, setAuditFilter] = useState('');

  const fetchAdminData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewRes, usersRes, invitesRes, logsRes, jobsRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/users'),
        fetch('/api/admin/invites'),
        fetch('/api/admin/audit-logs'),
        fetch('/api/admin/jobs'),
      ]);

      if (
        overviewRes.status === 403 ||
        usersRes.status === 403 ||
        invitesRes.status === 403 ||
        logsRes.status === 403
      ) {
        setError('Forbidden: Administrator privileges required.');
        return;
      }

      const { data: overviewJson } = await safeParseJson<ApiResponse<SystemOverviewStats>>(overviewRes);
      const { data: usersJson } = await safeParseJson<ApiResponse<(PublicUser & { activeSessionCount: number })[]>>(usersRes);
      const { data: invitesJson } = await safeParseJson<ApiResponse<InviteData[]>>(invitesRes);
      const { data: logsJson } = await safeParseJson<ApiResponse<AuditEventData[]>>(logsRes);
      const { data: jobsJson } = await safeParseJson<ApiResponse<ImportExportJobData[]>>(jobsRes);

      if (overviewJson?.success) setStats(overviewJson.data);
      if (usersJson?.success) setUsersList(usersJson.data);
      if (invitesJson?.success) setInvitesList(invitesJson.data);
      if (logsJson?.success) setAuditLogs(logsJson.data);
      if (jobsJson?.success) setJobsList(jobsJson.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load administration data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'admin') {
      setIsLoading(false);
      return;
    }
    fetchAdminData();
  }, [user]);

  // Authorization gate check
  if (user?.role !== 'admin') {
    return (
      <UnauthorizedState
        title="Admin Panel Restricted"
        message="Only users with the Administrator role are permitted to view or manage household users and security audit logs."
        onBack={() => onNavigate('dashboard')}
      />
    );
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingInvite(true);
    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const { data: json, error: parseError } = await safeParseJson<ApiResponse<InviteData>>(res);
      if (res.ok && json && json.success) {
        setGeneratedInvite(json.data);
        toast(`Invite generated for ${json.data.email}`, 'success');
        setInviteEmail('');
        fetchAdminData();
      } else {
        toast(json?.error?.message || parseError || 'Failed to generate invite', 'error');
      }
    } catch {
      toast('Failed to generate invite', 'error');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleRevokeInvite = (invite: InviteData) => {
    setConfirmModal({
      isOpen: true,
      title: 'Revoke Invite Code',
      message: `Are you sure you want to revoke the invite code for "${invite.email}"? It will immediately become unusable.`,
      confirmLabel: 'Revoke Invite',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/invites/${invite.id}`, { method: 'DELETE' });
          if (res.ok) {
            toast('Invite code revoked', 'success');
            fetchAdminData();
          }
        } catch {
          toast('Failed to revoke invite', 'error');
        } finally {
          setConfirmModal((m) => ({ ...m, isOpen: false }));
        }
      },
    });
  };

  const handleToggleUserStatus = (targetUser: PublicUser) => {
    const isDisabling = targetUser.status === 'active';
    setConfirmModal({
      isOpen: true,
      title: isDisabling ? 'Deactivate User Account' : 'Re-enable User Account',
      message: isDisabling
        ? `Are you sure you want to deactivate "${targetUser.name}" (${targetUser.email})? All their active sessions will be terminated immediately.`
        : `Re-enable account for "${targetUser.name}"? They will be able to log in again.`,
      confirmLabel: isDisabling ? 'Deactivate Account' : 'Re-enable Account',
      variant: isDisabling ? 'danger' : 'warning',
      onConfirm: async () => {
        try {
          const endpoint = isDisabling
            ? `/api/admin/users/${targetUser.id}/disable`
            : `/api/admin/users/${targetUser.id}/enable`;
          const res = await fetch(endpoint, { method: 'POST' });
          const { data: json, error: parseError } = await safeParseJson<ApiResponse<{ message: string }>>(res);
          if (res.ok && json && json.success) {
            toast(
              isDisabling ? 'User account deactivated' : 'User account re-enabled',
              'success'
            );
            fetchAdminData();
          } else {
            toast(json?.error?.message || parseError || 'Action failed', 'error');
          }
        } catch {
          toast('Network error performing user update', 'error');
        } finally {
          setConfirmModal((m) => ({ ...m, isOpen: false }));
        }
      },
    });
  };

  const handleChangeUserRole = (targetUser: PublicUser, newRole: 'admin' | 'user') => {
    setConfirmModal({
      isOpen: true,
      title: 'Change User Role',
      message: `Change role of "${targetUser.name}" from ${targetUser.role} to ${newRole}?`,
      confirmLabel: `Change to ${newRole}`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/users/${targetUser.id}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole }),
          });
          const { data: json, error: parseError } = await safeParseJson<ApiResponse<{ message: string }>>(res);
          if (res.ok && json && json.success) {
            toast(`Role updated to ${newRole}`, 'success');
            fetchAdminData();
          } else {
            toast(json?.error?.message || parseError || 'Failed to update role', 'error');
          }
        } catch {
          toast('Failed to change role', 'error');
        } finally {
          setConfirmModal((m) => ({ ...m, isOpen: false }));
        }
      },
    });
  };

  const handleRevokeSessions = (targetUser: PublicUser) => {
    setConfirmModal({
      isOpen: true,
      title: 'Revoke Active Sessions',
      message: `Force sign-out "${targetUser.name}" from all browser sessions?`,
      confirmLabel: 'Revoke All Sessions',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/users/${targetUser.id}/sessions`, {
            method: 'DELETE',
          });
          if (res.ok) {
            toast('Active sessions revoked', 'success');
            fetchAdminData();
          }
        } catch {
          toast('Failed to revoke sessions', 'error');
        } finally {
          setConfirmModal((m) => ({ ...m, isOpen: false }));
        }
      },
    });
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/retry`, { method: 'POST' });
      if (res.ok) {
        toast('Job queued for retry', 'success');
        fetchAdminData();
      }
    } catch {
      toast('Failed to retry job', 'error');
    }
  };

  if (isLoading) return <LoadingState message="Loading administration controls..." />;
  if (error) return <ErrorState message={error} onRetry={() => fetchAdminData()} />;

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (!auditFilter) return true;
    const q = auditFilter.toLowerCase();
    return (
      log.eventType.toLowerCase().includes(q) ||
      (log.ipHash && log.ipHash.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header Cockpit */}
      <div className="p-6 bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <IconShield size={18} />
            </span>
            <span>Household Administration</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage authorized household accounts, review system telemetry, inspect jobs, and monitor security audit events.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
          <Button onClick={() => setIsInviteOpen(true)} size="sm" variant="primary" className="cursor-pointer text-xs w-full sm:w-auto justify-center min-h-[40px] sm:min-h-[36px]">
            <IconPlus size={14} className="mr-1" /> Invite User
          </Button>
          <Button onClick={fetchAdminData} variant="outline" size="sm" className="cursor-pointer text-xs w-full sm:w-auto justify-center min-h-[40px] sm:min-h-[36px]">
            <IconRefresh size={14} className="mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-1.5">
        {[
          { id: 'overview' as const, label: 'System Overview', icon: <IconActivity size={14} className="mr-1.5" /> },
          { id: 'users' as const, label: `User Accounts (${usersList.length}/5)`, icon: <IconUsers size={14} className="mr-1.5" /> },
          { id: 'jobs' as const, label: `Jobs & Importers (${jobsList.length})`, icon: <IconSettings size={14} className="mr-1.5" /> },
          { id: 'audit' as const, label: `Security Audit Trail (${auditLogs.length})`, icon: <IconLock size={14} className="mr-1.5" /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={clsx(
              'min-h-[44px] sm:min-h-[36px] px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center whitespace-nowrap cursor-pointer touch-manipulation shrink-0',
              activeTab === t.id
                ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: System Overview */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-card/70 backdrop-blur-sm border border-border/80 glass-inner shadow-xs">
              <p className="text-[11px] font-bold text-muted-foreground uppercase font-mono">Household Accounts</p>
              <p className="text-2xl font-black text-foreground mt-1">
                {stats.users} <span className="text-xs font-normal text-muted-foreground">/ 5 max</span>
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-card/70 backdrop-blur-sm border border-border/80 glass-inner shadow-xs">
              <p className="text-[11px] font-bold text-muted-foreground uppercase font-mono">Active Sessions</p>
              <p className="text-2xl font-black text-emerald-500 mt-1">{stats.activeSessions}</p>
            </div>
            <div className="p-5 rounded-2xl bg-card/70 backdrop-blur-sm border border-border/80 glass-inner shadow-xs">
              <p className="text-[11px] font-bold text-muted-foreground uppercase font-mono">Total Ledger Tx</p>
              <p className="text-2xl font-black text-foreground mt-1">
                {stats.modules.financeTransactions}
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-card/70 backdrop-blur-sm border border-border/80 glass-inner shadow-xs">
              <p className="text-[11px] font-bold text-muted-foreground uppercase font-mono">Database Health</p>
              <p className="text-2xl font-black text-emerald-500 mt-1">Connected</p>
            </div>
          </div>

          {/* Module Breakdown Grid */}
          <div className="p-6 rounded-2xl bg-card/70 backdrop-blur-sm border border-border/80 glass-inner shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground">Database Records Telemetry</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60">
                <span className="text-muted-foreground">Tasks & Checklists</span>
                <p className="text-base font-bold text-foreground mt-1 font-mono">{stats.modules.tasks}</p>
              </div>
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60">
                <span className="text-muted-foreground">Notes & Prompts</span>
                <p className="text-base font-bold text-foreground mt-1 font-mono">{stats.modules.notes}</p>
              </div>
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60">
                <span className="text-muted-foreground">Finance Accounts</span>
                <p className="text-base font-bold text-foreground mt-1 font-mono">
                  {stats.modules.financeAccounts}
                </p>
              </div>
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60">
                <span className="text-muted-foreground">Debts & Loans</span>
                <p className="text-base font-bold text-foreground mt-1 font-mono">{stats.modules.financeDebts}</p>
              </div>
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60">
                <span className="text-muted-foreground">Active Budgets</span>
                <p className="text-base font-bold text-foreground mt-1 font-mono">
                  {stats.modules.financeBudgets}
                </p>
              </div>
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60">
                <span className="text-muted-foreground">Investments</span>
                <p className="text-base font-bold text-foreground mt-1 font-mono">
                  {stats.modules.investmentAssets}
                </p>
              </div>
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60">
                <span className="text-muted-foreground">Goals & Milestones</span>
                <p className="text-base font-bold text-foreground mt-1 font-mono">{stats.modules.goals}</p>
              </div>
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60">
                <span className="text-muted-foreground">Workouts Logged</span>
                <p className="text-base font-bold text-foreground mt-1 font-mono">{stats.modules.workouts}</p>
              </div>
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60">
                <span className="text-muted-foreground">Trackers & Habits</span>
                <p className="text-base font-bold text-foreground mt-1 font-mono">
                  {stats.modules.habits + stats.modules.trackers}
                </p>
              </div>
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60">
                <span className="text-muted-foreground">Scheduled Reminders</span>
                <p className="text-base font-bold text-foreground mt-1 font-mono">{stats.modules.reminders}</p>
              </div>
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60">
                <span className="text-muted-foreground">Notifications Feed</span>
                <p className="text-base font-bold text-foreground mt-1 font-mono">
                  {stats.modules.notifications}
                </p>
              </div>
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60">
                <span className="text-muted-foreground">Batch Jobs</span>
                <p className="text-base font-bold text-foreground mt-1 font-mono">{stats.modules.jobs}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: User Accounts & Invites */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Accounts Table */}
          <section className="bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner overflow-hidden shadow-xs">
            <div className="p-5 border-b border-border/80 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Household Accounts ({usersList.length}/5)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Private instance maximum allowance: 5 users
                </p>
              </div>
              <Button onClick={() => setIsInviteOpen(true)} size="sm" variant="primary" className="cursor-pointer text-xs">
                <IconPlus size={14} className="mr-1" /> Generate Invite
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border/80 uppercase font-mono font-semibold text-[11px]">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Active Sessions</th>
                    <th className="p-3.5">Created</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-medium text-foreground">
                        <div className="font-bold">{u.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{u.email}</div>
                      </td>
                      <td className="p-3.5">
                        <Badge variant={u.role === 'admin' ? 'primary' : 'default'} className="capitalize">{u.role}</Badge>
                      </td>
                      <td className="p-3.5">
                        <Badge variant={u.status === 'active' ? 'success' : 'destructive'} className="capitalize">
                          {u.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-semibold font-mono">{u.activeSessionCount}</td>
                      <td className="p-3.5 text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        {u.id !== user?.id && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleChangeUserRole(u, u.role === 'admin' ? 'user' : 'admin')
                              }
                              className="text-xs text-primary hover:underline font-medium cursor-pointer"
                            >
                              Make {u.role === 'admin' ? 'User' : 'Admin'}
                            </button>
                            {u.activeSessionCount > 0 && (
                              <button
                                type="button"
                                onClick={() => handleRevokeSessions(u)}
                                className="text-xs text-amber-500 hover:text-amber-700 font-medium cursor-pointer"
                              >
                                Revoke Sessions
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(u)}
                              className={`text-xs font-medium cursor-pointer ${
                                u.status === 'active'
                                  ? 'text-red-500 hover:text-red-700'
                                  : 'text-emerald-500 hover:text-emerald-700'
                              }`}
                            >
                              {u.status === 'active' ? 'Deactivate' : 'Re-enable'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pending Invites Table */}
          <section className="bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner overflow-hidden shadow-xs">
            <div className="p-5 border-b border-border/80">
              <h3 className="text-sm font-bold text-foreground">
                Active & Past Invites ({invitesList.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Single-use onboarding codes generated for household allowlist
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border/80 uppercase font-mono font-semibold text-[11px]">
                  <tr>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Code</th>
                    <th className="p-3.5">Assigned Role</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Expires</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {invitesList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        No active invite codes. Click "+ Generate Invite" to onboard a new user.
                      </td>
                    </tr>
                  ) : (
                    invitesList.map((inv) => {
                      const isExpired = inv.expiresAt < Date.now();
                      const isUsed = Boolean(inv.usedAt);
                      return (
                        <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3.5 font-medium text-foreground">{inv.email}</td>
                          <td className="p-3.5 font-mono font-bold select-all text-primary">
                            {inv.code}
                          </td>
                          <td className="p-3.5">
                            <Badge variant={inv.role === 'admin' ? 'primary' : 'default'} className="capitalize">
                              {inv.role}
                            </Badge>
                          </td>
                          <td className="p-3.5">
                            <Badge
                              variant={
                                isUsed ? 'success' : isExpired ? 'destructive' : 'warning'
                              }
                              className="capitalize"
                            >
                              {isUsed ? 'Used' : isExpired ? 'Expired' : 'Pending'}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-muted-foreground">
                            {new Date(inv.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="p-3.5 text-right">
                            {!isUsed && (
                              <button
                                type="button"
                                onClick={() => handleRevokeInvite(inv)}
                                className="text-xs text-red-500 hover:text-red-700 font-medium cursor-pointer"
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: Jobs & Importers */}
      {activeTab === 'jobs' && (
        <section className="bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner overflow-hidden shadow-xs">
          <div className="p-5 border-b border-border/80">
            <h3 className="text-sm font-bold text-foreground">
              Background Batch & Import/Export Jobs
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monitor CSV/JSON exports, backup creation, and import validations.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border/80 uppercase font-mono font-semibold text-[11px]">
                <tr>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Domain</th>
                  <th className="p-3.5">Format</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Items</th>
                  <th className="p-3.5">Created</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {jobsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No background jobs recorded yet.
                    </td>
                  </tr>
                ) : (
                  jobsList.map((job) => (
                    <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-semibold uppercase">{job.type}</td>
                      <td className="p-3.5 capitalize">{job.domain}</td>
                      <td className="p-3.5 uppercase font-mono">{job.format}</td>
                      <td className="p-3.5">
                        <Badge
                          variant={
                            job.status === 'completed'
                              ? 'success'
                              : job.status === 'failed'
                              ? 'destructive'
                              : 'primary'
                          }
                          className="capitalize"
                        >
                          {job.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-mono">
                        {job.processedItems} / {job.totalItems}{' '}
                        {job.errorCount > 0 && (
                          <span className="text-red-500 font-bold">({job.errorCount} errors)</span>
                        )}
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right">
                        {job.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleRetryJob(job.id)}
                            className="text-xs text-primary hover:underline font-medium cursor-pointer"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: Security Audit Trail */}
      {activeTab === 'audit' && (
        <section className="bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner overflow-hidden shadow-xs">
          <div className="p-5 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Security Audit Trail</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Immutable ledger of authentication, authorization, and administrative changes.
              </p>
            </div>
            <Input
              placeholder="Filter by event (e.g. auth, admin)..."
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              className="max-w-xs text-xs"
            />
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border/80 uppercase font-mono font-semibold sticky top-0 text-[11px]">
                <tr>
                  <th className="p-3.5">Event</th>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">User ID</th>
                  <th className="p-3.5">IP Hash</th>
                  <th className="p-3.5">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No matching audit events found.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-semibold text-primary">{log.eventType}</td>
                      <td className="p-3.5 text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-muted-foreground truncate max-w-[100px]">
                        {log.userId || 'system'}
                      </td>
                      <td className="p-3.5 text-muted-foreground truncate max-w-[120px]">
                        {log.ipHash || 'N/A'}
                      </td>
                      <td className="p-3.5 text-muted-foreground max-w-xs truncate font-sans text-xs">
                        {log.metadata ? JSON.stringify(log.metadata) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => {
          setIsInviteOpen(false);
          setGeneratedInvite(null);
        }}
        title="Invite New Household User"
        description="Generate an onboarding code for your private LifeOS instance."
      >
        {generatedInvite ? (
          <div className="space-y-4 text-left">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs">
              <p className="font-bold">Invite Generated Successfully!</p>
              <p className="mt-1">Provide this single-use code to the authorized user:</p>
              <div className="mt-2 p-2.5 bg-background rounded-xl border border-emerald-500/40 font-mono text-sm font-bold text-foreground text-center select-all">
                {generatedInvite.code}
              </div>
            </div>
            <Button
              onClick={() => {
                setIsInviteOpen(false);
                setGeneratedInvite(null);
              }}
              className="w-full cursor-pointer"
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreateInvite} className="space-y-4">
            <Input
              label="Allowlisted Email"
              type="email"
              required
              placeholder="family.member@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />

            <Select
              label="Assigned Role"
              options={[
                { label: 'Standard User (Personal views only)', value: 'user' },
                { label: 'Administrator (Full system control)', value: 'admin' },
              ]}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'user' | 'admin')}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)} className="flex-1 sm:flex-initial">
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmittingInvite} className="flex-1 sm:flex-initial">
                Generate Invite
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Destructive Action Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((m) => ({ ...m, isOpen: false }))}
        title={confirmModal.title}
        description={confirmModal.message}
      >
        <div className="flex items-center justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmModal((m) => ({ ...m, isOpen: false }))}
            className="flex-1 sm:flex-initial"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmModal.variant === 'danger' ? 'destructive' : 'primary'}
            onClick={confirmModal.onConfirm}
            className="flex-1 sm:flex-initial"
          >
            {confirmModal.confirmLabel}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
