'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Avatar } from '@/components/ui/Avatar';
import { UserStatus } from '@/lib/types';
import {
  X,
  User as UserIcon,
  Save,
  Check,
  LogOut,
  FolderKanban,
  Sparkles,
  ExternalLink,
  Plus,
  Loader2,
  AlertCircle,
  Camera,
  Bell,
} from 'lucide-react';
import { GithubIcon, LinkedinIcon } from '@/components/ui/Icons';

export function UserProfileModal() {
  const {
    isProfileOpen,
    setIsProfileOpen,
    currentUser,
    setCurrentUser,
    logout,
    projects,
    setIsNotifSettingsOpen,
  } = useAppStore();

  const [name, setName] = useState(currentUser?.name || '');
  const [headline, setHeadline] = useState(currentUser?.headline || currentUser?.title || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [githubUrl, setGithubUrl] = useState(currentUser?.githubUrl || currentUser?.github || '');
  const [linkedinUrl, setLinkedinUrl] = useState(currentUser?.linkedinUrl || currentUser?.linkedin || '');
  const [skills, setSkills] = useState<string[]>(currentUser?.skills || []);
  const [newSkillTag, setNewSkillTag] = useState('');
  const [status, setStatus] = useState<UserStatus>(currentUser?.status || 'AVAILABLE');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setHeadline(currentUser.headline || currentUser.title || '');
      setBio(currentUser.bio || '');
      setGithubUrl(currentUser.githubUrl || currentUser.github || '');
      setLinkedinUrl(currentUser.linkedinUrl || currentUser.linkedin || '');
      setSkills(currentUser.skills || []);
      setStatus(currentUser.status || 'AVAILABLE');
      setAvatarUrl(currentUser.avatarUrl || '');
    }
  }, [currentUser]);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Avatar image size must be under 5MB.');
      return;
    }

    setIsUploadingAvatar(true);
    setErrorMessage(null);

    try {
      // 1. Request presigned upload URL
      const presignRes = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          type: 'avatar',
        }),
      });

      if (!presignRes.ok) {
        throw new Error('Failed to obtain upload authorization');
      }

      const presign = await presignRes.json();

      // 2. Upload file binary
      if (presign.uploadUrl && presign.isCloudB2) {
        await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
          },
          body: file,
        });
      } else {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('storageKey', presign.storageKey);
        await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
      }

      const newAvatarUrl = presign.fileUrl;
      setAvatarUrl(newAvatarUrl);

      // 3. Persist avatar change to user profile
      const patchRes = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: newAvatarUrl }),
      });
      if (patchRes.ok) {
        const patchData = await patchRes.json();
        if (patchData.user) {
          setCurrentUser(patchData.user);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload avatar';
      setErrorMessage(msg);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  if (!isProfileOpen || !currentUser) return null;

  const handleAddSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const tag = newSkillTag.trim();
    if (tag && !skills.includes(tag)) {
      setSkills([...skills, tag]);
      setNewSkillTag('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          headline: headline.trim(),
          title: headline.trim(),
          bio: bio.trim(),
          githubUrl: githubUrl.trim(),
          github: githubUrl.trim(),
          linkedinUrl: linkedinUrl.trim(),
          linkedin: linkedinUrl.trim(),
          skills,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to update profile');
        return;
      }

      setCurrentUser(data.user);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setIsProfileOpen(false);
      }, 1000);
    } catch {
      setErrorMessage('Network error while saving profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const userProjects = projects.filter((p) => p.status === 'ACTIVE');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => setIsProfileOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0c101b] shadow-2xl p-6 relative flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {/* Close Button */}
        <button
          onClick={() => setIsProfileOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Linear-Style Header Banner */}
        <div className="flex items-start gap-4 pb-5 border-b border-white/10 shrink-0">
          <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()} title="Change avatar picture">
            <Avatar
              name={name || currentUser.name}
              src={avatarUrl || currentUser.avatarUrl}
              status={status}
              size="lg"
            />
            <div className="absolute inset-0 rounded-full bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-cyan-400/40">
              {isUploadingAvatar ? (
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-cyan-300" />
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight truncate">
                {name || currentUser.name}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Developer
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {currentUser.email}
            </p>

            {/* Availability Status Selector */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-slate-400 font-medium">Availability:</span>
              <div className="inline-flex rounded-lg bg-white/5 p-0.5 border border-white/10">
                {(['AVAILABLE', 'AWAY', 'OFFLINE'] as UserStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                      status === st
                        ? st === 'AVAILABLE'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : st === 'AWAY'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-700 text-slate-300'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'AVAILABLE' ? 'Online / Available' : st === 'AWAY' ? 'Away' : 'Offline'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {errorMessage && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs shrink-0 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Headline */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Headline & Focus Areas
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer | Next.js | AI/ML"
              className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Developer Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              placeholder="Specializing in high-performance distributed systems and developer tooling..."
              className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          {/* Skills Tag Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Technical Skills & Stacks</span>
              <span className="text-[10px] text-slate-500 font-normal">Press Enter to add</span>
            </label>

            {/* Chips Box */}
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 min-h-[50px] flex flex-wrap gap-1.5 items-center">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium group"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="text-indigo-400/60 hover:text-rose-400 p-0.5 rounded transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <div className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={newSkillTag}
                  onChange={(e) => setNewSkillTag(e.target.value)}
                  onKeyDown={handleAddSkill}
                  placeholder="+ Add skill..."
                  className="w-24 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-0 border-none"
                />
                {newSkillTag && (
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="p-1 rounded bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Social Developer Profiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                GitHub Handle / URL
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <GithubIcon className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="samirbrahma"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                LinkedIn Profile / URL
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <LinkedinIcon className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="in/samirbrahma"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* Active Workspaces / Projects Summary */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-cyan-400" />
              <span>Participating Projects</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {userProjects.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs"
                >
                  <p className="font-semibold text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {p.ownerId === currentUser.id ? 'Owner' : 'Member'} • {p.channels.length} channels
                  </p>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Modal Actions Footer */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                setIsNotifSettingsOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-indigo-400 hover:text-white hover:bg-indigo-600/20 border border-indigo-500/30 transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-indigo-400" />
              <span>Notification Settings</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsProfileOpen(false)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
