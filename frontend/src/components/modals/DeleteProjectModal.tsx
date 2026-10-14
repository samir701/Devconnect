'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Trash2, X, AlertTriangle, Loader2, FolderKanban } from 'lucide-react';

export function DeleteProjectModal() {
  const {
    isDeleteProjectOpen,
    setIsDeleteProjectOpen,
    projectToDelete,
    setProjectToDelete,
    deleteProject,
  } = useAppStore();

  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isDeleteProjectOpen || !projectToDelete) return null;

  const handleClose = () => {
    if (isDeleting) return;
    setIsDeleteProjectOpen(false);
    setProjectToDelete(null);
    setErrorMessage(null);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteProject(projectToDelete.id);
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete group';
      setErrorMessage(msg);
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-group-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#0d111c] shadow-2xl shadow-rose-950/40 p-6 relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 p-[1px] shadow-lg shadow-rose-500/20">
            <div className="w-full h-full bg-[#0d111c] rounded-[11px] flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-rose-400" />
            </div>
          </div>
          <div>
            <h2 id="delete-group-title" className="text-base font-semibold text-white tracking-tight">
              Delete Group
            </h2>
            <p className="text-xs text-slate-400">
              Permanently remove this workspace group
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="mt-4 space-y-4">
          {/* Target Group Info Card */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold text-xs shrink-0">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm text-white truncate">
                {projectToDelete.name}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {projectToDelete.description || `${projectToDelete.channels?.length || 6} channels`}
              </div>
            </div>
          </div>

          {/* Warning Notice */}
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex gap-3 text-xs text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-rose-300">This action cannot be undone.</p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Deleting this group will remove all channel messages, tasks, bug tracking tickets, and member associations.
              </p>
            </div>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              {errorMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Group</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
