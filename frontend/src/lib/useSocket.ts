'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message, UserStatus } from './types';

const SOCKET_SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

export function useRealtimeSocket(params: {
  userId: string;
  userName?: string;
  conversationId?: string | null;
  onNewMessage?: (msg: Message) => void;
  onMessageEdited?: (data: { messageId: string; content: string }) => void;
  onMessageDeleted?: (data: { messageId: string }) => void;
  onReactionUpdated?: (data: { messageId: string; emoji: string; reactions: any[] }) => void;
  onUserTyping?: (data: { userId: string; userName: string; isTyping: boolean }) => void;
  onPresenceUpdated?: (data: { userId: string; status: UserStatus }) => void;
}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    userId,
    userName = 'Developer',
    conversationId,
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    onReactionUpdated,
    onUserTyping,
    onPresenceUpdated,
  } = params;

  // Initialize Socket connection
  useEffect(() => {
    if (!userId) return;

    const socket = io(SOCKET_SERVER_URL, {
      query: { userId },
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      if (conversationId) {
        socket.emit('join_conversation', { conversationId, userId });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('new_message', (msg: Message) => {
      if (onNewMessage) onNewMessage(msg);
    });

    socket.on('message_edited', (data: { messageId: string; content: string }) => {
      if (onMessageEdited) onMessageEdited(data);
    });

    socket.on('message_deleted', (data: { messageId: string }) => {
      if (onMessageDeleted) onMessageDeleted(data);
    });

    socket.on('reaction_updated', (data: { messageId: string; emoji: string; reactions: any[] }) => {
      if (onReactionUpdated) onReactionUpdated(data);
    });

    socket.on('user_typing_start', (data: { userId: string; userName: string }) => {
      if (onUserTyping && data.userId !== userId) {
        onUserTyping({ ...data, isTyping: true });
      }
    });

    socket.on('user_typing_stop', (data: { userId: string }) => {
      if (onUserTyping && data.userId !== userId) {
        onUserTyping({ userId: data.userId, userName: '', isTyping: false });
      }
    });

    socket.on('presence_updated', (data: { userId: string; status: UserStatus }) => {
      if (onPresenceUpdated) onPresenceUpdated(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  // Handle active room switching
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && socket.connected && conversationId) {
      socket.emit('join_conversation', { conversationId, userId });

      return () => {
        socket.emit('leave_conversation', { conversationId });
      };
    }
  }, [conversationId, userId]);

  // Emitters
  const emitTyping = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !conversationId) return;

    socket.emit('typing_start', {
      conversationId,
      userId,
      userName,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', {
        conversationId,
        userId,
      });
    }, 2000);
  }, [conversationId, userId, userName]);

  const emitStopTyping = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !conversationId) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    socket.emit('typing_stop', {
      conversationId,
      userId,
    });
  }, [conversationId, userId]);

  const emitSendMessage = useCallback(
    (messageData: {
      content: string;
      messageType?: string;
      replyToMessageId?: string;
      codeLanguage?: string;
      codeFilename?: string;
      projectId?: string;
      channel?: string;
    }) => {
      const socket = socketRef.current;
      if (!socket || !conversationId) return;

      socket.emit('send_message', {
        conversationId,
        senderId: userId,
        ...messageData,
      });
    },
    [conversationId, userId]
  );

  const emitReaction = useCallback(
    (messageId: string, emoji: string) => {
      const socket = socketRef.current;
      if (!socket || !conversationId) return;

      socket.emit('add_reaction', {
        messageId,
        conversationId,
        userId,
        emoji,
      });
    },
    [conversationId, userId]
  );

  const emitEditMessage = useCallback(
    (messageId: string, content: string) => {
      const socket = socketRef.current;
      if (!socket || !conversationId) return;

      socket.emit('edit_message', {
        messageId,
        conversationId,
        userId,
        content,
      });
    },
    [conversationId, userId]
  );

  const emitDeleteMessage = useCallback(
    (messageId: string) => {
      const socket = socketRef.current;
      if (!socket || !conversationId) return;

      socket.emit('delete_message', {
        messageId,
        conversationId,
        userId,
      });
    },
    [conversationId, userId]
  );

  return {
    isConnected,
    emitTyping,
    emitStopTyping,
    emitSendMessage,
    emitReaction,
    emitEditMessage,
    emitDeleteMessage,
  };
}
