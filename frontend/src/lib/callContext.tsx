'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { callAudio } from '@/lib/callAudio';

export type CallStatus = 'IDLE' | 'CALLING' | 'INCOMING' | 'CONNECTED';
export type CallType = 'DIRECT' | 'GROUP';
export type MediaType = 'VIDEO' | 'AUDIO';

export interface CallParticipant {
  socketId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
    headline?: string;
  };
  stream?: MediaStream;
  isVideo?: boolean;
  isMuted?: boolean;
  isScreenSharing?: boolean;
}

export interface ActiveCallSummary {
  participantCount: number;
  participants: CallParticipant[];
}

interface CallContextType {
  callStatus: CallStatus;
  callType: CallType;
  mediaType: MediaType;
  roomId: string | null;
  targetUser: any | null;
  callerUser: any | null;
  groupTitle: string | null;
  localStream: MediaStream | null;
  participants: CallParticipant[];
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isMinimized: boolean;
  callDuration: number;
  activeGroupCalls: Record<string, ActiveCallSummary>;

  // Call actions
  startDirectCall: (targetUser: any, isVideo: boolean) => Promise<void>;
  joinGroupCall: (projectId: string, channel: string, isVideo: boolean, groupTitle?: string) => Promise<void>;
  acceptCall: (withVideo?: boolean) => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  setIsMinimized: (minimized: boolean) => void;
}

