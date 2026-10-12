'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import {
  Search,
  X,
  MessageSquare,
  CheckSquare,
  Bug as BugIcon,
  FileText,
  User as UserIcon,
  ArrowRight,
} from 'lucide-react';
import { Message, Task, Bug, Attachment, User } from '@/lib/types';

export function GlobalSearchModal() {
  const { isSearchOpen, setIsSearchOpen, activeProjectId } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    messages: Message[];
    tasks: Task[];
    bugs: Bug[];
    files: Attachment[];
    users: User[];
  }>({
    messages: [],
    tasks: [],
    bugs: [],
    files: [],
    users: [],
  });
  const [loading, setLoading] = useState(false);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(!isSearchOpen);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ messages: [], tasks: [], bugs: [], files: [], users: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isSearchOpen) return null;

  const totalResults =
    results.messages.length +
    results.tasks.length +
    results.bugs.length +
    results.files.length +
    results.users.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0e1320] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages, tasks, bugs, code, files, team members..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-500 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] text-slate-500 font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10">
            ESC
          </kbd>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {query && (
            <div className="text-xs text-slate-400 font-medium">
              Found {totalResults} result{totalResults !== 1 ? 's' : ''} for &quot;{query}&quot;
            </div>
          )}

          {/* Messages */}
          {results.messages.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-indigo-400" />
                <span>Messages ({results.messages.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.messages.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setIsSearchOpen(false)}
                    className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 cursor-pointer text-xs"
                  >
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="font-semibold text-slate-200">
                        {m.sender?.name || 'Developer'}
                      </span>
                      <span className="text-[10px] font-mono">{m.channel || 'general'}</span>
                    </div>
                    <p className="text-slate-300 line-clamp-2">{m.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks */}
          {results.tasks.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <CheckSquare className="w-3 h-3 text-blue-400" />
                <span>Tasks ({results.tasks.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setIsSearchOpen(false)}
                    className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 cursor-pointer text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-white">{t.title}</span>
                      <span className="text-[10px] text-slate-500 block">
                        Status: {t.status} • Priority: {t.priority}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bugs */}
          {results.bugs.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <BugIcon className="w-3 h-3 text-rose-400" />
                <span>Bugs ({results.bugs.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.bugs.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setIsSearchOpen(false)}
                    className="p-2.5 rounded-xl bg-rose-950/20 hover:bg-rose-950/30 border border-rose-500/20 cursor-pointer text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-white">{b.title}</span>
                      <span className="text-[10px] text-rose-300 block">
                        {b.endpoint || 'General'} • Status: {b.status}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {results.files.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-cyan-400" />
                <span>Files in Backblaze B2 ({results.files.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.files.map((f) => (
                  <div
                    key={f.id}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs flex items-center justify-between"
                  >
                    <span className="font-mono text-cyan-300">{f.fileName}</span>
                    <span className="text-[10px] text-slate-500">
                      {(f.fileSize / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Users */}
          {results.users.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <UserIcon className="w-3 h-3 text-emerald-400" />
                <span>Team Members ({results.users.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.users.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => setIsSearchOpen(false)}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-white">{u.name}</span>
                      <span className="text-[10px] text-slate-400 block">{u.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {u.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!query && (
            <div className="text-center py-12 text-slate-500 text-xs">
              Type keywords like <span className="text-indigo-400 font-mono">&quot;authentication&quot;</span>,{' '}
              <span className="text-indigo-400 font-mono">&quot;401&quot;</span>, or team member names to search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
