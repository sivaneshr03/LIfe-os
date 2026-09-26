import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { UnauthorizedState, LoadingState, ErrorState } from '../ui/States';
import type { PublicUser, AuditEventData, ApiResponse, InviteData } from '../../../shared/types';

export function AdminView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [usersList, setUsersList] = useState<(PublicUser & { activeSessionCount: number })[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'user' | 'admin'>('user');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<InviteData | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setIsLoading(false);
      return;
    }

    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const [usersRes, logsRes] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/admin/audit-logs'),
        ]);

        if (usersRes.status === 403 || logsRes.status === 403) {
          setError('Forbidden: Administrator privileges required.');
          return;
        }

        const usersJson = (await usersRes.json()) as ApiResponse<(PublicUser & { activeSessionCount: number })[]>;
        const logsJson = (await logsRes.json()) as ApiResponse<AuditEventData[]>;

        if (usersJson.success) setUsersList(usersJson.data);
        if (logsJson.success) setAuditLogs(logsJson.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load administration data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
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
      const json = (await res.json()) as ApiResponse<InviteData>;
      if (json.success) {
        setGeneratedInvite(json.data);
        toast(`Invite generated for ${json.data.email}`, 'success');
        setInviteEmail('');
      } else {
        toast(json.error.message, 'error');
      }
    } catch {
      toast('Failed to generate invite', 'error');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleDisableUser = async (targetId: string) => {
    if (!window.confirm('Are you sure you want to disable this user and revoke all their sessions?')) return;
    try {
      const res = await fetch(`/api/admin/users/${targetId}/disable`, { method: 'POST' });
      const json = (await res.json()) as ApiResponse<{ message: string }>;
      if (json.success) {
        toast('User deactivated and sessions revoked', 'success');
        setUsersList((prev) =>
          prev.map((u) => (u.id === targetId ? { ...u, status: 'disabled', activeSessionCount: 0 } : u))
        );
      } else {
        toast(json.error.message, 'error');
      }
    } catch {
      toast('Failed to deactivate user', 'error');
    }
  };

  if (isLoading) return <LoadingState message="Loading administration controls..." />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>🛡️</span> Household Administration
          </h2>
          <p className="text-xs text-foreground/60 mt-0.5">
            Manage authorized household accounts, invite links, and review edge security audit logs.
          </p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)} size="sm">
          + Invite User
        </Button>
      </div>

      {/* Users Table */}
      <section className="bg-card text-card-foreground border border-border rounded-token overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="text-sm font-bold text-foreground">Authorized Accounts ({usersList.length}/5)</h3>
          <span className="text-xs text-foreground/50">Private instance cap: 5 users</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-foreground/70 border-b border-border uppercase font-semibold">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Active Sessions</th>
                <th className="p-3">Created</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usersList.map((u) => (
                <tr key={u.id} className="hover:bg-foreground/[0.01]">
                  <td className="p-3 font-medium text-foreground">
                    <div>{u.name}</div>
                    <div className="text-[11px] text-foreground/50">{u.email}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant={u.role === 'admin' ? 'primary' : 'default'}>{u.role}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={u.status === 'active' ? 'success' : 'destructive'}>{u.status}</Badge>
                  </td>
                  <td className="p-3 font-semibold">{u.activeSessionCount}</td>
                  <td className="p-3 text-foreground/60">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    {u.id !== user?.id && u.status === 'active' && (
                      <button
                        onClick={() => handleDisableUser(u.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Security Audit Events */}
      <section className="bg-card text-card-foreground border border-border rounded-token overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">Security Audit Trail</h3>
          <p className="text-xs text-foreground/60 mt-0.5">Immutable record of authentication attempts and administrative changes.</p>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-foreground/70 border-b border-border uppercase font-semibold sticky top-0">
              <tr>
                <th className="p-3">Event</th>
                <th className="p-3">Timestamp</th>
                <th className="p-3">IP Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-[11px]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-foreground/[0.01]">
                  <td className="p-3 font-semibold text-primary">{log.eventType}</td>
                  <td className="p-3 text-foreground/70">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="p-3 text-foreground/50 truncate max-w-xs">{log.ipHash || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
            <div className="p-4 rounded-token bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs">
              <p className="font-bold">Invite Generated Successfully!</p>
              <p className="mt-1">Provide this code to the authorized user:</p>
              <div className="mt-2 p-2.5 bg-background rounded-token border border-emerald-500/40 font-mono text-sm font-bold text-foreground text-center select-all">
                {generatedInvite.code}
              </div>
            </div>
            <Button
              onClick={() => {
                setIsInviteOpen(false);
                setGeneratedInvite(null);
              }}
              className="w-full"
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

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmittingInvite}>
                Generate Invite
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
