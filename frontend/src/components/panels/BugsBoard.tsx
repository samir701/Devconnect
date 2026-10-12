'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/Badge';
import { BugStatus } from '@/lib/types';
import { Plus, Bug as BugIcon, User, Terminal } from 'lucide-react';

const STATUS_OPTIONS: BugStatus[] = ['OPEN', 'INVESTIGATING', 'IN_PROGRESS', 'FIXED', 'CLOSED'];

export function BugsBoard() {
  const { bugs, updateBugStatus, setIsCreateBugOpen } = useAppStore();
  const [filter, setFilter] = useState<'ALL' | BugStatus>('ALL');

  const openCount = bugs.filter((b) => b.status !== 'FIXED' && b.status !== 'CLOSED').length;
  const filtered = bugs.filter((b) => (filter === 'ALL' ? true : b.status === filter));

  return (
    <div className="space-y-3">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-400">
            Bug Reports
          </h4>
          <span className="text-[11px] text-slate-400">
            {openCount} active open issue{openCount !== 1 ? 's' : ''}
          </span>
        </div>

        <button
          onClick={() => setIsCreateBugOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Report Bug</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
        {(['ALL', ...STATUS_OPTIONS] as const).map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors ${
              filter === st
                ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Bugs List */}
      <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
        {filtered.map((bug) => (
          <div
            key={bug.id}
            className="p-3 rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-950/20 via-[#0d121f] to-[#090d16] hover:border-rose-500/40 transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <BugIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="text-xs font-semibold text-white truncate">
                  {bug.title}
                </span>
              </div>
              <Badge variant="priority" value={bug.priority} size="sm">
                {bug.priority}
              </Badge>
            </div>

            {bug.description && (
              <p className="text-[11px] text-slate-300 mb-2 font-sans line-clamp-2">
                {bug.description}
              </p>
            )}

            {bug.endpoint && (
              <div className="flex items-center gap-1 font-mono text-[10px] text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 mb-2 w-fit">
                <Terminal className="w-3 h-3 text-cyan-400" />
                <span>{bug.endpoint}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
              <span className="flex items-center gap-1 text-[10px]">
                <User className="w-3 h-3" />
                {bug.assigneeUser?.name || 'Unassigned'}
              </span>

              <select
                value={bug.status}
                onChange={(e) => updateBugStatus(bug.id, e.target.value as BugStatus)}
                className="text-[11px] bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-md px-2 py-0.5 outline-none cursor-pointer"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-slate-900 text-white">
                    {opt.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-6 text-slate-500 text-xs">
            No bugs found in this status
          </div>
        )}
      </div>
    </div>
  );
}
