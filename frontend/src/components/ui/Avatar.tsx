import React from 'react';
import { UserStatus } from '@/lib/types';

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: UserStatus;
  className?: string;
}

export function Avatar({ name, avatarUrl, src, size = 'md', status, className = '' }: AvatarProps) {
  const imageSrc = avatarUrl || src;

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  }[size];

  const statusSize = {
    xs: 'w-1.5 h-1.5 ring-1',
    sm: 'w-2 h-2 ring-1.5',
    md: 'w-2.5 h-2.5 ring-2',
    lg: 'w-3 h-3 ring-2',
    xl: 'w-3.5 h-3.5 ring-2',
  }[size];

  const statusColors: Record<UserStatus, string> = {
    AVAILABLE: 'bg-emerald-500 presence-online-glow',
    ONLINE: 'bg-emerald-500 presence-online-glow',
    AWAY: 'bg-amber-500',
    OFFLINE: 'bg-zinc-500',
  };

  const initials = (name || 'User')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt={name}
          className={`${sizeClasses} rounded-full object-cover border border-white/10`}
        />
      ) : (
        <div
          className={`${sizeClasses} rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-600 text-white font-semibold flex items-center justify-center border border-white/15`}
        >
          {initials}
        </div>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-neutral-900 ${statusSize} ${statusColors[status] || statusColors.AVAILABLE}`}
        />
      )}
    </div>
  );
}
