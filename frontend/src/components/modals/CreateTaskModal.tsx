'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { CheckSquare, X, Calendar } from 'lucide-react';
import { PriorityLevel, TaskStatus } from '@/lib/types';

export function CreateTaskModal() {
  const {
    isCreateTaskOpen,
    setIsCreateTaskOpen,
    createTask,
    prefillTask,
    users,
    sendMessage,
    currentUser,
  } = useAppStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('HIGH');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [assignedTo, setAssignedTo] = useState(currentUser?.id || '');
  const [dueDate, setDueDate] = useState('Today');
  const [alsoSendInChat, setAlsoSendInChat] = useState(true);

  useEffect(() => {
    if (currentUser?.id && !assignedTo) {
      setAssignedTo(currentUser.id);
    } else if (!assignedTo && users.length > 0) {
      setAssignedTo(users[0].id);
    }
  }, [currentUser, users, assignedTo]);

  useEffect(() => {
    if (prefillTask) {
      setTitle(prefillTask.title || '');
      setDescription(prefillTask.description || '');
      if (prefillTask.priority) setPriority(prefillTask.priority);
      if (prefillTask.status) setStatus(prefillTask.status);
      if (prefillTask.dueDate) setDueDate(prefillTask.dueDate);
      if (prefillTask.assignedTo) setAssignedTo(prefillTask.assignedTo);
    } else {
      setTitle('');
      setDescription('');
      setStatus('TODO');
      if (currentUser?.id) setAssignedTo(currentUser.id);
    }
  }, [prefillTask, isCreateTaskOpen, currentUser]);

  if (!isCreateTaskOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const taskPayload = {
      title,
      description,
      priority,
      status,
      assignedTo,
      dueDate,
    };

    const createdTask = await createTask(taskPayload);
    if (alsoSendInChat) {
      const taskId = createdTask?.id || `task_${Date.now()}`;
      await sendMessage({
        content: `📋 **[TASK]** ${title}\n${description || ''}`,
        messageType: 'TASK',
        metadata: JSON.stringify({
          taskId,
          title,
          description,
          priority,
          status,
          assignedTo,
          dueDate,
        }),
        taskData: createdTask || ({ ...taskPayload, id: taskId } as any),
      });
    }
    setIsCreateTaskOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-indigo-500/30 bg-[#0e1320] shadow-2xl p-6 relative">
        <button
          onClick={() => setIsCreateTaskOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Create Developer Task</h3>
            <p className="text-xs text-slate-400">
              Lightweight task tracking connected directly to project context
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Task Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fix authentication API"
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 outline-none focus:border-indigo-500/40"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full text-xs bg-[#090d16] border border-white/10 rounded-xl px-2.5 py-2 text-white outline-none"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full text-xs bg-[#090d16] border border-white/10 rounded-xl px-2.5 py-2 text-white outline-none cursor-pointer"
              >
                <option value="TODO">TODO</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="REVIEW">REVIEW</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Due Date
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="Today"
                  className="w-full text-xs pl-7 pr-2.5 py-2 bg-white/5 border border-white/10 rounded-xl text-white outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Assignee
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full text-xs bg-[#090d16] border border-white/10 rounded-xl px-3 py-2 text-white outline-none"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.title.split('•')[0]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task specifications or acceptance criteria..."
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/40"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="sendTaskInChat"
              checked={alsoSendInChat}
              onChange={(e) => setAlsoSendInChat(e.target.checked)}
              className="rounded bg-white/10 border-white/20 text-indigo-500"
            />
            <label htmlFor="sendTaskInChat" className="text-xs text-slate-300 cursor-pointer">
              Post interactive Task card into conversation stream
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsCreateTaskOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
