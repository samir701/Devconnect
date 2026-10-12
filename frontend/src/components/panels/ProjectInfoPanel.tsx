'use client';

import React, { useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { BugsBoard } from './BugsBoard';
import { TasksBoard } from './TasksBoard';
import { ActivityFeed } from './ActivityFeed';
import { AIAssistantPanel } from './AIAssistantPanel';
import { ProjectFilesBrowser } from './ProjectFilesBrowser';
import {
  X,
  Info,
  Bug as BugIcon,
  CheckSquare,
  FileText,
  Activity,
  Sparkles,
  HardDrive,
  Upload,
  Download,
} from 'lucide-react';
import { GithubIcon } from '@/components/ui/Icons';

export function ProjectInfoPanel() {
  const {
    activeProject,
    activeConversation,
    members,
    attachments,
    uploadFile,
    isRightPanelOpen,
    setIsRightPanelOpen,
    activeRightTab,
    setActiveRightTab,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isRightPanelOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
      e.target.value = '';
    }
  };

  return (
    <aside className="w-80 lg:w-96 border-l border-white/10 bg-[#0b0f19] flex flex-col h-full shrink-0 z-10">
      {/* Top Header */}
      <div className="h-14 border-b border-white/10 px-4 flex items-center justify-between shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 truncate">
          {activeConversation ? 'User Profile' : 'Project Information'}
        </h3>
        <button
          onClick={() => setIsRightPanelOpen(false)}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Direct conversation mode user profile */}
      {activeConversation ? (
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div className="text-center pb-4 border-b border-white/10">
            <Avatar
              name={activeConversation.otherUser?.name || 'Developer'}
              avatarUrl={activeConversation.otherUser?.avatarUrl}
              status={activeConversation.otherUser?.status}
              size="xl"
              className="mx-auto mb-3"
            />
            <h3 className="text-base font-semibold text-white">
              {activeConversation.otherUser?.name}
            </h3>
            <p className="text-xs text-indigo-400 mt-0.5">
              {activeConversation.otherUser?.title}
            </p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-mono bg-white/5 border border-white/10">
              <span
                className={`w-2 h-2 rounded-full ${
                  activeConversation.otherUser?.status === 'ONLINE'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
              />
              <span className="text-slate-300">
                {activeConversation.otherUser?.status === 'ONLINE'
                  ? 'Available'
                  : 'Away'}
              </span>
            </div>
          </div>

          {activeConversation.otherUser?.bio && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Bio
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-white/5">
                {activeConversation.otherUser.bio}
              </p>
            </div>
          )}

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Technical Skills
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeConversation.otherUser?.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 rounded-md text-xs bg-white/5 border border-white/10 text-slate-300 font-mono"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {activeConversation.otherUser?.github && (
            <div className="pt-2 border-t border-white/5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Code Profile
              </div>
              <a
                href={`https://github.com/${activeConversation.otherUser.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-200 transition-colors"
              >
                <GithubIcon className="w-4 h-4 text-white" />
                <span className="font-mono">{activeConversation.otherUser.github}</span>
              </a>
            </div>
          )}
        </div>
      ) : (
        /* Project Mode with Tabs */
        <>
          {/* Navigation Tabs */}
          <div className="flex items-center border-b border-white/10 px-2 text-xs overflow-x-auto shrink-0 bg-[#090d16]/50">
            <button
              onClick={() => setActiveRightTab('info')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-all ${
                activeRightTab === 'info'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Info</span>
            </button>

            <button
              onClick={() => setActiveRightTab('bugs')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-all ${
                activeRightTab === 'bugs'
                  ? 'border-rose-500 text-rose-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BugIcon className="w-3.5 h-3.5" />
              <span>Bugs</span>
            </button>

            <button
              onClick={() => setActiveRightTab('tasks')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-all ${
                activeRightTab === 'tasks'
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Tasks</span>
            </button>

            <button
              onClick={() => setActiveRightTab('files')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-all ${
                activeRightTab === 'files'
                  ? 'border-cyan-500 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Files</span>
            </button>

            <button
              onClick={() => setActiveRightTab('activity')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-all ${
                activeRightTab === 'activity'
                  ? 'border-amber-500 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Activity</span>
            </button>

            <button
              onClick={() => setActiveRightTab('ai')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-all ${
                activeRightTab === 'ai'
                  ? 'border-purple-500 text-purple-300'
                  : 'border-transparent text-slate-400 hover:text-purple-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>AI</span>
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeRightTab === 'info' && (
              <div className="space-y-4">
                {/* Project details card */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">
                      {activeProject?.name}
                    </h4>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {activeProject?.description}
                  </p>
                  {activeProject?.githubRepo && (
                    <a
                      href={`https://github.com/${activeProject.githubRepo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-mono mt-1"
                    >
                      <GithubIcon className="w-3.5 h-3.5" />
                      <span>{activeProject.githubRepo}</span>
                    </a>
                  )}
                </div>

                {/* Team Members List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Team Members ({members.length})
                    </h5>
                  </div>
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            name={m.user?.name || 'Developer'}
                            avatarUrl={m.user?.avatarUrl}
                            status={m.user?.status}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">
                              {m.user?.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {m.user?.title?.split('•')[0]}
                            </div>
                          </div>
                        </div>

                        <Badge variant="role" value={m.role} size="sm">
                          {m.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeRightTab === 'bugs' && <BugsBoard />}

            {activeRightTab === 'tasks' && <TasksBoard />}

            {activeRightTab === 'files' && <ProjectFilesBrowser />}

            {activeRightTab === 'activity' && <ActivityFeed />}

            {activeRightTab === 'ai' && <AIAssistantPanel />}
          </div>
        </>
      )}
    </aside>
  );
}
