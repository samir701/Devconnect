'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Avatar } from '@/components/ui/Avatar';
import {
  Users,
  X,
  UserPlus,
  ShieldCheck,
  Trash2,
  Search,
  AlertCircle,
  Loader2,
  Check,
  Settings,
  Sparkles,
} from 'lucide-react';

interface ProjectMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectMembersModal({ isOpen, onClose }: ProjectMembersModalProps) {
  const {
    activeProject,
    members,
    currentUser,
    refreshData,
    setIsDeleteProjectOpen,
    setProjectToDelete,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Capacity limit state
  const [capacityInput, setCapacityInput] = useState<string>('');
  const [isUpdatingCapacity, setIsUpdatingCapacity] = useState(false);
  const [showCapacityEditor, setShowCapacityEditor] = useState(false);

  // Sync capacity input whenever the active project changes
  useEffect(() => {
    if (activeProject) {
      setCapacityInput(
        activeProject.maxMembers !== undefined && activeProject.maxMembers !== null
          ? String(activeProject.maxMembers)
          : ''
      );
    }
  }, [activeProject?.id, activeProject?.maxMembers]);

  if (!isOpen || !activeProject) return null;

  const maxLimit = activeProject.maxMembers;
  const isAtCapacity = typeof maxLimit === 'number' && maxLimit > 0 && members.length >= maxLimit;
  const fillPercentage = typeof maxLimit === 'number' && maxLimit > 0
    ? Math.min(100, Math.round((members.length / maxLimit) * 100))
    : 0;

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    const name = m.user?.name?.toLowerCase() || '';
    const email = m.user?.email?.toLowerCase() || '';
    return name.includes(q) || email.includes(q);
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    if (isAtCapacity) {
      setErrorMessage(`Workspace has reached its maximum capacity of ${maxLimit} members. Increase capacity limit above to invite more developers.`);
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsInviting(true);

    try {
      const res = await fetch(`/api/projects/${activeProject.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to add member');
        return;
      }

      setSuccessMessage('Successfully added developer as Owner with full workspace access!');
      setInviteEmail('');
      await refreshData();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch {
      setErrorMessage('Network error while inviting member.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUpdatingCapacity(true);

    try {
      const trimmed = capacityInput.trim();
      let newLimit: number | null = null;

      if (trimmed !== '') {
        const parsed = Number(trimmed);
        if (isNaN(parsed) || parsed < 1 || parsed > 500) {
          setErrorMessage('Max members must be an integer between 1 and 500 (or leave empty for unlimited).');
          setIsUpdatingCapacity(false);
          return;
        }
        if (parsed < members.length) {
          setErrorMessage(`Cannot set capacity to ${parsed} because this project currently has ${members.length} active members.`);
          setIsUpdatingCapacity(false);
          return;
        }
        newLimit = parsed;
      }

      const res = await fetch(`/api/projects/${activeProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxMembers: newLimit }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to update member capacity');
        return;
      }

      setSuccessMessage(
        newLimit
          ? `Workspace capacity successfully updated to ${newLimit} members!`
          : 'Workspace capacity is now set to Unlimited!'
      );
      await refreshData();
      setShowCapacityEditor(false);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch {
      setErrorMessage('Network error while updating capacity limit.');
    } finally {
      setIsUpdatingCapacity(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const isSelf = memberId === currentUser?.id || members.find((m) => m.id === memberId)?.userId === currentUser?.id;
    const confirmRemove = window.confirm(
      isSelf
        ? `Are you sure you want to leave ${activeProject.name}?`
        : `Are you sure you want to remove ${memberName} from ${activeProject.name}?`
    );
    if (!confirmRemove) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setUpdatingMemberId(memberId);

    try {
      const res = await fetch(`/api/projects/${activeProject.id}/members/${memberId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to remove member');
        return;
      }

      setSuccessMessage(isSelf ? `Left ${activeProject.name}.` : `Removed ${memberName} from project.`);
      await refreshData();
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch {
      setErrorMessage('Network error while removing member.');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0c101b] shadow-2xl p-6 relative flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-members-title"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/10 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 p-[1px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-[#0c101b] rounded-[11px] flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="project-members-title" className="text-base font-semibold text-white tracking-tight truncate">
                {activeProject.name}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
              {typeof maxLimit === 'number' && maxLimit > 0 ? (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    isAtCapacity
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  }`}
                >
                  Limit: {maxLimit} max
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Unlimited slots
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Workspace members, full Owner permissions & team capacity settings.
            </p>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs shrink-0 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs shrink-0 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="flex-1">{successMessage}</span>
          </div>
        )}

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pt-4 pr-1">
          {/* Section 1: Team Capacity & Max Members Allowed */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white">Team Member Capacity</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCapacityEditor(!showCapacityEditor)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors font-medium cursor-pointer"
              >
                {showCapacityEditor ? 'Close Setting' : 'Edit Max Limit'}
              </button>
            </div>

            {/* Capacity meter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold text-white">{members.length}</span>
                  <span className="text-slate-400">
                    of {typeof maxLimit === 'number' && maxLimit > 0 ? `${maxLimit} max allowed` : 'Unlimited'}
                  </span>
                </span>
                {typeof maxLimit === 'number' && maxLimit > 0 ? (
                  <span
                    className={`text-[11px] font-medium ${
                      isAtCapacity ? 'text-rose-400 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {isAtCapacity ? 'Capacity Reached' : `${maxLimit - members.length} spots remaining (${fillPercentage}% filled)`}
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-400 font-medium">Open Enrollment</span>
                )}
              </div>

              {typeof maxLimit === 'number' && maxLimit > 0 && (
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden border border-white/5">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isAtCapacity
                        ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                        : fillPercentage >= 80
                        ? 'bg-amber-500'
                        : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
                    }`}
                    style={{ width: `${fillPercentage}%` }}
                  />
                </div>
              )}
            </div>

            {/* Inline Capacity Editor */}
            {showCapacityEditor && (
              <form onSubmit={handleUpdateCapacity} className="mt-3 pt-3 border-t border-white/10 space-y-2 animate-in fade-in">
                <label className="block text-[11px] font-medium text-slate-300">
                  Update Maximum Number of Members Allowed:
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <Users className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="number"
                      min={members.length || 1}
                      max={500}
                      value={capacityInput}
                      onChange={(e) => setCapacityInput(e.target.value)}
                      placeholder="Leave blank for unlimited"
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#070b13] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUpdatingCapacity}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isUpdatingCapacity ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Limit</span>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Must be at least the current member count ({members.length}). Empty input sets capacity to unlimited.
                </p>
              </form>
            )}
          </div>

          {/* Section 2: Invite Developer to Project */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white">Invite Developer to Workspace</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-amber-300 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <Sparkles className="w-3 h-3" />
                <span>Auto-assigned as Owner</span>
              </div>
            </div>

            {isAtCapacity ? (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-200">Maximum Member Limit Reached ({maxLimit}/{maxLimit})</p>
                  <p className="text-[11px] text-rose-300/90 mt-0.5">
                    To invite new developers, please increase the maximum member capacity limit in the setting above.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="developer@company.com"
                      className="w-full px-3 py-2 rounded-lg bg-[#070b13] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isInviting || !inviteEmail.trim()}
                    className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    {isInviting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <span>Add Member</span>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  No role selection required — all team members automatically receive full <span className="text-amber-300 font-semibold">Owner</span> access with complete workspace permissions.
                </p>
              </form>
            )}
          </div>

          {/* Section 3: Member List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white">Project Members ({members.length})</span>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team members by name or email..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Member Rows */}
            <div className="space-y-2 divide-y divide-white/5">
              {filteredMembers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No project members match your search.
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const isCurrentUser = member.userId === currentUser?.id;
                  const isUpdating = updatingMemberId === member.id;

                  return (
                    <div
                      key={member.id}
                      className="pt-2 pb-2 first:pt-0 flex items-center justify-between gap-3 group"
                    >
                      {/* Member Identity */}
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={member.user?.name || 'Developer'}
                          src={member.user?.avatarUrl}
                          status={member.user?.status || 'OFFLINE'}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white truncate">
                              {member.user?.name || 'Developer'}
                            </span>
                            {isCurrentUser && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {member.user?.headline || member.user?.email || 'Active Workspace Collaborator'}
                          </p>
                        </div>
                      </div>

                      {/* Role Badge & Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Always Owner • Full Access */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold bg-amber-500/10 text-amber-300 border-amber-500/20 shadow-sm">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>Owner • Full Access</span>
                        </div>

                        {/* Remove / Leave Action */}
                        <button
                          onClick={() =>
                            handleRemoveMember(member.id, member.user?.name || 'Developer')
                          }
                          disabled={isUpdating}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title={isCurrentUser ? 'Leave project' : 'Remove member'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Danger Zone: Delete Group */}
        <div className="mt-4 pt-3 border-t border-rose-500/20 flex items-center justify-between bg-rose-500/5 -mx-6 px-6 py-2.5 shrink-0">
          <div>
            <div className="text-xs font-semibold text-rose-300">Delete this workspace group</div>
            <div className="text-[10px] text-slate-400">Permanently remove {activeProject.name} and all associated discussions, tasks, and files.</div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              setProjectToDelete(activeProject);
              setIsDeleteProjectOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Group</span>
          </button>
        </div>

        {/* Modal Footer */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>All project members have full Owner access to workspace, settings & channels.</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
