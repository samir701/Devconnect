'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Bug as BugIcon, X, Terminal, AlertCircle } from 'lucide-react';
import { PriorityLevel, BugStatus } from '@/lib/types';

export function CreateBugModal() {
  const {
    isCreateBugOpen,
    setIsCreateBugOpen,
    createBug,
    prefillBug,
    users,
    currentUser,
    sendMessage,
    activeProjectId,
  } = useAppStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [endpoint, setEndpoint] = useState('/api/endpoint');
  const [priority, setPriority] = useState<PriorityLevel>('HIGH');
  const [assignedTo, setAssignedTo] = useState(currentUser?.id || '');
  const [alsoSendInChat, setAlsoSendInChat] = useState(true);

  useEffect(() => {
    if (currentUser?.id && !assignedTo) {
      setAssignedTo(currentUser.id);
    } else if (!assignedTo && users.length > 0) {
      setAssignedTo(users[0].id);
    }
  }, [currentUser, users, assignedTo]);

  useEffect(() => {
    if (prefillBug) {
      setTitle(prefillBug.title || '');
      setDescription(prefillBug.description || '');
      if (prefillBug.endpoint) setEndpoint(prefillBug.endpoint);
      if (prefillBug.priority) setPriority(prefillBug.priority);
      if (prefillBug.assignedTo) setAssignedTo(prefillBug.assignedTo);
    } else {
      setTitle('');
      setDescription('');
      if (currentUser?.id) setAssignedTo(currentUser.id);
    }
  }, [prefillBug, isCreateBugOpen, currentUser]);

  if (!isCreateBugOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const bugPayload = {
      title,
      description,
      endpoint,
      priority,
      status: 'OPEN' as BugStatus,
      assignedTo,
    };

    const createdBug = await createBug(bugPayload);
    if (alsoSendInChat) {
      const bugId = createdBug?.id || `bug_${Date.now()}`;
      await sendMessage({
        content: `🐛 **[BUG]** ${title}\n${description || ''}`,
        messageType: 'BUG',
        metadata: JSON.stringify({
          bugId,
          title,
          description,
          endpoint,
          priority,
          status: 'OPEN',
          assignedTo,
        }),
        bugData: createdBug || ({ ...bugPayload, id: bugId } as any),
      });
    }
    setIsCreateBugOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[#0e1320] shadow-2xl p-6 relative">
        <button
          onClick={() => setIsCreateBugOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
            <BugIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Report New Bug</h3>
            <p className="text-xs text-slate-400">
              Creates a structured bug report with developer context
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Bug Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Login API returning 401"
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 outline-none focus:border-rose-500/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Affected Endpoint / API
              </label>
              <div className="relative">
                <Terminal className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="/api/..."
                  className="w-full text-xs font-mono pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-cyan-300 placeholder-slate-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full text-xs bg-[#090d16] border border-white/10 rounded-xl px-3 py-2 text-white outline-none"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
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
              Description & Reproduction Steps
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain how to trigger the issue or paste relevant error traces..."
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 outline-none focus:border-rose-500/40"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="sendInChat"
              checked={alsoSendInChat}
              onChange={(e) => setAlsoSendInChat(e.target.checked)}
              className="rounded bg-white/10 border-white/20 text-rose-500"
            />
            <label htmlFor="sendInChat" className="text-xs text-slate-300 cursor-pointer">
              Post interactive Bug card directly in conversation stream
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsCreateBugOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
            >
              Create Bug
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
