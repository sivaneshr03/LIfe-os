import React, { useState, useEffect, useRef } from 'react';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import {
  IconBell,
  IconAlertTriangle,
  IconCheck,
  IconInfo,
  IconSparkles,
  IconSettings,
  IconX,
} from '../ui/Icons';
import type { InAppNotificationData, ApiResponse } from '../../../shared/types';
import { safeParseJson } from '../../lib/api';

interface NotificationCenterProps {
  onNavigate: (view: string) => void;
}

export function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Read browser notification permission state
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Fetch unread count & notifications
  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const [feedRes, countRes] = await Promise.all([
        fetch('/api/notifications?limit=25'),
        fetch('/api/notifications/unread-count'),
      ]);

      if (feedRes.ok) {
        const { data: feedJson } = await safeParseJson<ApiResponse<InAppNotificationData[]>>(feedRes);
        if (feedJson && feedJson.success) {
          setNotifications(feedJson.data);
        }
      }

      if (countRes.ok) {
        const { data: countJson } = await safeParseJson<ApiResponse<{ unreadCount: number }>>(countRes);
        if (countJson && countJson.success) {
          setUnreadCount(countJson.data.unreadCount);
        }
      }
    } catch {
      // Background poll failure handled gracefully
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s poll
    return () => clearInterval(interval);
  }, []);

  const handleRequestBrowserPermission = async () => {
    if (!('Notification' in window)) {
      toast('This browser does not support desktop notifications', 'warning');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setBrowserPermission(perm);
      if (perm === 'granted') {
        toast('Browser notifications enabled!', 'success');
        new Notification('LifeOS Alerts Active', {
          body: 'You will now receive timely reminders and debt due date alerts.',
          icon: '/icon.svg',
        });
      } else if (perm === 'denied') {
        toast('Permission was denied. You can re-enable in browser site settings.', 'info');
      }
    } catch {
      toast('Failed to request notification permission', 'error');
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: Date.now() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // Graceful ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: Date.now() })));
        setUnreadCount(0);
        toast('All notifications marked as read', 'success');
      }
    } catch {
      toast('Failed to mark all as read', 'error');
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        fetchNotifications();
      }
    } catch {
      toast('Failed to dismiss notification', 'error');
    }
  };

  const handleNotificationClick = (item: InAppNotificationData) => {
    if (!item.isRead) {
      handleMarkAsRead(item.id);
    }
    if (item.actionUrl) {
      setIsOpen(false);
      const targetView = item.actionUrl.split('?')[0].replace(/^\//, '');
      onNavigate(targetView || 'dashboard');
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const filteredNotifications = notifications.filter((n) =>
    filter === 'unread' ? !n.isRead : true
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        aria-label="View notifications"
        className="relative p-2.5 sm:p-2 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-token border border-border/80 bg-card/60 hover:bg-muted text-foreground/80 hover:text-foreground transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary cursor-pointer touch-manipulation"
      >
        <IconBell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-primary rounded-full animate-breathe shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="fixed inset-x-3 top-18 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 max-h-[calc(100dvh-5.5rem)] sm:max-h-[520px] flex flex-col bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-float z-50 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs tracking-tight text-foreground uppercase">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="primary" size="sm">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline font-semibold cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Browser Permission Banner */}
          {browserPermission === 'default' && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10 border-b border-primary/20 text-xs">
              <span className="text-foreground/80 font-medium">Desktop alerts when closed</span>
              <button
                type="button"
                onClick={handleRequestBrowserPermission}
                className="px-2.5 py-1 font-semibold text-primary-foreground bg-primary rounded-md text-[11px] hover:brightness-105 active:scale-95 transition-all shadow-xs"
              >
                Enable
              </button>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex border-b border-border/60 text-xs font-semibold bg-muted/15">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-foreground/50 hover:text-foreground'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer ${
                filter === 'unread'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-foreground/50 hover:text-foreground'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification List Feed */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40 max-h-[340px]">
            {isLoading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-foreground/50">Loading notifications...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                  <IconSparkles size={20} />
                </div>
                <p className="text-xs font-bold text-foreground">All caught up</p>
                <p className="text-[11px] text-foreground/50 mt-1">No unread notifications right now.</p>
              </div>
            ) : (
              filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`flex items-start gap-3 p-3 text-left transition-colors cursor-pointer hover:bg-muted/50 ${
                    !item.isRead ? 'bg-primary/5 font-medium' : 'opacity-85'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">
                    {item.level === 'warning' ? (
                      <IconAlertTriangle size={16} className="text-amber-500" />
                    ) : item.level === 'critical' ? (
                      <IconAlertTriangle size={16} className="text-rose-500" />
                    ) : item.level === 'success' ? (
                      <IconCheck size={16} className="text-emerald-500" />
                    ) : (
                      <IconInfo size={16} className="text-primary" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                      <span className="text-[10px] text-foreground/40 shrink-0 font-mono">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/70 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteNotification(e, item.id)}
                    className="text-foreground/40 hover:text-foreground text-xs p-1 rounded-md hover:bg-muted shrink-0 transition-colors"
                    title="Dismiss"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border/60 bg-muted/20 text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onNavigate('settings');
              }}
              className="text-xs text-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-1.5 font-medium cursor-pointer"
            >
              <IconSettings size={14} />
              <span>Notification Preferences</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