const CallContext = createContext<CallContextType | null>(null);

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAppStore();

  const [callStatus, setCallStatus] = useState<CallStatus>('IDLE');
  const [callType, setCallType] = useState<CallType>('DIRECT');
  const [mediaType, setMediaType] = useState<MediaType>('VIDEO');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [targetUser, setTargetUser] = useState<any | null>(null);
  const [callerUser, setCallerUser] = useState<any | null>(null);
  const [groupTitle, setGroupTitle] = useState<string | null>(null);
  const [callerSocketId, setCallerSocketId] = useState<string | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const [activeGroupCalls, setActiveGroupCalls] = useState<Record<string, ActiveCallSummary>>({});

  // Refs for WebRTC state that shouldn't cause re-renders
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const socketRef = useRef<any | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // Connect to realtime socket for signaling
  useEffect(() => {
    if (!currentUser?.id) return;

    let socket: any = (window as any).__devconnect_socket;
    if (!socket) {
      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL ||
        (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')
          ? 'https://devconnect-a2wa.onrender.com'
          : 'http://localhost:3001');

      import('socket.io-client').then(({ io }) => {
        socket = io(socketUrl, {
          query: { userId: currentUser.id },
          transports: ['websocket', 'polling'],
        });
        (window as any).__devconnect_socket = socket;
        setupSocketListeners(socket);
        socketRef.current = socket;
      });
    } else {
      setupSocketListeners(socket);
      socketRef.current = socket;
    }

    function setupSocketListeners(s: any) {
      // 1. Incoming Call Event
      s.on('webrtc_incoming_call', (data: any) => {
        if (callStatus !== 'IDLE') {
          // Already on another call -> decline busy
          s.emit('webrtc_call_rejected', {
            toSocketId: data.callerSocketId,
            fromUser: currentUser,
            reason: 'busy',
          });
          return;
        }

        setCallerUser(data.callerUser);
        setCallerSocketId(data.callerSocketId);
        setRoomId(data.roomId);
        setCallType(data.callType || 'DIRECT');
        setMediaType(data.isVideo ? 'VIDEO' : 'AUDIO');
        setIsVideoOff(!data.isVideo);
        setGroupTitle(data.title || null);
        setCallStatus('INCOMING');
        setIsMinimized(false);

        callAudio.startIncomingRingtone();
      });

      // 2. Call Rejected
      s.on('webrtc_call_rejected', (data: any) => {
        callAudio.stopAll();
        callAudio.playEndChime();
        cleanupCall();
      });

      // 3. Existing peers in room
      s.on('webrtc_room_users', async (data: { roomId: string; participants: CallParticipant[] }) => {
        const existingPeers = data.participants || [];
        setParticipants(existingPeers);

        // Initiate WebRTC peer connection offer to each existing peer
        for (const peer of existingPeers) {
          await createPeerOffer(peer.socketId, peer.user);
        }
      });

      // 4. New peer joined room
      s.on('webrtc_user_joined', (data: { socketId: string; userId: string; user: any; isVideo?: boolean; isMuted?: boolean }) => {
        setParticipants((prev) => {
          if (prev.some((p) => p.socketId === data.socketId)) return prev;
          return [...prev, {
            socketId: data.socketId,
            userId: data.userId,
            user: data.user,
            isVideo: data.isVideo,
            isMuted: data.isMuted,
          }];
        });
      });

      // 5. Incoming WebRTC Signal (Offer or Answer)
      s.on('webrtc_signal', async (data: { fromSocketId: string; fromUser: any; signal: RTCSessionDescriptionInit }) => {
        const { fromSocketId, fromUser, signal } = data;
        let pc = peerConnectionsRef.current.get(fromSocketId);

        if (signal.type === 'offer') {
          if (!pc) {
            pc = createPeerConnection(fromSocketId, fromUser);
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          s.emit('webrtc_signal', {
            toSocketId: fromSocketId,
            signal: answer,
            fromUser: currentUser,
          });
        } else if (signal.type === 'answer') {
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
          }
        }
      });

      // 6. Incoming ICE Candidate
      s.on('webrtc_ice_candidate', async (data: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
        const pc = peerConnectionsRef.current.get(data.fromSocketId);
        if (pc && data.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch {}
        }
      });

      // 7. Peer Media Toggled (Mute / Video / Screen Share)
      s.on('webrtc_peer_media_toggled', (data: { socketId: string; isMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean }) => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.socketId === data.socketId
              ? {
                  ...p,
                  isMuted: data.isMuted !== undefined ? data.isMuted : p.isMuted,
                  isVideo: data.isVideoOff !== undefined ? !data.isVideoOff : p.isVideo,
                  isScreenSharing: data.isScreenSharing !== undefined ? data.isScreenSharing : p.isScreenSharing,
                }
              : p
          )
        );
      });

      // 8. Peer Left Room
      s.on('webrtc_user_left', (data: { socketId: string; userId: string; roomId: string }) => {
        const pc = peerConnectionsRef.current.get(data.socketId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(data.socketId);
        }
        setParticipants((prev) => prev.filter((p) => p.socketId !== data.socketId));

        // If in a 1-on-1 call and other user leaves, end the call
        if (callType === 'DIRECT') {
          endCall();
        }
      });

      // 9. Active call rooms status update across workspace
      s.on('webrtc_room_status_changed', (data: { roomId: string; participantCount: number; participants: CallParticipant[] }) => {
        setActiveGroupCalls((prev) => ({
          ...prev,
          [data.roomId]: {
            participantCount: data.participantCount,
            participants: data.participants,
          },
        }));
      });

      s.on('webrtc_active_rooms_list', (data: Record<string, ActiveCallSummary>) => {
        setActiveGroupCalls(data || {});
      });

      // Query active rooms on start
      s.emit('webrtc_get_active_rooms');
    }

    return () => {
      // Cleanup on unmount
    };
  }, [currentUser?.id, callStatus, callType]);

  // Duration timer
  useEffect(() => {
    if (callStatus === 'CONNECTED') {
      setCallDuration(0);
      durationTimerRef.current = setInterval(() => {
        setCallDuration((c) => c + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [callStatus]);

  // Create WebRTC Peer Connection
  const createPeerConnection = (targetSocketId: string, peerUser: any): RTCPeerConnection => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc_ice_candidate', {
          toSocketId: targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Track received handler (remote audio/video stream)
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setParticipants((prev) => {
          const existing = prev.find((p) => p.socketId === targetSocketId);
          if (existing) {
            return prev.map((p) =>
              p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p
            );
          }
          return [
            ...prev,
            {
              socketId: targetSocketId,
              userId: peerUser?.id || '',
              user: peerUser,
              stream: remoteStream,
              isVideo: true,
              isMuted: false,
            },
          ];
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        callAudio.stopAll();
        callAudio.playConnectChime();
        setCallStatus('CONNECTED');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        peerConnectionsRef.current.delete(targetSocketId);
      }
    };

    peerConnectionsRef.current.set(targetSocketId, pc);
    return pc;
  };

  // Create Peer Offer
  const createPeerOffer = async (targetSocketId: string, peerUser: any) => {
    try {
      const pc = createPeerConnection(targetSocketId, peerUser);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current?.emit('webrtc_signal', {
        toSocketId: targetSocketId,
        signal: offer,
        fromUser: currentUser,
      });
    } catch (err) {
      console.error('Error creating peer offer:', err);
    }
  };

  // Get User Media Stream
  const acquireLocalMedia = async (videoRequired: boolean): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: videoRequired
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            }
          : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsVideoOff(!videoRequired);
      return stream;
    } catch (err) {
      console.warn('Could not access requested media devices, falling back to audio-only:', err);
      // Fallback to audio only if camera is unavailable or denied
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsVideoOff(true);
      return stream;
    }
  };

  // 1. Start Direct 1-on-1 Call
  const startDirectCall = async (target: any, isVideo: boolean) => {
    if (!target?.id || !currentUser?.id) return;

    try {
      const sortedIds = [currentUser.id, target.id].sort();
      const directRoomId = `direct_${sortedIds[0]}_${sortedIds[1]}`;

      setCallStatus('CALLING');
      setCallType('DIRECT');
      setMediaType(isVideo ? 'VIDEO' : 'AUDIO');
      setTargetUser(target);
      setRoomId(directRoomId);
      setIsMinimized(false);

      callAudio.startOutgoingRingtone();
      await acquireLocalMedia(isVideo);

      socketRef.current?.emit('webrtc_call_user', {
        userToCall: target.id,
        fromUser: currentUser,
        isVideo,
        roomId: directRoomId,
        callType: 'DIRECT',
        title: `${currentUser.name} (Direct)`,
      });

      socketRef.current?.emit('webrtc_join_room', {
        roomId: directRoomId,
        user: currentUser,
        isVideo,
        isMuted: false,
      });
    } catch (err) {
      console.error('Failed to start direct call:', err);
      cleanupCall();
    }
  };

  // 2. Start or Join Group / Channel Call
  const joinGroupCall = async (
    projectId: string,
    channel: string,
    isVideo: boolean,
    title?: string
  ) => {
    if (!projectId || !currentUser?.id) return;

    try {
      const groupRoomId = `group_${projectId}_${channel || 'general'}`;

      setCallStatus('CONNECTED');
      setCallType('GROUP');
      setMediaType(isVideo ? 'VIDEO' : 'AUDIO');
      setGroupTitle(title || `#${channel || 'general'}`);
      setRoomId(groupRoomId);
      setIsMinimized(false);

      callAudio.playConnectChime();
      await acquireLocalMedia(isVideo);

      socketRef.current?.emit('webrtc_join_room', {
        roomId: groupRoomId,
        user: currentUser,
        isVideo,
        isMuted: false,
      });
    } catch (err) {
      console.error('Failed to join group call:', err);
      cleanupCall();
    }
  };

  // 3. Accept Incoming Call
  const acceptCall = async (withVideo?: boolean) => {
    callAudio.stopAll();
    const useVideo = withVideo !== undefined ? withVideo : mediaType === 'VIDEO';

    try {
      setCallStatus('CONNECTED');
      setMediaType(useVideo ? 'VIDEO' : 'AUDIO');
      setIsVideoOff(!useVideo);

      callAudio.playConnectChime();
      await acquireLocalMedia(useVideo);

      if (roomId) {
        socketRef.current?.emit('webrtc_join_room', {
          roomId,
          user: currentUser,
          isVideo: useVideo,
          isMuted: false,
        });
      }
    } catch (err) {
      console.error('Failed to accept call:', err);
      rejectCall();
    }
  };

  // 4. Reject Incoming Call
  const rejectCall = () => {
    callAudio.stopAll();
    if (callerSocketId || callerUser?.id) {
      socketRef.current?.emit('webrtc_call_rejected', {
        toSocketId: callerSocketId,
        toUserId: callerUser?.id,
        fromUser: currentUser,
        reason: 'declined',
      });
    }
    cleanupCall();
  };

  // 5. End / Leave Active Call
  const endCall = () => {
    callAudio.stopAll();
    callAudio.playEndChime();

    if (roomIdRef.current && socketRef.current) {
      socketRef.current.emit('webrtc_leave_room', { roomId: roomIdRef.current });
    }

    cleanupCall();
  };

  const cleanupCall = () => {
    // Stop local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    setLocalStream(null);
    setParticipants([]);
    setCallStatus('IDLE');
    setRoomId(null);
    setTargetUser(null);
    setCallerUser(null);
    setGroupTitle(null);
    setCallerSocketId(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setIsMinimized(false);
    setCallDuration(0);
  };

  // Controls: Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const newMuted = !isMuted;
      audioTracks.forEach((t) => (t.enabled = !newMuted));
      setIsMuted(newMuted);

      if (roomIdRef.current && socketRef.current) {
        socketRef.current.emit('webrtc_media_toggle', {
          roomId: roomIdRef.current,
          isMuted: newMuted,
        });
      }
    }
  };

  // Controls: Video On/Off
  const toggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const newVideoOff = !isVideoOff;
        videoTracks.forEach((t) => (t.enabled = !newVideoOff));
        setIsVideoOff(newVideoOff);

        if (roomIdRef.current && socketRef.current) {
          socketRef.current.emit('webrtc_media_toggle', {
            roomId: roomIdRef.current,
            isVideoOff: newVideoOff,
          });
        }
      } else {
        // If camera track doesn't exist yet, request one
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          const newTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newTrack);

          // Add to all peer connections
          peerConnectionsRef.current.forEach((pc) => {
            pc.addTrack(newTrack, localStreamRef.current!);
          });

          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
          setIsVideoOff(false);

          if (roomIdRef.current && socketRef.current) {
            socketRef.current.emit('webrtc_media_toggle', {
              roomId: roomIdRef.current,
              isVideoOff: false,
            });
          }
        } catch (err) {
          console.warn('Could not activate camera:', err);
        }
      }
    }
  };

  // Controls: Screen Share
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert back to camera
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }

      if (originalVideoTrackRef.current && localStreamRef.current) {
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender && originalVideoTrackRef.current) {
            sender.replaceTrack(originalVideoTrackRef.current);
          }
        });
      }
      setIsScreenSharing(false);

      if (roomIdRef.current && socketRef.current) {
        socketRef.current.emit('webrtc_media_toggle', {
          roomId: roomIdRef.current,
          isScreenSharing: false,
        });
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        if (localStreamRef.current) {
          originalVideoTrackRef.current = localStreamRef.current.getVideoTracks()[0] || null;

          // Replace video track across all peer connections
          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack);
            }
          });
        }

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);

        if (roomIdRef.current && socketRef.current) {
          socketRef.current.emit('webrtc_media_toggle', {
            roomId: roomIdRef.current,
            isScreenSharing: true,
          });
        }
      } catch (err) {
        console.warn('Screen share cancelled or denied:', err);
      }
    }
  };

  return (
    <CallContext.Provider
      value={{
        callStatus,
        callType,
        mediaType,
        roomId,
        targetUser,
        callerUser,
        groupTitle,
        localStream,
        participants,
        isMuted,
        isVideoOff,
        isScreenSharing,
        isMinimized,
        callDuration,
        activeGroupCalls,
        startDirectCall,
        joinGroupCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
        setIsMinimized,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCallStore() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallStore must be used within a CallProvider');
  }
  return context;
}

export const useCall = useCallStore;

