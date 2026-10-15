'use client';

import React from 'react';
import { useAppStore, ToastNotification } from '@/lib/store';
import { Avatar } from '@/components/ui/Avatar';
import { MessageSquare, Hash, X, ArrowRight, Bell } from 'lucide-react';

export function NotificationToastContainer() {
  const { toasts, dismissToast, selectConversation, selectProject, selectChannel, projects } = useAppStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isDirect = toast.type === 'DIRECT_MESSAGE';
        const project = toast.projectId ? projects.find((p) => p.id === toast.projectId) : undefined;
        const channelLabel = toast.channel ? `#${toast.channel}` : isDirect ? 'Direct Message' : 'Team Message';

        const handleAction = () => {
          if (toast.conversation) {
            selectConversation(toast.conversation);
          } else if (toast.conversationId) {
            // Find in conversations or select project
            if (toast.projectId) {
              selectProject(toast.projectId);
              if (toast.channel) selectChannel(toast.channel);
            }
          } else if (toast.projectId) {
            selectProject(toast.projectId);
            if (toast.channel) selectChannel(toast.channel);
          }
          dismissToast(toast.id);
        };

        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto w-full rounded-2xl bg-[#0c1222]/95 border border-indigo-500/30 p-3.5 shadow-2xl shadow-indigo-950/80 backdrop-blur-xl animate-in slide-in-from-right-5 fade-in duration-200 relative overflow-hidden group hover:border-indigo-400/50 transition-all"
          >
            {/* Ambient subtle glow edge */}
            <div
              className={`absolute top-0 left-0 bottom-0 w-1 ${
                isDirect
                  ? 'bg-gradient-to-b from-cyan-400 to-indigo-500'
                  : 'bg-gradient-to-b from-indigo-500 to-emerald-400'
              }`}
            />

            <div className="flex items-start gap-3 pl-1">
              {/* Avatar / Icon */}
              <div className="relative shrink-0 mt-0.5">
                <Avatar
                  name={toast.sender?.name || 'Developer'}
                  avatarUrl={toast.sender?.avatarUrl}
                  size="sm"
                />
                <div
                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border border-[#0c1222] ${
                    isDirect ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                  }`}
                >
                  {isDirect ? (
                    <MessageSquare className="w-2.5 h-2.5" />
                  ) : (
                    <Hash className="w-2.5 h-2.5" />
                  )}
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                    {toast.sender?.name || 'Team Member'}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300 border border-white/10 shrink-0">
                    {project ? `${project.name} • ${channelLabel}` : channelLabel}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed break-words">
                  {toast.message}
                </p>

                {/* Bottom Quick-Action Link */}
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={handleAction}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer group/btn"
                  >
                    <span>View message</span>
                    <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono">Just now</span>
                </div>
              </div>

              {/* Dismiss Button */}
              <button
                onClick={() => dismissToast(toast.id)}
                className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Dismiss"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
