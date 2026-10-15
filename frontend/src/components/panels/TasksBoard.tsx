'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/Badge';
import { TaskStatus } from '@/lib/types';
import { Plus, CheckSquare, Square, Calendar, User, CheckCircle2 } from 'lucide-react';

export function TasksBoard() {
  const { tasks, updateTaskStatus, setIsCreateTaskOpen, users, members } = useAppStore();
  const [filter, setFilter] = useState<'ALL' | TaskStatus>('ALL');

  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const filtered = tasks.filter((t) => (filter === 'ALL' ? true : t.status === filter));

  return (
    <div className="space-y-3">
      {/* Top Header & Progress */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tasks Tracker
          </h4>
          <span className="text-[11px] text-slate-400">
            {completedCount} of {tasks.length} completed ({progressPercent}%)
          </span>
        </div>

        <button
          onClick={() => setIsCreateTaskOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
        <div
          className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
        {(['ALL', 'TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors ${
              filter === st
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
        {filtered.map((task) => {
          const isDone = task.status === 'COMPLETED';
          return (
            <div
              key={task.id}
              className={`p-3 rounded-xl border transition-all ${
                isDone
                  ? 'bg-emerald-950/10 border-emerald-500/20'
                  : 'bg-white/[0.02] border-white/10 hover:border-indigo-500/30'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    updateTaskStatus(task.id, isDone ? 'IN_PROGRESS' : 'COMPLETED')
                  }
                  className="mt-0.5 text-slate-500 hover:text-emerald-400 cursor-pointer transition-colors"
                  title={isDone ? 'Mark Incomplete' : 'Mark Completed'}
                >
                  {isDone ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 hover:text-indigo-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-xs font-medium leading-snug ${
                        isDone ? 'line-through text-slate-500' : 'text-slate-200'
                      }`}
                    >
                      {task.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="priority" value={task.priority} size="sm">
                        {task.priority}
                      </Badge>
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                        className="text-[10px] bg-slate-900 text-white font-medium border border-indigo-500/30 rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-indigo-400 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      >
                        <option value="TODO" className="bg-slate-900 text-white">TODO</option>
                        <option value="IN_PROGRESS" className="bg-slate-900 text-white">IN PROGRESS</option>
                        <option value="REVIEW" className="bg-slate-900 text-white">REVIEW</option>
                        <option value="COMPLETED" className="bg-slate-900 text-white">COMPLETED</option>
                      </select>
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  {(() => {
                    const assignedUser =
                      (task.assignedTo && task.assigneeUser?.id === task.assignedTo ? task.assigneeUser : null) ||
                      (task.assignedTo && task.assignee?.id === task.assignedTo ? task.assignee : null) ||
                      users.find((u) => u.id === task.assignedTo) ||
                      members.find((m) => m.userId === task.assignedTo)?.user ||
                      task.assigneeUser ||
                      task.assignee;
                    const assigneeName = assignedUser?.name || (task.assignedTo ? 'Assigned' : 'Unassigned');

                    return (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-white/5">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-300 font-medium">{assigneeName}</span>
                        </span>

                        {task.dueDate && (
                          <span className="flex items-center gap-1 text-amber-400/80">
                            <Calendar className="w-3 h-3" />
                            {task.dueDate}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-6 text-slate-500 text-xs">
            No tasks in this category
          </div>
        )}
      </div>
    </div>
  );
}
