'use client';

import React from 'react';
import { Task, TaskStatus } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { CheckSquare, Square, Calendar, User, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface TaskCardProps {
  task: Task;
}

const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];

export function TaskCard({ task }: TaskCardProps) {
  const { updateTaskStatus, setActiveRightTab, setIsRightPanelOpen } = useAppStore();
  const [currentStatus, setCurrentStatus] = React.useState<TaskStatus>(task.status);

  React.useEffect(() => {
    setCurrentStatus(task.status);
  }, [task.status]);

  const isCompleted = currentStatus === 'COMPLETED';

  const handleToggleComplete = () => {
    const nextStatus: TaskStatus = isCompleted ? 'IN_PROGRESS' : 'COMPLETED';
    setCurrentStatus(nextStatus);
    updateTaskStatus(task.id, nextStatus);
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    setCurrentStatus(newStatus);
    updateTaskStatus(task.id, newStatus);
  };

  return (
    <div
      className={`my-2 p-3.5 rounded-xl border transition-all ${
        isCompleted
          ? 'border-emerald-500/20 bg-emerald-950/10'
          : 'border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 via-[#0d121f] to-[#090d16]'
      } hover:border-indigo-500/35 shadow-md`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2.5">
          <button
            onClick={handleToggleComplete}
            className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors"
            title={isCompleted ? 'Mark Incomplete' : 'Mark Completed'}
          >
            {isCompleted ? (
              <CheckSquare className="w-4 h-4 text-emerald-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-500 hover:text-indigo-400" />
            )}
          </button>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
              <span>Task</span>
              {isCompleted && (
                <span className="text-emerald-400 flex items-center gap-0.5 text-[9px]">
                  <CheckCircle2 className="w-3 h-3" /> Done
                </span>
              )}
            </div>
            <h4
              className={`text-sm font-medium ${
                isCompleted ? 'line-through text-slate-400' : 'text-white'
              }`}
            >
              {task.title}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="priority" value={task.priority}>
            {task.priority}
          </Badge>
          <Badge variant="task-status" value={currentStatus}>
            {currentStatus.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-slate-300 ml-6 mb-2.5 font-sans leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Footer Info */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 ml-6 pt-2 border-t border-white/5 gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <User className="w-3 h-3 text-slate-500" />
            <span>{task.assigneeUser?.name || 'Samir'}</span>
          </div>

          {task.dueDate && (
            <div className="flex items-center gap-1 text-[11px] text-amber-300/80 bg-amber-950/30 px-1.5 py-0.5 rounded">
              <Calendar className="w-3 h-3" />
              <span>Due: {task.dueDate}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={currentStatus}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            className="text-[11px] bg-slate-900 text-white font-medium border border-indigo-500/40 rounded-md px-2 py-0.5 outline-none cursor-pointer hover:border-indigo-400 focus:ring-1 focus:ring-indigo-500 transition-colors"
          >
            {TASK_STATUSES.map((st) => (
              <option key={st} value={st} className="bg-slate-900 text-white">
                {st.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
