'use client';

import React, { useEffect, useRef } from 'react';
import { useCallStore, CallParticipant } from '@/lib/callContext';
import { Avatar } from '@/components/ui/Avatar';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Minimize2,
  Users,
  ShieldCheck,
  Maximize2,
  Volume2,
} from 'lucide-react';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Single Participant Video/Avatar Tile
 */
function ParticipantTile({
  participant,
  isLocal = false,
}: {
  participant: CallParticipant;
  isLocal?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  const hasVideoTrack =
    participant.stream &&
    participant.stream.getVideoTracks().length > 0 &&
    participant.stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');

  const showVideo = !participant.isVideo === false && hasVideoTrack;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[#0d121f] border border-white/10 flex items-center justify-center group shadow-lg">
      {/* Video Element */}
      {participant.stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Always mute local video to avoid echo feedback
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            showVideo ? 'opacity-100' : 'opacity-0'
          } ${isLocal && !participant.isScreenSharing ? 'scale-x-[-1]' : ''}`}
        />
      )}

      {/* Fallback Avatar Placeholder when camera is off */}
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-[#101728] to-[#0a0e1a]">
          <div className="relative">
            <div className="absolute -inset-3 rounded-full bg-indigo-500/10 animate-pulse" />
            <Avatar
              name={participant.user?.name || 'Developer'}
              avatarUrl={participant.user?.avatarUrl}
              size="lg"
            />
          </div>
          <span className="mt-3 text-sm font-medium text-slate-200">
            {participant.user?.name || 'Participant'}
          </span>
          <span className="text-[11px] text-slate-500">Camera turned off</span>
        </div>
      )}

      {/* Bottom Name & Status Overlay */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-white shadow-sm">
          <span>{isLocal ? 'You' : participant.user?.name || 'Peer'}</span>
          {isLocal && <span className="text-[10px] text-cyan-300 font-mono">(Local)</span>}
          {participant.isScreenSharing && (
            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Sharing Screen
            </span>
          )}
        </div>

        {participant.isMuted && (
          <div className="p-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400">
            <MicOff className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function ActiveCallModal() {
  const {
    callStatus,
    callType,
    mediaType,
    targetUser,
    groupTitle,
    localStream,
    participants,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isMinimized,
    callDuration,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    setIsMinimized,
    endCall,
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if ((callStatus !== 'CONNECTED' && callStatus !== 'CALLING') || isMinimized) {
    return null;
  }

  const isCalling = callStatus === 'CALLING';
  const callTitle =
    callType === 'DIRECT'
      ? targetUser?.name || 'Developer'
      : groupTitle || 'Group Conference';

  const totalParticipants = participants.length + 1; // peers + self

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-5xl h-[86vh] max-h-[820px] rounded-3xl border border-white/10 bg-[#090d16] shadow-2xl flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200">
        {/* Top Header Bar */}
        <div className="h-14 border-b border-white/10 px-5 flex items-center justify-between shrink-0 bg-[#080c14]/80 backdrop-blur-md">
          {/* Left: Call Title & Participants */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 p-[1px]">
              <div className="w-full h-full bg-[#090d16] rounded-[11px] flex items-center justify-center">
                {mediaType === 'VIDEO' ? (
                  <Video className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white truncate">
                  {callTitle}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isCalling ? 'Calling...' : formatDuration(callDuration)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {callType === 'DIRECT' ? 'Direct Peer-to-Peer Call' : 'Project Channel Conference'}
              </p>
            </div>
          </div>

          {/* Right: Security info & Minimize */}
          <div className="flex items-center gap-2">
            <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>P2P WebRTC Encrypted</span>
            </div>

            {callType === 'GROUP' && (
              <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 font-mono">
                <Users className="w-3.5 h-3.5" />
                <span>{totalParticipants} in room</span>
              </div>
            )}

            {/* Minimize to PIP floating widget */}
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Minimize to floating window (continue browsing workspace)"
              aria-label="Minimize call"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Video Conference Area */}
        <div className="flex-1 p-4 overflow-hidden relative flex items-center justify-center bg-[#070a12]">
          {isCalling ? (
            /* Calling Ringing Screen */
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative mb-4">
                <div className="absolute -inset-4 rounded-full bg-indigo-500/20 animate-ping" />
                <div className="relative p-1 rounded-full bg-[#0c101c] border-2 border-indigo-500/40">
                  <Avatar
                    name={targetUser?.name || 'Developer'}
                    avatarUrl={targetUser?.avatarUrl}
                    size="lg"
                  />
                </div>
              </div>
              <h3 className="text-base font-semibold text-white">
                Calling {targetUser?.name || 'Developer'}...
              </h3>
              <p className="text-xs text-slate-400 mt-1">Waiting for them to answer</p>
            </div>
          ) : participants.length === 0 ? (
            /* Waiting for other members to join group call */
            <div className="w-full h-full relative flex items-center justify-center">
              {/* Local Participant Full View */}
              <ParticipantTile
                participant={{
                  socketId: 'local',
                  userId: 'local',
                  user: { id: 'local', name: 'You' },
                  stream: localStream || undefined,
                  isVideo: !isVideoOff,
                  isMuted,
                  isScreenSharing,
                }}
                isLocal
              />

              <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-xs text-slate-300 font-medium shadow-xl pointer-events-none">
                Waiting for other developers to join this call...
              </div>
            </div>
          ) : participants.length === 1 ? (
            /* 1-on-1 Layout (Large remote view + Corner Inset Local PIP) */
            <div className="w-full h-full relative">
              {/* Remote Peer Full View */}
              <ParticipantTile participant={participants[0]} />

              {/* Local Video Picture-in-Picture Inset in Corner */}
              <div className="absolute bottom-4 right-4 w-44 sm:w-56 aspect-video rounded-2xl overflow-hidden border border-white/20 shadow-2xl z-20 transition-all hover:scale-105">
                <ParticipantTile
                  participant={{
                    socketId: 'local',
                    userId: 'local',
                    user: { id: 'local', name: 'You' },
                    stream: localStream || undefined,
                    isVideo: !isVideoOff,
                    isMuted,
                    isScreenSharing,
                  }}
                  isLocal
                />
              </div>
            </div>
          ) : (
            /* Multi-Party Grid Layout for Group Calls (2 to 6+ participants) */
            <div
              className={`w-full h-full grid gap-3 ${
                totalParticipants <= 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : totalParticipants <= 4
                  ? 'grid-cols-2'
                  : 'grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {/* Local User Tile */}
              <ParticipantTile
                participant={{
                  socketId: 'local',
                  userId: 'local',
                  user: { id: 'local', name: 'You' },
                  stream: localStream || undefined,
                  isVideo: !isVideoOff,
                  isMuted,
                  isScreenSharing,
                }}
                isLocal
              />

              {/* Remote Participants */}
              {participants.map((peer) => (
                <ParticipantTile key={peer.socketId} participant={peer} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom Control Toolbar */}
        <div className="h-20 border-t border-white/10 px-6 flex items-center justify-center shrink-0 bg-[#080c14]/90 backdrop-blur-md">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Mic Toggle */}
            <button
              onClick={toggleMute}
              className={`p-3.5 rounded-2xl transition-all cursor-pointer flex items-center gap-2 shadow-lg ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Video Toggle */}
            <button
              onClick={toggleVideo}
              className={`p-3.5 rounded-2xl transition-all cursor-pointer flex items-center gap-2 shadow-lg ${
                isVideoOff
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
              }`}
              title={isVideoOff ? 'Start camera' : 'Stop camera'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            {/* Screen Share Toggle */}
            <button
              onClick={toggleScreenShare}
              className={`p-3.5 rounded-2xl transition-all cursor-pointer flex items-center gap-2 shadow-lg ${
                isScreenSharing
                  ? 'bg-indigo-600 text-white border border-indigo-400 shadow-indigo-500/30'
                  : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
              }`}
              title={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
            >
              <Monitor className="w-5 h-5" />
            </button>

            {/* End / Leave Call Button */}
            <button
              onClick={endCall}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-xl shadow-rose-600/30 flex items-center gap-2 text-sm font-semibold transition-all hover:scale-105 cursor-pointer ml-2"
              title="End / Leave Call"
            >
              <PhoneOff className="w-5 h-5" />
              <span>Leave Call</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
