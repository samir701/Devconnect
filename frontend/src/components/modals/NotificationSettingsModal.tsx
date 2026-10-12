'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { Bell, X, Mail, Smartphone, Save } from 'lucide-react';
import type { NotificationPreferences } from '@/lib/types';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  icon?: React.ReactNode;
}

function ToggleRow({ label, description, checked, onChange, icon }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-b-0">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center shrink-0 mt-0.5">
            {icon}
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-white">{label}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>

      {/* Toggle switch */}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${
          checked ? 'bg-indigo-600' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export function NotificationSettingsModal() {
  const {
    isNotifSettingsOpen,
    setIsNotifSettingsOpen,
    notifPreferences,
    saveNotifPreferences,
  } = useAppStore();

  const [local, setLocal] = React.useState<Partial<NotificationPreferences>>({});

  // Sync local state when modal opens
  React.useEffect(() => {
    if (isNotifSettingsOpen && notifPreferences) {
      setLocal({ ...notifPreferences });
    }
  }, [isNotifSettingsOpen, notifPreferences]);

  if (!isNotifSettingsOpen) return null;

  const handleSave = async () => {
    await saveNotifPreferences(local);
    setIsNotifSettingsOpen(false);
  };

  const set = (key: keyof NotificationPreferences, val: boolean) =>
    setLocal((prev) => ({ ...prev, [key]: val }));

  const prefs = { ...notifPreferences, ...local };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 shadow-2xl shadow-black/80 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
              <Bell className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Notification Settings</h2>
              <p className="text-[11px] text-slate-500">Control when and how you get notified</p>
            </div>
          </div>
          <button
            onClick={() => setIsNotifSettingsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-5">
          {/* In-App section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                In-App Notifications
              </span>
            </div>
            <div className="bg-white/3 rounded-xl px-4 border border-white/8">
              <ToggleRow
                label="All in-app notifications"
                description="Show real-time notification badge and popover"
                checked={prefs.inAppAll ?? true}
                onChange={(v) => set('inAppAll', v)}
              />
            </div>
          </div>

          {/* Email section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Email Alerts
              </span>
            </div>
            <div className="bg-white/3 rounded-xl px-4 border border-white/8">
              <ToggleRow
                label="Task assigned to me"
                description="Email when someone assigns you a task"
                checked={prefs.emailOnTaskAssigned ?? true}
                onChange={(v) => set('emailOnTaskAssigned', v)}
              />
              <ToggleRow
                label="Task I created completed"
                description="Email when your task is marked done"
                checked={prefs.emailOnTaskCompleted ?? true}
                onChange={(v) => set('emailOnTaskCompleted', v)}
              />
              <ToggleRow
                label="Bug assigned to me"
                description="Email when a bug is assigned to you"
                checked={prefs.emailOnBugAssigned ?? true}
                onChange={(v) => set('emailOnBugAssigned', v)}
              />
              <ToggleRow
                label="@Mentions"
                description="Email when someone @mentions you in a message"
                checked={prefs.emailOnMention ?? true}
                onChange={(v) => set('emailOnMention', v)}
              />
            </div>
          </div>

          {/* Low-noise principle callout */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-950/50 border border-indigo-900/50">
            <Bell className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-300 leading-relaxed">
              <strong>Low Noise Principle:</strong> ZettaDev only sends actionable notifications.
              Reactions, minor activity, and automated events are never emailed.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10">
          <button
            onClick={() => setIsNotifSettingsOpen(false)}
            className="px-4 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Save className="w-3.5 h-3.5" />
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
