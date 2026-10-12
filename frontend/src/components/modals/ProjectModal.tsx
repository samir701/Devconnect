'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAppStore } from '@/lib/store';
import { FolderPlus, X, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { GithubIcon } from '@/components/ui/Icons';

const projectFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Project name must be at least 2 characters')
    .max(100, 'Project name must be under 100 characters'),
  description: z.string().max(500, 'Description must be under 500 characters').optional(),
  githubRepo: z.string().max(200, 'Repository must be under 200 characters').optional(),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectModal({ isOpen, onClose }: ProjectModalProps) {
  const { refreshData, selectProject } = useAppStore();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    defaultValues: {
      name: '',
      description: '',
      githubRepo: '',
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data: ProjectFormData) => {
    setServerError(null);
    try {
      // Validate schema client-side
      const validated = projectFormSchema.safeParse(data);
      if (!validated.success) {
        setServerError(validated.error.issues[0]?.message || 'Invalid input data');
        return;
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name.trim(),
          description: data.description?.trim() || '',
          githubRepo: data.githubRepo?.trim() || '',
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setServerError(resData.error || 'Failed to create project');
        return;
      }

      // Success: refresh workspace and select the newly created project
      await refreshData();
      if (resData.project?.id) {
        selectProject(resData.project.id);
      }
      reset();
      onClose();
    } catch (err) {
      console.error('Error creating project:', err);
      setServerError('A network error occurred while creating project.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0c101b] shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="dialog-title"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-[#0c101b] rounded-[11px] flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <h2 id="dialog-title" className="text-base font-semibold text-white tracking-tight">
              Create New Project
            </h2>
            <p className="text-xs text-slate-400">
              Set up a shared developer workspace, channels, and member permissions.
            </p>
          </div>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Form with React Hook Form + Zod */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Project Name <span className="text-indigo-400">*</span>
            </label>
            <input
              type="text"
              {...register('name', { required: 'Project name is required' })}
              placeholder="e.g. Next.js 16 AI Engine, Mobile SDK, Core API"
              className={`w-full px-3.5 py-2.5 rounded-xl bg-white/5 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                errors.name
                  ? 'border-rose-500/50 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20'
                  : 'border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20'
              }`}
              autoFocus
            />
            {errors.name && (
              <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                <span>{errors.name.message}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Description <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Brief summary of architecture, objectives, and tech stack..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              GitHub Repository <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <GithubIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                {...register('githubRepo')}
                placeholder="org/repo or zettaweb/ai-workspace"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-colors font-mono text-xs"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-300">
              <p className="font-semibold text-white">Automated Setup</p>
              <p className="text-slate-400">
                You will be atomically assigned as <span className="text-indigo-300 font-mono">OWNER</span>. Standard channels (<code className="text-cyan-300">general</code>, <code className="text-cyan-300">development</code>, <code className="text-cyan-300">bugs</code>, <code className="text-cyan-300">tasks</code>) are auto-generated.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Workspace</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
