'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Message, PriorityLevel, TaskStatus, BugStatus, ConvertMessageRequest } from '@/lib/types';
import { CheckSquare, Bug as BugIcon, X, Calendar, Globe, User, ArrowRight, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

interface ConvertMessageModalProps {
  message?: Message | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ConvertMessageModal({ message, isOpen, onClose }: ConvertMessageModalProps) {
  const { users, currentUser, convertMessage, activeProjectId } = useAppStore();

  const [convertType, setConvertType] = useState<'TASK' | 'BUG'>('TASK');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('MEDIUM');
  const [assignedTo, setAssignedTo] = useState('user_samir');
  const [dueDate, setDueDate] = useState('Today');
  const [endpoint, setEndpoint] = useState('/api/v1/...');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (message) {
      const rawContent = message.content || '';
      const firstLine = rawContent.split('\n')[0].replace(/^[#*\s-]+/, '').trim();
      const cleanTitle = firstLine.length > 80 ? `${firstLine.substring(0, 77)}...` : firstLine || 'Item from chat';

      setTitle(cleanTitle);
      setDescription(rawContent);

      // Heuristic: If message mentions 'bug', 'error', 'fail', 'crash', default to BUG
      if (/bug|error|fail|crash|exception|401|404|500/i.test(rawContent)) {
        setConvertType('BUG');
        setPriority('HIGH');
      } else {
        setConvertType('TASK');
        setPriority('MEDIUM');
      }

      setAssignedTo(currentUser?.id || 'user_samir');
    }
  }, [message, isOpen, currentUser]);

  if (!isOpen || !message) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payload: ConvertMessageRequest = {
        type: convertType,
        title: title.trim(),
        description: description.trim(),
        priority,
        assignedTo,
        status: convertType === 'TASK' ? ('TODO' as TaskStatus) : ('OPEN' as BugStatus),
        ...(convertType === 'TASK' ? { dueDate } : { endpoint }),
      };

      await convertMessage(message.id, payload);
      onClose();
    } catch (err) {
      console.error('Conversion failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0c101b] shadow-2xl p-6 relative overflow-hidden">
        {/* Decorative ambient gradient */}
        <div
          className={`absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
            convertType === 'BUG' ? 'bg-rose-500/15' : 'bg-indigo-500/15'
          }`}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
              convertType === 'BUG'
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
            }`}
          >
            {convertType === 'BUG' ? <BugIcon className="w-5 h-5" /> : <CheckSquare className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Convert Message to Workflow</h3>
            <p className="text-xs text-slate-400">
              Transform chat discussion directly into an engineering tracked item
            </p>
          </div>
        </div>

        {/* Original Message Quote Box */}
        <div className="p-3 mb-4 rounded-xl bg-white/[0.03] border border-white/5 text-xs">
          <div className="flex items-center gap-2 mb-1.5 text-slate-400">
            <Avatar name={message.sender?.name || 'Developer'} avatarUrl={message.sender?.avatarUrl} size="sm" />
            <span className="font-semibold text-slate-300">{message.sender?.name || 'Developer'}</span>
            <span className="text-[10px] text-slate-500 font-mono">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-slate-300 italic line-clamp-2 pl-2 border-l-2 border-white/10">
            &ldquo;{message.content}&rdquo;
          </p>
        </div>

        {/* Segmented Type Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl mb-4 border border-white/5">
          <button
            type="button"
            onClick={() => setConvertType('TASK')}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              convertType === 'TASK'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Developer Task</span>
          </button>

          <button
            type="button"
            onClick={() => setConvertType('BUG')}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              convertType === 'BUG'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BugIcon className="w-3.5 h-3.5" />
            <span>Bug Report</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summary of the task or bug"
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 outline-none focus:border-indigo-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional engineering context or repro steps"
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 resize-none font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full text-xs bg-[#111728] border border-white/10 rounded-xl px-3 py-2 text-white outline-none cursor-pointer focus:border-indigo-500/50"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Assignee
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full text-xs bg-[#111728] border border-white/10 rounded-xl px-3 py-2 text-white outline-none cursor-pointer focus:border-indigo-500/50"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.id === currentUser?.id ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {convertType === 'TASK' ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Due Date</span>
              </label>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="e.g. Today, Tomorrow, Friday, or YYYY-MM-DD"
                className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-indigo-500/50"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>Endpoint / Route</span>
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="e.g. /api/auth/login or /api/projects"
                className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-mono text-cyan-300 placeholder-slate-500 outline-none focus:border-rose-500/50"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50 ${
                convertType === 'BUG'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
              }`}
            >
              <span>{isSubmitting ? 'Converting...' : `Convert to ${convertType === 'TASK' ? 'Task' : 'Bug'}`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
