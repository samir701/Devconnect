import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

export interface ServerToClientEvents {
  new_message: (message: any) => void;
  message_edited: (data: { messageId: string; conversationId: string; content: string; isEdited: boolean }) => void;
  message_deleted: (data: { messageId: string; conversationId: string }) => void;
  reaction_updated: (data: { messageId: string; conversationId: string; emoji: string; userId: string; action: 'ADDED' | 'REMOVED'; reactions: any[] }) => void;
  user_typing_start: (data: { conversationId: string; userId: string; userName: string }) => void;
  user_typing_stop: (data: { conversationId: string; userId: string }) => void;
  presence_updated: (data: { userId: string; status: 'ONLINE' | 'AWAY' | 'OFFLINE'; lastSeen?: string }) => void;
  joined_conversation: (data: { conversationId: string }) => void;
  left_conversation: (data: { conversationId: string }) => void;
  error_event: (error: { message: string }) => void;
}

export interface ClientToServerEvents {
  join_conversation: (data: { conversationId: string; userId: string; projectId?: string }) => void;
  leave_conversation: (data: { conversationId: string }) => void;
  send_message: (data: {
    conversationId: string;
    projectId?: string;
    channel?: string;
    senderId: string;
    content: string;
    messageType?: string;
    replyToMessageId?: string;
    codeLanguage?: string;
    codeFilename?: string;
  }) => void;
  edit_message: (data: { messageId: string; conversationId: string; userId: string; content: string }) => void;
  delete_message: (data: { messageId: string; conversationId: string; userId: string }) => void;
  add_reaction: (data: { messageId: string; conversationId: string; userId: string; emoji: string }) => void;
  remove_reaction: (data: { messageId: string; conversationId: string; userId: string; emoji: string }) => void;
  typing_start: (data: { conversationId: string; userId: string; userName: string }) => void;
  typing_stop: (data: { conversationId: string; userId: string }) => void;
  user_presence: (data: { userId: string; status: 'ONLINE' | 'AWAY' | 'OFFLINE' }) => void;
}

export interface SocketData {
  userId?: string;
  userName?: string;
}

// In-Memory Ephemeral Presence State (Zero database spam on heartbeats)
const activeSocketsByUser = new Map<string, Set<string>>();
const userPresenceMap = new Map<string, 'ONLINE' | 'AWAY' | 'OFFLINE'>();

