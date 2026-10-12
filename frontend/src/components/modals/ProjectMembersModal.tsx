'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Avatar } from '@/components/ui/Avatar';
import { ProjectRole } from '@/lib/types';
import {
  Users,
  X,
  UserPlus,
  Shield,
  ShieldCheck,
  Code2,
  Bug,
  Eye,
  Trash2,
  Search,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';

const ROLE_CONFIG: Record<
  ProjectRole,
  { label: string; icon: React.ElementType; badgeClass: string; desc: string }
> = {
  OWNER: {
    label: 'Owner',
    icon: ShieldCheck,
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    desc: 'Full project ownership, archiving, and member permissions',
  },
  ADMIN: {
    label: 'Admin',
    icon: Shield,
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    desc: 'Manage project settings, channels, and invite members',
  },
  DEVELOPER: {
    label: 'Developer',
    icon: Code2,
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    desc: 'Create tasks, report bugs, send code blocks, push commits',
  },
  QA: {
    label: 'QA Engineer',
    icon: Bug,
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    desc: 'File bug reports, triage status, and verify fixes',
  },
  VIEWER: {
    label: 'Viewer',
    icon: Eye,
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    desc: 'Read-only access to messages, files, and project status',
  },
};

interface ProjectMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectMembersModal({ isOpen, onClose }: ProjectMembersModalProps) {
  const {
    activeProject,
    members,
    currentUser,
    userRole,
    refreshData,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('DEVELOPER');
  const [isInviting, setIsInviting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !activeProject) return null;

  const canManageMembers = userRole === 'OWNER' || userRole === 'ADMIN' || activeProject.ownerId === currentUser?.id;

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    const name = m.user?.name?.toLowerCase() || '';
    const email = m.user?.email?.toLowerCase() || '';
    const role = m.role?.toLowerCase() || '';
    return name.includes(q) || email.includes(q) || role.includes(q);
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsInviting(true);

    try {
      const res = await fetch(`/api/projects/${activeProject.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to add member');
        return;
      }

      setSuccessMessage(`Successfully added developer as ${inviteRole}!`);
      setInviteEmail('');
      await refreshData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setErrorMessage('Network error while inviting member.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: ProjectRole) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setUpdatingMemberId(memberId);

    try {
      const res = await fetch(`/api/projects/${activeProject.id}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to update role');
        return;
      }

      setSuccessMessage(`Updated role to ${newRole}`);
      await refreshData();
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch {
      setErrorMessage('Network error while updating role.');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const confirmRemove = window.confirm(
      `Are you sure you want to remove ${memberName} from ${activeProject.name}?`
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

      setSuccessMessage(`Removed ${memberName} from project.`);
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
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0c101b] shadow-2xl p-6 relative flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
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
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              <span>{activeProject.name}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Role-based access control (RBAC) and team membership settings.
            </p>
          </div>
        </div>

        {/* Feedback alerts */}
        {errorMessage && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs shrink-0 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs shrink-0 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Invite Form (Visible to OWNER & ADMIN) */}
        {canManageMembers && (
          <form onSubmit={handleInvite} className="mt-4 p-3.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-white">
              <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Invite Developer to Project</span>
            </div>
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

              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
                className="px-3 py-2 rounded-lg bg-[#070b13] border border-white/10 text-xs text-slate-300 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="DEVELOPER">Developer (Default)</option>
                <option value="ADMIN">Admin</option>
                <option value="QA">QA Engineer</option>
                <option value="VIEWER">Viewer</option>
                <option value="OWNER">Owner</option>
              </select>

              <button
                type="submit"
                disabled={isInviting || !inviteEmail.trim()}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
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
          </form>
        )}

        {/* Member Search Bar */}
        <div className="mt-4 shrink-0 relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search team members by name, email, or role..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Member List */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-white/5">
          {filteredMembers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No project members match your search.
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isCurrentUser = member.userId === currentUser?.id;
              const isOwner = member.role === 'OWNER';
              const RoleIcon = ROLE_CONFIG[member.role]?.icon || Code2;
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

                  {/* Actions / Role Selector */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Role Dropdown / Badge */}
                    {canManageMembers && !isOwner ? (
                      <select
                        value={member.role}
                        disabled={isUpdating}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as ProjectRole)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium focus:outline-none cursor-pointer bg-[#070b13] ${
                          ROLE_CONFIG[member.role]?.badgeClass || 'text-slate-300'
                        }`}
                      >
                        <option value="OWNER">Owner</option>
                        <option value="ADMIN">Admin</option>
                        <option value="DEVELOPER">Developer</option>
                        <option value="QA">QA Engineer</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    ) : (
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
                          ROLE_CONFIG[member.role]?.badgeClass
                        }`}
                      >
                        <RoleIcon className="w-3 h-3" />
                        <span>{ROLE_CONFIG[member.role]?.label || member.role}</span>
                      </div>
                    )}

                    {/* Remove Action */}
                    {(canManageMembers || isCurrentUser) && !isOwner && (
                      <button
                        onClick={() =>
                          handleRemoveMember(member.id, member.user?.name || 'Developer')
                        }
                        disabled={isUpdating}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title={isCurrentUser ? 'Leave project' : 'Remove member'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>RBAC: Only Owners and Admins can modify permissions</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
