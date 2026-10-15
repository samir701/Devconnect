'use client';

import React from 'react';
import { Bug, BugStatus } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Bug as BugIcon, ChevronRight, User, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface BugCardProps {
  bug: Bug;
}

const BUG_STATUSES: BugStatus[] = ['OPEN', 'INVESTIGATING', 'IN_PROGRESS', 'FIXED', 'CLOSED'];

export function BugCard({ bug }: BugCardProps) {
  const { updateBugStatus, setActiveRightTab, setIsRightPanelOpen, users, members } = useAppStore();

  const assignedUser =
    (bug.assignedTo && bug.assigneeUser?.id === bug.assignedTo ? bug.assigneeUser : null) ||
    (bug.assignedTo && bug.assignee?.id === bug.assignedTo ? bug.assignee : null) ||
    users.find((u) => u.id === bug.assignedTo) ||
    members.find((m) => m.userId === bug.assignedTo)?.user ||
    bug.assigneeUser ||
    bug.assignee;

  const assigneeDisplayName = assignedUser?.name || (bug.assignedTo ? 'Assigned' : 'Unassigned');

  const handleStatusChange = (newStatus: BugStatus) => {
    updateBugStatus(bug.id, newStatus);
  };

  const handleOpenDetails = () => {
    setActiveRightTab('bugs');
    setIsRightPanelOpen(true);
  };

  return (
    <div className="my-2 p-4 rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-950/20 via-[#0d121f] to-[#090d16] shadow-md transition-all hover:border-rose-500/35">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <BugIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
              Bug Report
            </div>
            <h4 className="text-sm font-semibold text-white tracking-tight">{bug.title}</h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="priority" value={bug.priority}>
            {bug.priority}
          </Badge>
          <Badge variant="bug-status" value={bug.status}>
            {bug.status}
          </Badge>
        </div>
      </div>

      {/* Description */}
      {bug.description && (
        <p className="text-xs text-slate-300 mb-3 bg-black/20 p-2.5 rounded-lg border border-white/5 font-sans leading-relaxed">
          {bug.description}
        </p>
      )}

      {/* Details Row */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5 gap-2">
        <div className="flex items-center gap-4">
          {bug.endpoint && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
              <span>Endpoint:</span>
              <span className="font-semibold">{bug.endpoint}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <User className="w-3 h-3 text-slate-500" />
            <span>Assigned:</span>
            <span className="text-slate-200 font-medium">
              {assigneeDisplayName}
            </span>
          </div>
        </div>

        {/* Workflow Action */}
        <div className="flex items-center gap-2">
          <select
            value={bug.status}
            onChange={(e) => handleStatusChange(e.target.value as BugStatus)}
            className="text-[11px] bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-md px-2 py-1 outline-none cursor-pointer"
          >
            {BUG_STATUSES.map((st) => (
              <option key={st} value={st} className="bg-slate-900 text-white">
                {st}
              </option>
            ))}
          </select>

          <button
            onClick={handleOpenDetails}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-2.5 py-1 rounded-md transition-all"
          >
            <span>Open Bug</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
