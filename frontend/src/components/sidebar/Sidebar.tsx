'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { Avatar } from '@/components/ui/Avatar';
import {
  FolderKanban,
  MessageSquare,
  Search,
  Plus,
  Hash,
  Database,
  User as UserIcon,
  Sparkles,
  Command,
  ChevronDown,
  Layers,
  Users,
  Trash2,
  Phone,
  Video,
  PhoneCall,
} from 'lucide-react';
import { useCall } from '@/lib/callContext';

export function Sidebar() {
  const {
    currentUser,
    projects,
    activeProjectId,
    selectProject,
    activeChannel,
    selectChannel,
    conversations,
    activeConversation,
    selectConversation,
    setIsSearchOpen,
    setIsProfileOpen,
    setIsCreateProjectOpen,
    setIsDeleteProjectOpen,
    setProjectToDelete,
    setIsProjectMembersOpen,
    setIsStatusOpen,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    setIsAuthModalOpen,
  } = useAppStore();

  const { activeGroupCalls, startDirectCall, callStatus } = useCall();

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#080c15] border-r border-white/10 flex flex-col h-full shrink-0 transition-transform duration-200 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Workspace Brand Header */}
        <div className="h-14 border-b border-white/10 px-4 flex items-center justify-between shrink-0 bg-[#070b13]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#080c15] rounded-[11px] flex items-center justify-center">
                <Layers className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white">
                  ZettaDev
                </span>
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  MVP
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                ZettaWeb Workspace
              </span>
            </div>
          </div>

          {/* Cloud Diagnostics trigger */}
          <button
            onClick={() => setIsStatusOpen(true)}
            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded-lg transition-colors"
            title="TiDB & Backblaze B2 Status"
          >
            <Database className="w-4 h-4" />
          </button>
        </div>

        {/* Global Search Bar (Cmd+K) */}
        <div className="p-3">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-400 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
              <span>Search workspace...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-slate-300 border border-white/10">
              <Command className="w-2.5 h-2.5" /> K
            </kbd>
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 space-y-5 py-2">
          {/* Projects Section */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FolderKanban className="w-3 h-3 text-slate-400" />
                <span>Projects</span>
              </span>
              <button
                onClick={() => setIsCreateProjectOpen(true)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 text-[10px] font-medium group cursor-pointer"
                title="Create New Project"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>Add</span>
              </button>
            </div>

            <div className="space-y-1">
              {projects.length === 0 ? (
                <div className="px-2.5 py-2 text-[11px] text-slate-500 italic">
                  No groups assigned yet. Wait for a peer invite or click + Add.
                </div>
              ) : (
                projects.map((proj) => {
                const isActive = activeProjectId === proj.id && !activeConversation;
                return (
                  <div key={proj.id} className="space-y-0.5">
                    <div
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all group ${
                        isActive
                          ? 'bg-indigo-600/20 text-white border border-indigo-500/30 shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <button
                        onClick={() => selectProject(proj.id)}
                        className="flex items-center gap-2 truncate flex-1 text-left cursor-pointer"
                      >
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                            isActive
                              ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm shadow-indigo-500/30'
                              : 'bg-white/10 text-slate-400 group-hover:text-white group-hover:bg-white/15'
                          }`}
                        >
                          {proj.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate">{proj.name}</span>
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0 ml-1">
                        {isActive && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsProjectMembersOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                            title="Manage Project Members & Capacity"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(proj);
                            setIsDeleteProjectOpen(true);
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          title={`Delete Group "${proj.name}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Channel sub-views when project is active */}
                    {isActive && (
                      <div className="pl-4 pr-1 py-1 space-y-0.5 border-l border-white/10 ml-3">
                        {proj.channels.map((ch) => {
                          const callRoom = activeGroupCalls[`group_${proj.id}_${ch}`];
                          const hasCall = callRoom && callRoom.participantCount > 0;

                          return (
                            <button
                              key={ch}
                              onClick={() => selectChannel(ch)}
                              className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs capitalize transition-colors ${
                                activeChannel === ch
                                  ? 'bg-white/10 text-cyan-300 font-semibold'
                                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Hash className="w-3 h-3 text-slate-500 shrink-0" />
                                <span className="truncate">{ch}</span>
                              </div>
                              {hasCall && (
                                <span
                                  className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-full border border-emerald-500/20 font-mono shrink-0 animate-pulse"
                                  title={`Live Call: ${callRoom.participantCount} participant${callRoom.participantCount > 1 ? 's' : ''}`}
                                >
                                  <PhoneCall className="w-2.5 h-2.5" />
                                  <span>{callRoom.participantCount}</span>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }))}
            </div>
          </div>

          {/* Direct Messages Section */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-slate-400" />
                <span>Direct Messages</span>
              </span>
            </div>

            <div className="space-y-1">
              {(() => {
                const realConversations = conversations.filter((conv) => {
                  const other = conv.otherUser;
                  if (!other) return false;
                  const email = (other.email || '').toLowerCase();
                  return !email.endsWith('@test.dev') && !email.endsWith('@example.com') && !email.includes('test_');
                });

                if (realConversations.length === 0) {
                  return (
                    <div className="px-2.5 py-2 text-[11px] text-slate-500 italic">
                      No direct messages yet
                    </div>
                  );
                }

                return realConversations.map((conv) => {
                  const isSelected = activeConversation?.id === conv.id;
                  const other = conv.otherUser;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/20 text-white border border-indigo-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={other?.name || 'Developer'}
                          avatarUrl={other?.avatarUrl}
                          status={other?.status}
                          size="xs"
                        />
                        <span className="truncate font-medium">
                          {other?.name || 'Developer'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Quick Call Actions on Hover */}
                        {other && (
                          <div className="hidden group-hover:flex items-center gap-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startDirectCall(other, false);
                              }}
                              disabled={callStatus !== 'IDLE'}
                              className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              title={`Voice call with ${other.name}`}
                            >
                              <Phone className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startDirectCall(other, true);
                              }}
                              disabled={callStatus !== 'IDLE'}
                              className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                              title={`Video call with ${other.name}`}
                            >
                              <Video className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {Boolean(conv.unreadCount && conv.unreadCount > 0 && !isSelected) && (
                          <span className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-cyan-500 text-slate-950 rounded-full flex items-center justify-center shrink-0 shadow-sm shadow-cyan-500/30">
                            {conv.unreadCount! > 9 ? '9+' : conv.unreadCount}
                          </span>
                        )}

                        {other?.status === 'ONLINE' && (!conv.unreadCount || isSelected) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 group-hover:hidden" />
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        {/* Current User Profile Bar */}
        <div className="p-3 border-t border-white/10 bg-[#070b13] shrink-0">
          {currentUser ? (
            <button
              onClick={() => setIsProfileOpen(true)}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar
                  name={currentUser.name}
                  avatarUrl={currentUser.avatarUrl}
                  status={currentUser.status || 'ONLINE'}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-emerald-400 truncate flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span>{currentUser.status || 'Available'}</span>
                  </div>
                </div>
              </div>

              <UserIcon className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <UserIcon className="w-4 h-4" />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