export function setupWebSocketServer(httpServer: HttpServer, prisma: PrismaClient) {
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    httpServer,
    {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      pingTimeout: 20000,
      pingInterval: 10000,
    }
  );

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>) => {
    const rawUserId = socket.handshake.query.userId as string | undefined;
    const userId = rawUserId || 'user_samir';
    socket.data.userId = userId;

    // Track active connection
    if (!activeSocketsByUser.has(userId)) {
      activeSocketsByUser.set(userId, new Set());
    }
    activeSocketsByUser.get(userId)!.add(socket.id);
    userPresenceMap.set(userId, 'ONLINE');

    // Broadcast user presence
    io.emit('presence_updated', { userId, status: 'ONLINE' });

    // 1. Join Conversation Room
    socket.on('join_conversation', async ({ conversationId, userId: joinUserId }) => {
      try {
        const roomName = `conv:${conversationId}`;
        socket.join(roomName);
        socket.emit('joined_conversation', { conversationId });
      } catch (err: any) {
        socket.emit('error_event', { message: err?.message || 'Failed to join conversation' });
      }
    });

    // 2. Leave Conversation Room
    socket.on('leave_conversation', ({ conversationId }) => {
      const roomName = `conv:${conversationId}`;
      socket.leave(roomName);
      socket.emit('left_conversation', { conversationId });
    });

    // 3. Send Message
    socket.on('send_message', async (payload) => {
      try {
        const { conversationId, senderId, content, messageType = 'TEXT', replyToMessageId, projectId, channel } = payload;
        if (!content || !conversationId) return;

        // Persist message to TiDB via Prisma
        let createdMessage: any = null;
        try {
          createdMessage = await prisma.message.create({
            data: {
              conversationId,
              projectId: projectId || null,
              channel: channel || 'general',
              senderId: senderId || userId,
              content: content.trim(),
              messageType,
              replyToMessageId: replyToMessageId || null,
            },
            include: {
              sender: {
                select: { id: true, name: true, avatarUrl: true, headline: true, status: true },
              },
              replyTo: {
                select: { id: true, content: true, sender: { select: { name: true } } },
              },
            },
          });
        } catch (dbErr) {
          // In-memory fallback format if DB unavailable
          createdMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            conversationId,
            projectId,
            channel,
            senderId: senderId || userId,
            content: content.trim(),
            messageType,
            replyToMessageId,
            createdAt: new Date().toISOString(),
            reactions: [],
          };
        }

        const roomName = `conv:${conversationId}`;
        io.to(roomName).emit('new_message', createdMessage);
      } catch (err: any) {
        socket.emit('error_event', { message: err?.message || 'Failed to send message' });
      }
    });

    // 4. Typing indicators (ephemeral)
    socket.on('typing_start', ({ conversationId, userId: typingId, userName }) => {
      const roomName = `conv:${conversationId}`;
      socket.to(roomName).emit('user_typing_start', { conversationId, userId: typingId, userName });
    });

    socket.on('typing_stop', ({ conversationId, userId: typingId }) => {
      const roomName = `conv:${conversationId}`;
      socket.to(roomName).emit('user_typing_stop', { conversationId, userId: typingId });
    });

    // 5. Presence (ephemeral in-memory)
    socket.on('user_presence', ({ userId: targetUserId, status }) => {
      userPresenceMap.set(targetUserId, status);
      io.emit('presence_updated', { userId: targetUserId, status });
    });

    // 6. Reactions
    socket.on('add_reaction', async ({ messageId, conversationId, userId: reactionUserId, emoji }) => {
      try {
        try {
          await prisma.messageReaction.upsert({
            where: {
              messageId_userId_emoji: { messageId, userId: reactionUserId, emoji },
            },
            update: {},
            create: { messageId, userId: reactionUserId, emoji },
          });
        } catch {
          // ignore
        }

        const roomName = `conv:${conversationId}`;
        io.to(roomName).emit('reaction_updated', {
          messageId,
          conversationId,
          emoji,
          userId: reactionUserId,
          action: 'ADDED',
          reactions: [{ emoji, count: 1, userIds: [reactionUserId] }],
        });
      } catch (err: any) {
        socket.emit('error_event', { message: err?.message || 'Failed to add reaction' });
      }
    });

    socket.on('remove_reaction', async ({ messageId, conversationId, userId: reactionUserId, emoji }) => {
      try {
        try {
          await prisma.messageReaction.deleteMany({
            where: { messageId, userId: reactionUserId, emoji },
          });
        } catch {
          // ignore
        }

        const roomName = `conv:${conversationId}`;
        io.to(roomName).emit('reaction_updated', {
          messageId,
          conversationId,
          emoji,
          userId: reactionUserId,
          action: 'REMOVED',
          reactions: [],
        });
      } catch (err: any) {
        socket.emit('error_event', { message: err?.message || 'Failed to remove reaction' });
      }
    });

    // 7. Edit Message
    socket.on('edit_message', async ({ messageId, conversationId, userId: editorId, content }) => {
      try {
        try {
          await prisma.message.update({
            where: { id: messageId },
            data: { content: content.trim(), isEdited: true },
          });
        } catch {
          // ignore
        }

        const roomName = `conv:${conversationId}`;
        io.to(roomName).emit('message_edited', {
          messageId,
          conversationId,
          content: content.trim(),
          isEdited: true,
        });
      } catch (err: any) {
        socket.emit('error_event', { message: err?.message || 'Failed to edit message' });
      }
    });

    // 8. Delete Message (soft-delete)
    socket.on('delete_message', async ({ messageId, conversationId }) => {
      try {
        try {
          await prisma.message.update({
            where: { id: messageId },
            data: { deletedAt: new Date() },
          });
        } catch {
          // ignore
        }

        const roomName = `conv:${conversationId}`;
        io.to(roomName).emit('message_deleted', { messageId, conversationId });
      } catch (err: any) {
        socket.emit('error_event', { message: err?.message || 'Failed to delete message' });
      }
    });

    // 9. Disconnect cleanup
    socket.on('disconnect', () => {
      const userSockets = activeSocketsByUser.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          activeSocketsByUser.delete(userId);
          userPresenceMap.set(userId, 'OFFLINE');
          io.emit('presence_updated', {
            userId,
            status: 'OFFLINE',
            lastSeen: new Date().toISOString(),
          });
        }
      }
    });
  });

  return io;
}
