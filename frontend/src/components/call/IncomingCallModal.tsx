'use client';

import React from 'react';
import { useCallStore } from '@/lib/callContext';
import { Avatar } from '@/components/ui/Avatar';
import { Phone, Video, PhoneOff, Sparkles, ShieldCheck } from 'lucide-react';

export function IncomingCallModal() {
  const {
    callStatus,
    callerUser,
    mediaType,
    groupTitle,
    acceptCall,
    rejectCall,
  } = useCallStore();

  if (callStatus !== 'INCOMING' || !callerUser) return null;

  const isVideoCall = mediaType === 'VIDEO';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
    >
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0c101c] p-7 shadow-2xl shadow-indigo-950/60 relative overflow-hidden flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        {/* Ambient background glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 blur-3xl rounded-full pointer-events-none" />

        {/* Ringing Avatar with Pulsing Halo */}
        <div className="relative my-4">
          <div className="absolute -inset-4 rounded-full bg-indigo-500/20 animate-ping opacity-60" />
          <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 opacity-40 blur-sm animate-pulse" />
          <div className="relative p-1 rounded-full bg-[#0c101c] border-2 border-indigo-500/40 shadow-xl">
            <Avatar
              name={callerUser.name || 'Caller'}
              avatarUrl={callerUser.avatarUrl}
              size="lg"
            />
          </div>
        </div>

        {/* Call Info */}
        <h3 id="incoming-call-title" className="text-lg font-bold text-white tracking-tight">
          {callerUser.name || 'Someone'}
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-[240px] truncate">
          {groupTitle || callerUser.headline || 'Incoming real-time call'}
        </p>

        {/* Call Type Pill */}
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
          {isVideoCall ? (
            <>
              <Video className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Incoming Video Call</span>
            </>
          ) : (
            <>
              <Phone className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Incoming Voice Call</span>
            </>
          )}
        </div>

        {/* Security badge */}
        <div className="mt-4 flex items-center gap-1 text-[10px] text-slate-500">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span>WebRTC Peer-to-Peer Encrypted</span>
        </div>

        {/* Action Buttons */}
        <div className="mt-7 flex items-center justify-center gap-6 w-full">
          {/* Decline Button */}
          <button
            onClick={rejectCall}
            className="flex flex-col items-center gap-2 text-slate-400 hover:text-rose-400 transition-colors group cursor-pointer"
            aria-label="Decline call"
          >
            <div className="w-14 h-14 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-all shadow-lg shadow-rose-950/40">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-medium text-slate-300">Decline</span>
          </button>

          {/* Accept Button */}
          <button
            onClick={() => acceptCall(isVideoCall)}
            className="flex flex-col items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors group cursor-pointer"
            aria-label="Accept call"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center group-hover:scale-105 transition-all shadow-lg shadow-emerald-500/30 animate-pulse">
              {isVideoCall ? (
                <Video className="w-6 h-6 text-slate-950 fill-slate-950" />
              ) : (
                <Phone className="w-6 h-6 text-slate-950 fill-slate-950" />
              )}
            </div>
            <span className="text-[11px] font-medium text-emerald-400">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
