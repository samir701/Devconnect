'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { MessageItem } from './MessageItem';
import { MessageComposer } from './MessageComposer';
import { Avatar } from '@/components/ui/Avatar';
import { Message } from '@/lib/types';
import {
  Hash,
  Users,
  Search,
  PanelRight,
  Menu,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  Radio,
} from 'lucide-react';
import { GithubIcon } from '@/components/ui/Icons';
import { NotificationBell } from '@/components/ui/NotificationBell';

export function ChatArea() {
  const {
    activeProject,
    activeChannel,
    activeConversation,
    messages,
    members,
    typingUsers,
    isSocketConnected,
    isRightPanelOpen,
    setIsRightPanelOpen,
    setIsMobileSidebarOpen,
    setActiveRightTab,
    setIsSearchOpen,
    setIsStatusOpen,
  } = useAppStore();

  const [searchFilter, setSearchFilter] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom smoothly when messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const filteredMessages = messages.filter((m) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      m.content.toLowerCase().includes(q) ||
      (m.sender?.name && m.sender.name.toLowerCase().includes(q))
    );
  });

  // Helper: Format date for date dividers
  const formatDateDivider = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return 'Today';
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d16] overflow-hidden">
      {/* Top Conversation Header */}
      <div className="h-14 border-b border-white/10 px-4 flex items-center justify-between bg-[#0b0f19]/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile hamburger menu */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {activeConversation ? (
            /* Direct Conversation Header */
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar
                name={activeConversation.otherUser?.name || 'Developer'}
                avatarUrl={activeConversation.otherUser?.avatarUrl}
                status={activeConversation.otherUser?.status}
                size="sm"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-white truncate">
                    {activeConversation.otherUser?.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Direct
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {activeConversation.otherUser?.headline || activeConversation.otherUser?.title || 'Active Collaborator'}
                </p>
              </div>
            </div>
          ) : (
            /* Project Channel Header */
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Hash className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm text-white truncate">
                {activeChannel}
              </span>

              {activeProject && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-slate-400 truncate hidden sm:inline">
                    {activeProject.name}
                  </span>

                  {activeProject.githubRepo && (
                    <a
                      href={`https://github.com/${activeProject.githubRepo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden md:flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/10 transition-colors"
                      title="GitHub Repository"
                    >
                      <GithubIcon className="w-3 h-3 text-slate-300" />
                      <span>{activeProject.githubRepo}</span>
                    </a>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Header Utilities */}
        <div className="flex items-center gap-2">
          {/* Live Socket Status Pill */}
          <div
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-medium transition-colors ${
              isSocketConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            <Radio className={`w-2.5 h-2.5 ${isSocketConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <span>{isSocketConnected ? 'Realtime Connected' : 'Connecting...'}</span>
          </div>

          {/* Filter in chat */}
          <div className="relative hidden lg:block">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Filter messages..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-200 placeholder-slate-500 outline-none w-36 focus:w-48 transition-all"
            />
          </div>

          {/* Members count */}
          {!activeConversation && (
            <button
              onClick={() => {
                setActiveRightTab('info');
                setIsRightPanelOpen(true);
              }}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{members.length} members</span>
            </button>
          )}

          {/* AI Shortcut */}
          <button
            onClick={() => {
              setActiveRightTab('ai');
              setIsRightPanelOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-purple-300 hover:text-white bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 rounded-lg transition-all cursor-pointer"
            title="AI Project Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>

          {/* Phase 6 Notification Bell */}
          <NotificationBell />

          {/* Toggle Right Panel */}
          <button
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isRightPanelOpen
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                : 'text-slate-400 hover:text-white bg-white/5 border-white/10'
            }`}
            title="Toggle Project Information Panel"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {/* Welcome / Channel Banner */}
        <div className="px-4 py-6 mb-4 rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 text-center">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-2">
            <Hash className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-white">
            {activeConversation
              ? `Direct Chat with ${activeConversation.otherUser?.name}`
              : `Welcome to #${activeChannel}`}
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            {activeConversation
              ? `End-to-end developer workspace communication with ${activeConversation.otherUser?.name}. Share code, logs, and collaborate seamlessly.`
              : `This is the start of the #${activeChannel} discussions in ${activeProject?.name || 'Devconnect'}. Developer context, tasks, and bugs stay connected here.`}
          </p>
        </div>

        {/* Message Items with Date Dividers & Consecutive Sender Grouping */}
        {filteredMessages.map((msg, index) => {
          const prevMsg = filteredMessages[index - 1];

          // Date divider calculation
          const msgDate = new Date(msg.createdAt).toDateString();
          const prevDate = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
          const showDateDivider = msgDate !== prevDate;

          // Group consecutive messages by same sender within 5 minutes
          const isSameSender = prevMsg && prevMsg.senderId === msg.senderId;
          const isWithin5Minutes =
            prevMsg &&
            Math.abs(new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) <
              5 * 60 * 1000;
          const isConsecutive = isSameSender && isWithin5Minutes && !showDateDivider;

          return (
            <React.Fragment key={msg.id}>
              {showDateDivider && (
                <div className="flex items-center my-4 px-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {formatDateDivider(msg.createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              )}

              <MessageItem
                message={msg}
                onReplySelect={(m) => setReplyingTo(m)}
                isConsecutive={isConsecutive}
              />
            </React.Fragment>
          );
        })}

        {/* Live Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-2 flex items-center gap-2 text-xs text-slate-400 italic animate-in fade-in">
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
            </span>
            <span>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer Area */}
      <MessageComposer
        replyingTo={replyingTo}
        onClearReply={() => setReplyingTo(null)}
      />
    </div>
  );
}
