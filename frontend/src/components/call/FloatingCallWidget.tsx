'use client';

import React, { useRef, useEffect } from 'react';
import { useCallStore } from '@/lib/callContext';
import { Avatar } from '@/components/ui/Avatar';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Maximize2,
  Users,
} from 'lucide-react';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function FloatingCallWidget() {
  const {
    callStatus,
    callType,
    targetUser,
    groupTitle,
    localStream,
    participants,
    isMuted,
    isVideoOff,
    isMinimized,
    callDuration,
    toggleMute,
    toggleVideo,
    setIsMinimized,
    endCall,
  } = useCallStore();

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Show remote peer video if available, else local
  const displayStream =
    participants.length > 0 && participants[0].stream
      ? participants[0].stream
      : localStream;

  useEffect(() => {
    if (previewVideoRef.current && displayStream) {
      previewVideoRef.current.srcObject = displayStream;
    }
  }, [displayStream]);

  if ((callStatus !== 'CONNECTED' && callStatus !== 'CALLING') || !isMinimized) {
    return null;
  }

  const callTitle =
    callType === 'DIRECT'
      ? targetUser?.name || 'Developer'
      : groupTitle || 'Group Conference';

  return (
    <aside
      aria-label="Active Call Floating Widget"
      className="fixed bottom-5 right-5 z-50 w-72 sm:w-80 rounded-2xl border border-indigo-500/30 bg-[#0d1220]/95 backdrop-blur-xl shadow-2xl shadow-indigo-950/60 overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-200"
    >
      {/* Mini Video / Avatar Preview Banner */}
      <div className="relative aspect-video w-full bg-[#080b14] overflow-hidden flex items-center justify-center">
        {displayStream && !isVideoOff ? (
          <video
            ref={previewVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <div className="relative">
              <div className="absolute -inset-2 rounded-full bg-indigo-500/20 animate-pulse" />
              <Avatar
                name={callTitle}
                avatarUrl={targetUser?.avatarUrl}
                size="md"
              />
            </div>
            <span className="mt-2 text-xs font-semibold text-white truncate max-w-[200px]">
              {callTitle}
            </span>
          </div>
        )}

        {/* Top Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono font-medium text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{formatDuration(callDuration)}</span>
          </div>

          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 rounded-lg bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-white transition-colors cursor-pointer pointer-events-auto"
            title="Expand to Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Participant Count in Group Call */}
        {callType === 'GROUP' && (
          <div className="absolute bottom-2 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 text-[10px] font-mono text-slate-300 pointer-events-none">
            <Users className="w-3 h-3 text-cyan-400" />
            <span>{participants.length + 1}</span>
          </div>
        )}
      </div>

      {/* Mini Controls Footer */}
      <div className="p-3 bg-[#0a0e1a] border-t border-white/10 flex items-center justify-between">
        <div className="min-w-0 flex-1 mr-2">
          <div className="text-xs font-semibold text-white truncate">
            {callTitle}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {callType === 'DIRECT' ? '1-on-1 Call' : 'Project Call'}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          {/* Camera Button */}
          <button
            onClick={toggleVideo}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isVideoOff
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
            title={isVideoOff ? 'Turn on video' : 'Turn off video'}
          >
            {isVideoOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
          </button>

          {/* Hangup Button */}
          <button
            onClick={endCall}
            className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 transition-colors cursor-pointer"
            title="Leave Call"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
