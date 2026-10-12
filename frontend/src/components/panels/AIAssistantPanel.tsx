'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Sparkles, Send, ShieldCheck, RefreshCw, Bot, User } from 'lucide-react';

const SUGGESTIONS = [
  "Summarize today's development discussion",
  "What changed in authentication this week?",
  "List active open bugs and blockers",
  "Show project task completion progress",
];

export function AIAssistantPanel() {
  const { aiMessages, isAiLoading, askAi, activeProject } = useAppStore();
  const [prompt, setPrompt] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages.length, isAiLoading]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isAiLoading) return;
    askAi(prompt);
    setPrompt('');
  };

  const handleChipClick = (text: string) => {
    askAi(text);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-white/10 bg-gradient-to-r from-purple-950/20 to-indigo-950/20 rounded-xl mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">Project-Aware AI</h4>
            <span className="text-[10px] text-purple-300 font-mono">
              Scoped to {activeProject?.name || 'Workspace'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-800/30 font-mono">
          <ShieldCheck className="w-3 h-3" />
          <span>RBAC Guard</span>
        </div>
      </div>

      {/* Suggested chips */}
      <div className="mb-3 space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Suggested Queries
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(s)}
              disabled={isAiLoading}
              className="text-[11px] text-left px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Messages stream */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[220px]">
        {aiMessages.map((m, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl border text-xs leading-relaxed ${
              m.role === 'user'
                ? 'bg-indigo-600/15 border-indigo-500/30 text-white ml-4'
                : 'bg-white/[0.03] border-white/10 text-slate-300 mr-2'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              {m.role === 'user' ? (
                <>
                  <User className="w-3 h-3 text-indigo-400" />
                  <span>You</span>
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-purple-400" />
                  <span>ZettaDev AI</span>
                </>
              )}
            </div>

            <div className="whitespace-pre-line font-sans">{m.text}</div>
          </div>
        ))}

        {isAiLoading && (
          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-300 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Analyzing project commits, tasks & bugs in TiDB...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* AI Prompt Input */}
      <form onSubmit={handleSubmit} className="mt-3 pt-2 border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything about this project..."
          disabled={isAiLoading}
          className="flex-1 text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-purple-500/40"
        />
        <button
          type="submit"
          disabled={!prompt.trim() || isAiLoading}
          className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition-colors cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
