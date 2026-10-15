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
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 10,
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

  // Synchronized refs to avoid listener staleness and prevent infinite re-registration
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const queuedCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const socketRef = useRef<any | null>(null);

  const callStatusRef = useRef<CallStatus>(callStatus);
  const callTypeRef = useRef<CallType>(callType);
  const roomIdRef = useRef<string | null>(roomId);
  const currentUserRef = useRef<any>(currentUser);
  const participantsRef = useRef<CallParticipant[]>(participants);
  const targetUserRef = useRef<any>(targetUser);
  const callerSocketIdRef = useRef<string | null>(callerSocketId);
  const callerUserRef = useRef<any>(callerUser);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    targetUserRef.current = targetUser;
  }, [targetUser]);

  useEffect(() => {
    callerSocketIdRef.current = callerSocketId;
  }, [callerSocketId]);

  useEffect(() => {
    callerUserRef.current = callerUser;
  }, [callerUser]);

  // Duration timer when connected
  useEffect(() => {
    if (callStatus === 'CONNECTED') {
      setCallDuration(0);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
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

  // Flush queued ICE candidates after remote description is set
  const flushQueuedCandidates = async (socketId: string, pc: RTCPeerConnection) => {
    const queue = queuedCandidatesRef.current.get(socketId);
    if (queue && queue.length > 0) {
      queuedCandidatesRef.current.delete(socketId);
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(`[WebRTC] Failed to add queued ICE candidate for ${socketId}:`, err);
        }
      }
    }
  };

  // Safe acquisition / retrieval of Peer Connection
  const getOrCreatePeerConnection = (targetSocketId: string, peerUser: any): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get(targetSocketId);
    if (pc && pc.signalingState !== 'closed') {
      // Ensure local tracks are attached if they weren't yet
      if (localStreamRef.current) {
        const senders = pc.getSenders();
        localStreamRef.current.getTracks().forEach((track) => {
          if (!senders.some((s) => s.track === track)) {
            try {
              pc!.addTrack(track, localStreamRef.current!);
            } catch {}
          }
        });
      }
      return pc;
    }

    pc = new RTCPeerConnection(RTC_CONFIG);

    // Attach local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStreamRef.current!);
        } catch {}
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc_ice_candidate', {
          toSocketId: targetSocketId,
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        });
      }
    };

    // Remote Track handler
    pc.ontrack = (event) => {
      const remoteStream =
        event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);

      if (event.track.kind === 'video') {
        event.track.onmute = () => {
          setParticipants((prev) =>
            prev.map((p) => (p.socketId === targetSocketId ? { ...p, isVideo: false } : p))
          );
        };
        event.track.onunmute = () => {
          setParticipants((prev) =>
            prev.map((p) => (p.socketId === targetSocketId ? { ...p, isVideo: true } : p))
          );
        };
      }

      setParticipants((prev) => {
        const existing = prev.find((p) => p.socketId === targetSocketId);
        if (existing) {
          return prev.map((p) =>
            p.socketId === targetSocketId
              ? {
                  ...p,
                  stream: remoteStream,
                  isVideo: event.track.kind === 'video' ? !event.track.muted : p.isVideo,
                }
              : p
          );
        }
        return [
          ...prev,
          {
            socketId: targetSocketId,
            userId: peerUser?.id || '',
            user: peerUser,
            stream: remoteStream,
            isVideo: event.track.kind === 'video' ? !event.track.muted : true,
            isMuted: false,
          },
        ];
      });
    };

    // Connection state monitor
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC] Peer ${targetSocketId} connectionState:`, state);

      if (state === 'connected') {
        callAudio.stopAll();
        callAudio.playConnectChime();
        setCallStatus('CONNECTED');
      } else if (state === 'failed') {
        console.warn(`[WebRTC] Peer ${targetSocketId} connection failed. Trying ICE restart.`);
        tryIceRestart(targetSocketId, peerUser);
      } else if (state === 'closed') {
        peerConnectionsRef.current.delete(targetSocketId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      console.log(`[WebRTC] Peer ${targetSocketId} iceConnectionState:`, iceState);

      if (iceState === 'connected' || iceState === 'completed') {
        callAudio.stopAll();
        setCallStatus('CONNECTED');
      } else if (iceState === 'failed') {
        tryIceRestart(targetSocketId, peerUser);
      }
    };

    peerConnectionsRef.current.set(targetSocketId, pc);
    return pc;
  };

  // ICE Restart helper
  const tryIceRestart = async (targetSocketId: string, peerUser: any) => {
    const pc = peerConnectionsRef.current.get(targetSocketId);
    if (!pc || pc.signalingState === 'closed') return;
    try {
      await createPeerOffer(targetSocketId, peerUser, true);
    } catch (err) {
      console.warn(`[WebRTC] ICE restart error for ${targetSocketId}:`, err);
    }
  };

  // Create Peer Offer with Perfect Negotiation glare protection
  const createPeerOffer = async (targetSocketId: string, peerUser: any, isRestart = false) => {
    try {
      const pc = getOrCreatePeerConnection(targetSocketId, peerUser);
      makingOfferRef.current.set(targetSocketId, true);

      const offer = await pc.createOffer(isRestart ? { iceRestart: true } : undefined);
      if (pc.signalingState !== 'stable') {
        console.warn(`[WebRTC] Skipping setLocalDescription: PC state is ${pc.signalingState}`);
        return;
      }
      await pc.setLocalDescription(offer);

      socketRef.current?.emit('webrtc_signal', {
        toSocketId: targetSocketId,
        signal: pc.localDescription,
        fromUser: currentUserRef.current,
      });
    } catch (err) {
      console.error(`[WebRTC] Error creating offer to ${targetSocketId}:`, err);
    } finally {
      makingOfferRef.current.set(targetSocketId, false);
    }
  };

  // Cleanup all call resources
  const cleanupCall = useCallback(() => {
    callAudio.stopAll();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    originalVideoTrackRef.current = null;

    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    peerConnectionsRef.current.clear();
    queuedCandidatesRef.current.clear();
    makingOfferRef.current.clear();
    ignoreOfferRef.current.clear();

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
  }, []);

  // End or Leave Active Call
  const endCall = useCallback(() => {
    callAudio.stopAll();
    callAudio.playEndChime();

    if (roomIdRef.current && socketRef.current) {
      socketRef.current.emit('webrtc_leave_room', { roomId: roomIdRef.current });
    }

    cleanupCall();
  }, [cleanupCall]);

  // Reject Incoming Call
  const rejectCall = useCallback(() => {
    callAudio.stopAll();
    if (callerSocketIdRef.current || callerUserRef.current?.id) {
      socketRef.current?.emit('webrtc_call_rejected', {
        toSocketId: callerSocketIdRef.current,
        toUserId: callerUserRef.current?.id,
        fromUser: currentUserRef.current,
        reason: 'declined',
      });
    }
    cleanupCall();
  }, [cleanupCall]);

  // Realtime Socket Event Listeners Setup
  useEffect(() => {
    if (!currentUser?.id) return;

    let socket: any = (window as any).__devconnect_socket;
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      (typeof window !== 'undefined' &&
      !window.location.hostname.includes('localhost') &&
      !window.location.hostname.includes('127.0.0.1')
        ? 'https://devconnect-a2wa.onrender.com'
        : 'http://localhost:3001');

    let isMounted = true;

    // Define individual event handlers using synchronous refs
    const onIncomingCall = (data: any) => {
      // Exclude calls originated from our own socket
      if (data.callerSocketId === socketRef.current?.id) return;

      if (callStatusRef.current !== 'IDLE') {
        socketRef.current?.emit('webrtc_call_rejected', {
          toSocketId: data.callerSocketId,
          fromUser: currentUserRef.current,
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
    };

    const onCallRejected = (data: any) => {
      // Only tear down if we were actively awaiting an answer
      if (callStatusRef.current === 'CALLING') {
        callAudio.stopAll();
        callAudio.playEndChime();
        cleanupCall();
      }
    };

    const onRoomUsers = async (data: { roomId: string; participants: CallParticipant[] }) => {
      if (data.roomId && roomIdRef.current && data.roomId !== roomIdRef.current) return;
      const existingPeers = data.participants || [];
      setParticipants(existingPeers);

      // Offer to each existing peer in the room
      for (const peer of existingPeers) {
        if (peer.socketId === socketRef.current?.id) continue;
        await createPeerOffer(peer.socketId, peer.user);
      }
    };

    const onUserJoined = (data: {
      socketId: string;
      userId: string;
      user: any;
      isVideo?: boolean;
      isMuted?: boolean;
    }) => {
      if (data.socketId === socketRef.current?.id) return;

      setParticipants((prev) => {
        if (prev.some((p) => p.socketId === data.socketId)) return prev;
        return [
          ...prev,
          {
            socketId: data.socketId,
            userId: data.userId,
            user: data.user,
            isVideo: data.isVideo,
            isMuted: data.isMuted,
          },
        ];
      });
    };

    const onSignal = async (data: {
      fromSocketId: string;
      fromUser: any;
      signal: RTCSessionDescriptionInit;
    }) => {
      const { fromSocketId, fromUser, signal } = data;
      if (!signal || !signal.type) return;

      const pc = getOrCreatePeerConnection(fromSocketId, fromUser);
      const myId = socketRef.current?.id || currentUserRef.current?.id || '';
      const isPolite = myId.localeCompare(fromSocketId) < 0;
      const isMakingOffer = makingOfferRef.current.get(fromSocketId) || false;

      try {
        if (signal.type === 'offer') {
          const offerCollision = isMakingOffer || pc.signalingState !== 'stable';
          ignoreOfferRef.current.set(fromSocketId, !isPolite && offerCollision);

          if (!isPolite && offerCollision) {
            console.warn(`[WebRTC] Glare offer collision with ${fromSocketId}. Impolite peer ignoring offer.`);
            return;
          }

          if (offerCollision) {
            console.log(`[WebRTC] Glare offer collision with ${fromSocketId}. Polite peer rolling back.`);
            await pc.setLocalDescription({ type: 'rollback' });
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          await flushQueuedCandidates(fromSocketId, pc);

          if (pc.signalingState === 'have-remote-offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socketRef.current?.emit('webrtc_signal', {
              toSocketId: fromSocketId,
              signal: pc.localDescription,
              fromUser: currentUserRef.current,
            });
          }
        } else if (signal.type === 'answer') {
          const isIgnoring = ignoreOfferRef.current.get(fromSocketId) || false;
          if (isIgnoring) {
            console.log(`[WebRTC] Ignoring answer from ${fromSocketId} due to prior offer collision ignore.`);
            return;
          }

          // Remote answer is ONLY valid when state is have-local-offer
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
            await flushQueuedCandidates(fromSocketId, pc);
          } else {
            console.log(
              `[WebRTC] Safely ignoring answer from ${fromSocketId}; state is already '${pc.signalingState}'`
            );
          }
        }
      } catch (err: any) {
        console.error(`[WebRTC] Error handling signal (${signal.type}) from ${fromSocketId}:`, err);
      }
    };

    const onIceCandidate = async (data: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
      const { fromSocketId, candidate } = data;
      if (!candidate) return;

      const pc = peerConnectionsRef.current.get(fromSocketId);
      if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
        // Queue until remote description is established
        const queue = queuedCandidatesRef.current.get(fromSocketId) || [];
        queue.push(candidate);
        queuedCandidatesRef.current.set(fromSocketId, queue);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        const isIgnoring = ignoreOfferRef.current.get(fromSocketId);
        if (!isIgnoring) {
          console.warn(`[WebRTC] Error adding ICE candidate from ${fromSocketId}:`, err);
        }
      }
    };

    const onPeerMediaToggled = (data: {
      socketId: string;
      isMuted?: boolean;
      isVideoOff?: boolean;
      isScreenSharing?: boolean;
    }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.socketId === data.socketId
            ? {
                ...p,
                isMuted: data.isMuted !== undefined ? data.isMuted : p.isMuted,
                isVideo: data.isVideoOff !== undefined ? !data.isVideoOff : p.isVideo,
                isScreenSharing:
                  data.isScreenSharing !== undefined ? data.isScreenSharing : p.isScreenSharing,
              }
            : p
        )
      );
    };

    const onUserLeft = (data: { socketId: string; userId: string; roomId: string }) => {
      if (data.roomId && roomIdRef.current && data.roomId !== roomIdRef.current) return;

      const pc = peerConnectionsRef.current.get(data.socketId);
      if (pc) {
        try {
          pc.close();
        } catch {}
        peerConnectionsRef.current.delete(data.socketId);
      }
      queuedCandidatesRef.current.delete(data.socketId);
      makingOfferRef.current.delete(data.socketId);
      ignoreOfferRef.current.delete(data.socketId);

      setParticipants((prev) => {
        const updated = prev.filter((p) => p.socketId !== data.socketId);
        // If in direct 1-on-1 and other peer left, end the call
        if (callTypeRef.current === 'DIRECT' && callStatusRef.current !== 'IDLE') {
          endCall();
        }
        return updated;
      });
    };

    const onRoomStatusChanged = (data: {
      roomId: string;
      participantCount: number;
      participants: CallParticipant[];
    }) => {
      setActiveGroupCalls((prev) => ({
        ...prev,
        [data.roomId]: {
          participantCount: data.participantCount,
          participants: data.participants,
        },
      }));
    };

    const onActiveRoomsList = (data: Record<string, ActiveCallSummary>) => {
      setActiveGroupCalls(data || {});
    };

    const bindListeners = (s: any) => {
      // Remove any previously registered handlers to ensure exactly 1 active listener per event
      s.off('webrtc_incoming_call', onIncomingCall);
      s.off('webrtc_call_rejected', onCallRejected);
      s.off('webrtc_room_users', onRoomUsers);
      s.off('webrtc_user_joined', onUserJoined);
      s.off('webrtc_signal', onSignal);
      s.off('webrtc_ice_candidate', onIceCandidate);
      s.off('webrtc_peer_media_toggled', onPeerMediaToggled);
      s.off('webrtc_user_left', onUserLeft);
      s.off('webrtc_room_status_changed', onRoomStatusChanged);
      s.off('webrtc_active_rooms_list', onActiveRoomsList);

      s.on('webrtc_incoming_call', onIncomingCall);
      s.on('webrtc_call_rejected', onCallRejected);
      s.on('webrtc_room_users', onRoomUsers);
      s.on('webrtc_user_joined', onUserJoined);
      s.on('webrtc_signal', onSignal);
      s.on('webrtc_ice_candidate', onIceCandidate);
      s.on('webrtc_peer_media_toggled', onPeerMediaToggled);
      s.on('webrtc_user_left', onUserLeft);
      s.on('webrtc_room_status_changed', onRoomStatusChanged);
      s.on('webrtc_active_rooms_list', onActiveRoomsList);

      s.emit('webrtc_get_active_rooms');
    };

    const unbindListeners = (s: any) => {
      s.off('webrtc_incoming_call', onIncomingCall);
      s.off('webrtc_call_rejected', onCallRejected);
      s.off('webrtc_room_users', onRoomUsers);
      s.off('webrtc_user_joined', onUserJoined);
      s.off('webrtc_signal', onSignal);
      s.off('webrtc_ice_candidate', onIceCandidate);
      s.off('webrtc_peer_media_toggled', onPeerMediaToggled);
      s.off('webrtc_user_left', onUserLeft);
      s.off('webrtc_room_status_changed', onRoomStatusChanged);
      s.off('webrtc_active_rooms_list', onActiveRoomsList);
    };

    if (!socket) {
      import('socket.io-client').then(({ io }) => {
        if (!isMounted) return;
        socket = io(socketUrl, {
          query: { userId: currentUser.id },
          transports: ['websocket', 'polling'],
        });
        (window as any).__devconnect_socket = socket;
        socketRef.current = socket;
        bindListeners(socket);
      });
    } else {
      socketRef.current = socket;
      bindListeners(socket);
    }

    return () => {
      isMounted = false;
      if (socket) {
        unbindListeners(socket);
      }
    };
  }, [currentUser?.id, endCall, cleanupCall]);

  // Media acquisition helper
  const acquireLocalMedia = async (videoRequired: boolean): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });

      if (!videoRequired) {
        stream.getVideoTracks().forEach((t) => (t.enabled = false));
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsVideoOff(!videoRequired);
      return stream;
    } catch (err) {
      console.warn('Camera access denied or unavailable, attempting audio-only:', err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsMuted(false);
        setIsVideoOff(true);
        return stream;
      } catch (err2) {
        console.error('Failed to get any audio or video stream:', err2);
        throw err2;
      }
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

  // 2. Start or Join Group Call
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

  // Controls: Video
  const toggleVideo = async () => {
    if (localStreamRef.current) {
      let videoTrack = localStreamRef.current.getVideoTracks()[0];
      const newVideoOff = !isVideoOff;

      if (!videoTrack && !newVideoOff) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          });
          videoTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(videoTrack);

          for (const [targetSocketId, pc] of peerConnectionsRef.current.entries()) {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              await sender.replaceTrack(videoTrack);
            } else {
              pc.addTrack(videoTrack, localStreamRef.current!);
              const targetPeer = participantsRef.current.find((p) => p.socketId === targetSocketId);
              await createPeerOffer(targetSocketId, targetPeer?.user);
            }
          }
        } catch (err) {
          console.warn('Could not activate camera:', err);
          return;
        }
      } else if (videoTrack) {
        videoTrack.enabled = !newVideoOff;
      }

      setIsVideoOff(newVideoOff);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

      if (roomIdRef.current && socketRef.current) {
        socketRef.current.emit('webrtc_media_toggle', {
          roomId: roomIdRef.current,
          isVideoOff: newVideoOff,
        });
      }
    }
  };

  // Controls: Screen Share
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
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
