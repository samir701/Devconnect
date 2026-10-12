'use client';

import React from 'react';
import { AlertTriangle, ShieldAlert, X, EyeOff } from 'lucide-react';
import { SecretDetectionResult } from '@/lib/types';

interface SecretWarningModalProps {
  isOpen: boolean;
  secretResult: SecretDetectionResult | null;
  onRemoveSecret: () => void;
  onSendAnyway: () => void;
  onClose: () => void;
}

export function SecretWarningModal({
  isOpen,
  secretResult,
  onRemoveSecret,
  onSendAnyway,
  onClose,
}: SecretWarningModalProps) {
  if (!isOpen || !secretResult) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#0e1320] p-6 shadow-2xl relative animate-secret-alert">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Security Intercept
              </span>
            </div>
            <h3 className="text-base font-semibold text-white mt-0.5">
              Possible Secret Detected
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              This message appears to contain sensitive credentials:
            </p>
          </div>
        </div>

        {/* Secret Information Box */}
        <div className="mt-4 p-3.5 rounded-xl bg-black/40 border border-white/10">
          <div className="text-[11px] font-mono text-amber-300 font-semibold flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{secretResult.secretType || 'Credential Token'}</span>
          </div>
          <div className="text-xs font-mono text-slate-300 bg-white/5 p-2 rounded border border-white/5 break-all">
            {secretResult.matchedText
              ? secretResult.matchedText.slice(0, 4) + '••••••••••••••••' + secretResult.matchedText.slice(-4)
              : 'Sensitive Token'}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Sending raw keys into team workspaces or Git activity risks credential leakage.
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onRemoveSecret}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Remove Secret</span>
          </button>

          <button
            onClick={onSendAnyway}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-xs font-medium transition-all cursor-pointer"
          >
            Send Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
