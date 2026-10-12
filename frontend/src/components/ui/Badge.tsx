import React from 'react';
import { PriorityLevel, TaskStatus, BugStatus, ProjectRole } from '@/lib/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'priority' | 'task-status' | 'bug-status' | 'role' | 'outline' | 'default';
  value?: PriorityLevel | TaskStatus | BugStatus | ProjectRole | string;
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', value, size = 'sm', className = '' }: BadgeProps) {
  let colorStyle = 'bg-white/10 text-white border-white/10';

  if (variant === 'priority') {
    switch (value) {
      case 'CRITICAL':
        colorStyle = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
        break;
      case 'HIGH':
        colorStyle = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
        break;
      case 'MEDIUM':
        colorStyle = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
        break;
      case 'LOW':
        colorStyle = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        break;
    }
  } else if (variant === 'task-status') {
    switch (value) {
      case 'COMPLETED':
        colorStyle = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        break;
      case 'IN_PROGRESS':
        colorStyle = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
        break;
      case 'REVIEW':
        colorStyle = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
        break;
      case 'TODO':
        colorStyle = 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
        break;
    }
  } else if (variant === 'bug-status') {
    switch (value) {
      case 'FIXED':
      case 'CLOSED':
        colorStyle = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        break;
      case 'OPEN':
        colorStyle = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
        break;
      case 'INVESTIGATING':
        colorStyle = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
        break;
      case 'IN_PROGRESS':
        colorStyle = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
        break;
    }
  } else if (variant === 'role') {
    switch (value) {
      case 'OWNER':
        colorStyle = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
        break;
      case 'ADMIN':
        colorStyle = 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
        break;
      default:
        colorStyle = 'bg-sky-500/10 text-sky-300 border-sky-500/20';
        break;
    }
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${colorStyle} ${sizeClasses} ${className}`}
    >
      {children}
    </span>
  );
}
