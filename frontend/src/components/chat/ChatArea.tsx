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
  Phone,
  Video,
  PhoneCall,
} from 'lucide-react';
import { GithubIcon } from '@/components/ui/Icons';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useCallStore } from '@/lib/callContext';

export function ChatArea() {
  const {
    activeProject,
    activeChannel,
    activeConversation,
    messages,
    members,
    typingUsers,
    isSocketConnected,
    isAutoSyncActive,
    lastSyncedAt,
    isRightPanelOpen,
    setIsRightPanelOpen,
    setIsMobileSidebarOpen,
    setActiveRightTab,
    setIsSearchOpen,
    setIsStatusOpen,
  } = useAppStore();

  const {
    startDirectCall,
    joinGroupCall,
    activeGroupCalls,
    callStatus,
  } = useCallStore();

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

  // Helper: Format date for date dividers deterministically
  const formatDateDivider = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      ) {
        return 'Today';
      }
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (
        d.getFullYear() === yesterday.getFullYear() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getDate() === yesterday.getDate()
      ) {
        return 'Yesterday';
      }
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d16] overflow-hidden">
      {/* Top Conversation Header */}
      <div className="relative z-40 h-14 border-b border-white/10 px-4 flex items-center justify-between bg-[#0b0f19] shrink-0 shadow-sm">
        {/* Left Side: Channel / Project breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile hamburger menu */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 shrink-0"
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
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white truncate">
                    {activeConversation.otherUser?.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Hash className="w-4 h-4" />
              </div>

              {/* Channel Name - never truncated unnecessarily */}
              <span className="font-semibold text-sm text-white shrink-0 tracking-tight">
                {activeChannel}
              </span>

              {activeProject && (
                <div className="hidden sm:flex items-center gap-2 min-w-0">
                  <span className="text-slate-600 select-none text-xs">/</span>
                  <span className="text-xs font-medium text-slate-400 truncate max-w-[160px] xl:max-w-none">
                    {activeProject.name}
                  </span>

                  {activeProject.githubRepo && (
                    <a
                      href={`https://github.com/${activeProject.githubRepo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] px-2 py-0.5 rounded-md border border-white/10 transition-colors shrink-0"
                      title={`GitHub: ${activeProject.githubRepo}`}
                    >
                      <GithubIcon className="w-3 h-3 text-slate-300" />
                      <span className="truncate max-w-[120px]">
                        {activeProject.githubRepo.split('/')[1] || activeProject.githubRepo}
                      </span>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Header Utilities - clean, balanced, uncluttered */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Live Sync Status Dot Badge */}
          <div
            className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono font-medium transition-colors ${
              isSocketConnected || isAutoSyncActive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
            title={`Realtime Event Sync Active (Updates on trigger: new messages, member add/remove, group add/remove)${lastSyncedAt ? ` • Last synced at ${lastSyncedAt.toLocaleTimeString()}` : ''}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="hidden xl:inline tracking-tight font-sans">
              Realtime Sync
            </span>
          </div>

          {/* Filter messages input */}
          <div className="relative hidden lg:block">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search chat..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 focus:border-indigo-500/40 rounded-lg text-slate-200 placeholder-slate-500 outline-none w-28 focus:w-44 transition-all"
            />
          </div>

          {/* Realtime Video & Voice Call Controls */}
          {activeConversation ? (
            /* Direct 1-on-1 Call Buttons */
            <div className="flex items-center gap-1">
              <button
                onClick={() => startDirectCall(activeConversation.otherUser, false)}
                disabled={callStatus !== 'IDLE'}
                className="p-1.5 rounded-lg text-slate-300 hover:text-emerald-400 bg-white/[0.03] hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
                title={`Start Voice Call with ${activeConversation.otherUser?.name || 'Developer'}`}
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => startDirectCall(activeConversation.otherUser, true)}
                disabled={callStatus !== 'IDLE'}
                className="p-1.5 rounded-lg text-slate-300 hover:text-cyan-400 bg-white/[0.03] hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
                title={`Start Video Call with ${activeConversation.otherUser?.name || 'Developer'}`}
              >
                <Video className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : activeProject ? (
            /* Group / Channel Call Buttons */
            (() => {
              const currentGroupRoomId = `group_${activeProject.id}_${activeChannel || 'general'}`;
              const ongoingCall = activeGroupCalls[currentGroupRoomId];
              const hasActiveCall = ongoingCall && ongoingCall.participantCount > 0;

              return (
                <div className="flex items-center gap-1">
                  {hasActiveCall ? (
                    <button
                      onClick={() =>
                        joinGroupCall(
                          activeProject.id,
                          activeChannel || 'general',
                          true,
                          `${activeProject.name} #${activeChannel || 'general'}`
                        )
                      }
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all cursor-pointer animate-pulse"
                      title="Join ongoing group call"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-slate-950" />
                      <span>Join Call ({ongoingCall.participantCount})</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          joinGroupCall(
                            activeProject.id,
                            activeChannel || 'general',
                            false,
                            `${activeProject.name} #${activeChannel || 'general'}`
                          )
                        }
                        disabled={callStatus !== 'IDLE'}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-emerald-400 bg-white/[0.03] hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
                        title={`Start Voice Room in #${activeChannel || 'general'}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          joinGroupCall(
                            activeProject.id,
                            activeChannel || 'general',
                            true,
                            `${activeProject.name} #${activeChannel || 'general'}`
                          )
                        }
                        disabled={callStatus !== 'IDLE'}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-cyan-300 bg-white/[0.03] hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
                        title={`Start Video Call in #${activeChannel || 'general'}`}
                      >
                        <Video className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="hidden md:inline text-[11px]">Call</span>
                      </button>
                    </>
                  )}
                </div>
              );
            })()
          ) : null}

          {/* Members count */}
          {!activeConversation && (
            <button
              onClick={() => {
                setActiveRightTab('info');
                setIsRightPanelOpen(true);
              }}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/10 rounded-lg border border-white/10 transition-colors cursor-pointer"
              title="View Project Members"
            >
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-mono">{members.length}</span>
            </button>
          )}

          {/* AI Project Assistant Shortcut */}
          <button
            onClick={() => {
              setActiveRightTab('ai');
              setIsRightPanelOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-all cursor-pointer shadow-sm shadow-purple-500/10"
            title="Open AI Project Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>

          {/* Subtle Vertical Divider */}
          <div className="h-4 w-[1px] bg-white/10 mx-0.5 hidden sm:block" />

          {/* Phase 6 Notification Bell */}
          <NotificationBell />

          {/* Toggle Right Panel */}
          <button
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isRightPanelOpen
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                : 'text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/10 border-white/10'
            }`}
            title={isRightPanelOpen ? 'Collapse Project Panel' : 'Expand Project Panel'}
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
                <div className="flex items-center my-4 px-4" suppressHydrationWarning>
                  <div className="flex-1 h-px bg-white/10" />
                  <span
                    className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                    suppressHydrationWarning
                  >
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
