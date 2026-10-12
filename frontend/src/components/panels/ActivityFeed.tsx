'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import {
  GitCommit,
  GitPullRequest,
  CheckCircle2,
  Bug as BugIcon,
  MessageSquare,
  FileText,
  Clock,
  GitMerge,
  UserPlus,
  Code2,
  ArrowRightLeft,
  Filter,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

export function ActivityFeed() {
  const { activity } = useAppStore();
  const [filter, setFilter] = useState<'ALL' | 'TASKS' | 'BUGS' | 'FILES' | 'GIT'>('ALL');

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'COMMIT':
        return <GitCommit className="w-3.5 h-3.5 text-cyan-400" />;
      case 'PR_OPEN':
        return <GitPullRequest className="w-3.5 h-3.5 text-emerald-400" />;
      case 'PR_COMMENT':
        return <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />;
      case 'PR_MERGE':
        return <GitMerge className="w-3.5 h-3.5 text-purple-400" />;
      case 'TASK_CREATED':
      case 'TASK_UPDATED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />;
      case 'BUG_REPORTED':
      case 'BUG_STATUS_CHANGED':
        return <BugIcon className="w-3.5 h-3.5 text-rose-400" />;
      case 'BUG_RESOLVED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'FILE_UPLOADED':
        return <FileText className="w-3.5 h-3.5 text-amber-400" />;
      case 'MEMBER_JOINED':
        return <UserPlus className="w-3.5 h-3.5 text-teal-400" />;
      case 'MESSAGE_CONVERTED':
        return <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />;
      case 'CODE_SHARED':
        return <Code2 className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const filteredActivity = activity.filter((item) => {
    const actType = item.actionType || item.eventType || '';
    if (filter === 'ALL') return true;
    if (filter === 'TASKS') return actType.includes('TASK');
    if (filter === 'BUGS') return actType.includes('BUG');
    if (filter === 'FILES') return actType.includes('FILE');
    if (filter === 'GIT') return ['COMMIT', 'PR_OPEN', 'PR_COMMENT', 'PR_MERGE'].includes(actType);
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Project Activity Feed
          </h4>
          <span className="text-[10px] text-slate-500 font-mono">
            Chronological Developer Timeline
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono">
          {activity.length} Events
        </span>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
        {(['ALL', 'TASKS', 'BUGS', 'FILES', 'GIT'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              filter === cat
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Timeline List */}
      {filteredActivity.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-500">
          No activity recorded yet for this filter.
        </div>
      ) : (
        <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-white/10 max-h-[500px] overflow-y-auto pr-1">
          {filteredActivity.map((item) => {
            const eventKey = item.actionType || item.eventType || 'EVENT';
            const actorName = item.userName || item.user?.name;
            const actorAvatar = item.userAvatar || item.user?.avatarUrl;

            return (
              <div key={item.id} className="relative group">
                {/* Timeline node icon */}
                <div className="absolute -left-4 top-1 w-5 h-5 rounded-full bg-[#0b0f19] border border-white/20 flex items-center justify-center -translate-x-1/2 shadow-sm group-hover:scale-110 group-hover:border-indigo-500/50 transition-all">
                  {getEventIcon(eventKey)}
                </div>

                <div className="pl-3">
                  <div className="flex items-start justify-between text-[11px] gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {actorName && (
                        <div className="flex items-center gap-1">
                          <Avatar name={actorName} avatarUrl={actorAvatar} size="xs" />
                          <span className="font-semibold text-slate-300">{actorName}</span>
                        </div>
                      )}
                      <span className="font-medium text-slate-200 group-hover:text-white transition-colors">
                        {item.title}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {item.timestamp || (item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently')}
                    </span>
                  </div>

                  {item.details && (
                    <p className="text-[11px] text-slate-400 mt-1 font-sans leading-relaxed whitespace-pre-line bg-white/[0.02] p-2 rounded-lg border border-white/5">
                      {item.details}
                    </p>
                  )}

                  {item.refName && (
                    <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-indigo-400">
                      <span className="px-1.5 py-0.2 rounded bg-indigo-950/40 border border-indigo-800/40">
                        {item.refName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
