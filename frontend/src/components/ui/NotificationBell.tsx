'use client';

import React, { useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  Settings,
  MessageSquare,
  Bug,
  ListTodo,
  AtSign,
  ChevronRight,
} from 'lucide-react';
import type { AppNotification } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNotifIcon(type: AppNotification['type']) {
  switch (type) {
    case 'MENTION': return <AtSign className="w-3.5 h-3.5 text-purple-400" />;
    case 'TASK_ASSIGNED':
    case 'TASK_COMPLETED': return <ListTodo className="w-3.5 h-3.5 text-cyan-400" />;
    case 'BUG_ASSIGNED':
    case 'BUG_RESOLVED': return <Bug className="w-3.5 h-3.5 text-rose-400" />;
    case 'DIRECT_MESSAGE':
    case 'REPLY': return <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />;
    default: return <Bell className="w-3.5 h-3.5 text-slate-400" />;
  }
}

function getPriorityDot(priority: AppNotification['priority']) {
  if (priority === 'HIGH') return 'bg-rose-500';
  if (priority === 'NORMAL') return 'bg-indigo-500';
  return 'bg-slate-500';
}

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Notification Item ────────────────────────────────────────────────────────

function NotifItem({ notif }: { notif: AppNotification }) {
  const { markNotifRead, selectChannel, activeProjectId } = useAppStore();

  const handleClick = () => {
    if (!notif.read) markNotifRead(notif.id);
    // Navigate to the relevant entity
    if (notif.entityType === 'TASK' && notif.projectId) {
      selectChannel('tasks');
    } else if (notif.entityType === 'BUG' && notif.projectId) {
      selectChannel('bugs');
    } else if (notif.entityType === 'MESSAGE') {
      selectChannel('general');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left flex gap-3 px-4 py-3 transition-all hover:bg-white/5 group ${
        notif.read ? 'opacity-60' : ''
      }`}
    >
      {/* Icon + priority dot */}
      <div className="relative shrink-0 mt-0.5">
        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
          {getNotifIcon(notif.type)}
        </div>
        {!notif.read && (
          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${getPriorityDot(notif.priority)} ring-2 ring-[#161b22]`} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium leading-snug truncate ${notif.read ? 'text-slate-400' : 'text-white'}`}>
          {notif.title}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
          {notif.message}
        </p>
        <p className="text-[10px] text-slate-600 mt-1">{formatTimeAgo(notif.createdAt)}</p>
      </div>

      {/* Read indicator chevron */}
      <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Notification Bell Trigger + Popover ─────────────────────────────────────

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    isNotifOpen,
    setIsNotifOpen,
    markAllNotifsRead,
    setIsNotifSettingsOpen,
    fetchNotifications,
  } = useAppStore();

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isNotifOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isNotifOpen, setIsNotifOpen]);

  // Refresh on open
  useEffect(() => {
    if (isNotifOpen) fetchNotifications();
  }, [isNotifOpen, fetchNotifications]);

  const high = notifications.filter((n) => n.priority === 'HIGH' && !n.read);
  const normal = notifications.filter((n) => n.priority !== 'HIGH' || n.read);

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell button */}
      <button
        id="notification-bell-btn"
        onClick={() => setIsNotifOpen(!isNotifOpen)}
        className={`relative p-2 rounded-xl transition-all ${
          isNotifOpen
            ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
            : 'text-slate-400 hover:text-white hover:bg-white/8 border border-transparent'
        }`}
        aria-label="Notifications"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-bold leading-none shadow-lg shadow-rose-500/50 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover */}
      {isNotifOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-[360px] max-h-[500px] flex flex-col rounded-2xl border border-white/10 shadow-2xl shadow-black/60 z-[200] overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllNotifsRead}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>All read</span>
                </button>
              )}
              <button
                onClick={() => { setIsNotifSettingsOpen(true); setIsNotifOpen(false); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Notification settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsNotifOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-400">All caught up!</p>
                <p className="text-xs text-slate-600 mt-1">No notifications yet.</p>
              </div>
            ) : (
              <>
                {/* High priority section */}
                {high.length > 0 && (
                  <div>
                    <div className="px-4 py-1.5 border-b border-white/5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400/80">
                        🔴 High Priority
                      </span>
                    </div>
                    {high.map((n) => <NotifItem key={n.id} notif={n} />)}
                  </div>
                )}
                {/* Normal / read section */}
                {normal.length > 0 && (
                  <div>
                    {high.length > 0 && (
                      <div className="px-4 py-1.5 border-b border-white/5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Earlier
                        </span>
                      </div>
                    )}
                    {normal.slice(0, 20).map((n) => <NotifItem key={n.id} notif={n} />)}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/10 shrink-0">
              <button
                onClick={() => { fetchNotifications(); }}
                className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                Refresh notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
