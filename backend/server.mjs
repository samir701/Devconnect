import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Automatically locate and load .env files
const candidateEnvs = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '.env.local'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../.env.local'),
];

for (const envPath of candidateEnvs) {
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {}
  }
}

const PORT = process.env.SOCKET_PORT || (process.env.PORT && process.env.PORT !== '3000' ? process.env.PORT : 3001);

// 2. Initialize Prisma Client with TiDB
const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

// Ephemeral in-memory presence and connection state
const activeSocketsByUser = new Map(); // userId -> Set of socket IDs
const userPresenceMap = new Map();     // userId -> 'ONLINE' | 'AWAY' | 'OFFLINE'
// Ephemeral in-memory WebRTC call rooms state (roomId -> Map<socketId, participantInfo>)
const activeCallRooms = new Map();

// Helper to leave call rooms and notify peers
function leaveCallRoom(socket, targetRoomId = null) {
  const roomsToCheck = targetRoomId ? [targetRoomId] : Array.from(activeCallRooms.keys());
  for (const rId of roomsToCheck) {
    const room = activeCallRooms.get(rId);
    if (room && room.has(socket.id)) {
      const participant = room.get(socket.id);
      room.delete(socket.id);
      socket.leave(`call:${rId}`);

      socket.to(`call:${rId}`).emit('webrtc_user_left', {
        socketId: socket.id,
        userId: participant?.userId,
        roomId: rId,
      });

      if (room.size === 0) {
        activeCallRooms.delete(rId);
      }

      if (typeof io !== 'undefined') {
        io.emit('webrtc_room_status_changed', {
          roomId: rId,
          participantCount: room ? room.size : 0,
          participants: room ? Array.from(room.values()) : [],
        });
      }
    }
  }
}

// Helper to resolve room name for direct conversations, channels, or custom rooms
function getRoomName(payload) {
  if (!payload) return null;
  if (payload.conversationId) return `conv:${payload.conversationId}`;
  if (payload.roomId) return payload.roomId.startsWith('room:') ? payload.roomId : `room:${payload.roomId}`;
  if (payload.projectId) return `channel:${payload.projectId}:${payload.channel || 'general'}`;
  return null;
}

// 3. Create HTTP Server for Health Checks & Status
const server = http.createServer((req, res) => {
  // CORS headers for HTTP responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'ZettaDev Realtime Socket Gateway',
        port: PORT,
        activeConnections: io ? io.engine.clientsCount : 0,
        activeUsers: activeSocketsByUser.size,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        onlineUsers: Array.from(userPresenceMap.entries()).map(([id, status]) => ({
          userId: id,
          status,
          socketCount: activeSocketsByUser.get(id)?.size || 0,
        })),
        connectedSockets: io ? io.engine.clientsCount : 0,
      })
    );
    return;
  }

  if (req.url === '/api/calls/active' || req.url === '/calls') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const summary = {};
    for (const [rId, room] of activeCallRooms.entries()) {
      summary[rId] = {
        participantCount: room.size,
        participants: Array.from(room.values()),
      };
    }
    res.end(JSON.stringify({ activeCalls: summary }));
    return;
  }

  // Handle server-to-server broadcast for realtime triggers (messages, projects, members, tasks, bugs, files, notifications)
  const eventMatch = req.url.match(/^\/(?:api\/)?events\/([a-zA-Z0-9_-]+)/);
  if (req.method === 'POST' && eventMatch) {
    const eventName = eventMatch[1];
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');

        if (eventName === 'new_notification' && payload.userId && io) {
          // Emit to the recipient's personal channel only
          const personalRoom = `user:${payload.userId}`;
          io.to(personalRoom).emit('new_notification', payload.notification);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, event: eventName, room: personalRoom }));
          return;
        }

        const roomName = getRoomName(payload);
        if (io) {
          // Broadcast to specific room, project channels, and globally
          if (roomName) io.to(roomName).emit(eventName, payload);
          if (payload.projectId) {
            io.to(`channel:${payload.projectId}:tasks`).emit(eventName, payload);
            io.to(`channel:${payload.projectId}:bugs`).emit(eventName, payload);
            io.to(`channel:${payload.projectId}:general`).emit(eventName, payload);
          }
          io.emit(eventName, payload);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, event: eventName, broadcasted: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }


  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('⚡ ZettaDev Realtime Socket Gateway is RUNNING. Connect via Socket.IO client or visit /health.');
});

// 4. Initialize Socket.IO Server
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 20000,
  pingInterval: 10000,
  transports: ['websocket', 'polling'],
});

// 5. Socket.IO Event Handlers
io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  if (!userId) {
    return;
  }
  socket.data = { userId };

  // Track active connection
  if (!activeSocketsByUser.has(userId)) {
    activeSocketsByUser.set(userId, new Set());
  }
  activeSocketsByUser.get(userId).add(socket.id);
  userPresenceMap.set(userId, 'ONLINE');

  // Auto-join personal notification room for push delivery
  socket.join(`user:${userId}`);

  // Broadcast user presence
  io.emit('presence_updated', { userId, status: 'ONLINE' });


  // 1. Join Room (Conversation or Project Channel)
  socket.on('join_conversation', (payload) => {
    const roomName = getRoomName(payload);
    if (!roomName) return;
    socket.join(roomName);
    socket.emit('joined_conversation', { roomName, ...payload });
  });

  // 2. Leave Room
  socket.on('leave_conversation', (payload) => {
    const roomName = getRoomName(payload);
    if (!roomName) return;
    socket.leave(roomName);
    socket.emit('left_conversation', { roomName, ...payload });
  });

const LOCAL_STORE_FILE = path.resolve(__dirname, '../.devconnect-data/local-store.json');

function persistMessageToLocalStore(msg) {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
      if (raw) {
        const data = JSON.parse(raw);
        if (!data.messages) data.messages = [];
        if (!data.messages.some((m) => m.id === msg.id)) {
          data.messages.push(msg);
          const tmp = LOCAL_STORE_FILE + '.tmp';
          fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
          try {
            fs.renameSync(tmp, LOCAL_STORE_FILE);
          } catch {
            fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
          }
        }
      }
    }
  } catch (err) {
    console.error('[Socket] Failed to persist message fallback to local store:', err);
  }
}

  // 3. Send Message (Persist in TiDB + Broadcast to Room)
  socket.on('send_message', async (payload) => {
    const roomName = getRoomName(payload);
    if (!payload.content || !roomName) return;

    let createdMessage;
    // If message was already created via REST API, pass it through directly
    if (payload.id && payload.sender) {
      createdMessage = payload;
      persistMessageToLocalStore(createdMessage);
    } else {
      try {
        createdMessage = await prisma.message.create({
          data: {
            conversationId: payload.conversationId || null,
            projectId: payload.projectId || null,
            channel: payload.channel || 'general',
            senderId: payload.senderId || userId,
            content: payload.content.trim(),
            messageType: payload.messageType || 'TEXT',
            replyToMessageId: payload.replyToMessageId || null,
          },
          include: {
            sender: {
              select: { id: true, name: true, avatarUrl: true, headline: true, status: true },
            },
            replyTo: {
              select: { id: true, content: true, sender: { select: { name: true } } },
            },
            reactions: true,
          },
        });
        if (payload.codeLanguage) createdMessage.codeLanguage = payload.codeLanguage;
        if (payload.codeFilename) createdMessage.codeFilename = payload.codeFilename;
        persistMessageToLocalStore(createdMessage);
      } catch {
        // Ephemeral fallback if database is momentarily unreachable
        createdMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          conversationId: payload.conversationId || null,
          projectId: payload.projectId || null,
          channel: payload.channel || 'general',
          senderId: payload.senderId || userId,
          content: payload.content.trim(),
          messageType: payload.messageType || 'TEXT',
          replyToMessageId: payload.replyToMessageId || null,
          codeLanguage: payload.codeLanguage || null,
          codeFilename: payload.codeFilename || null,
          createdAt: new Date().toISOString(),
          isEdited: false,
          reactions: [],
          sender: {
            id: payload.senderId || userId,
            name: payload.senderName || (payload.senderId === 'user_debmalya' ? 'Debmalya Sen' : 'Samir Patra'),
            status: 'ONLINE',
          },
        };
        persistMessageToLocalStore(createdMessage);
      }
    }

    io.to(roomName).emit('new_message', createdMessage);

    // If message is a TASK or BUG, automatically also group and deliver it to the project's #tasks or #bugs channel room
    const targetProjectId = payload.projectId || createdMessage.projectId;
    const msgType = payload.messageType || createdMessage.messageType;
    if (targetProjectId) {
      if (msgType === 'TASK') {
        io.to(`channel:${targetProjectId}:tasks`).emit('new_message', createdMessage);
      } else if (msgType === 'BUG') {
        io.to(`channel:${targetProjectId}:bugs`).emit('new_message', createdMessage);
      }
    }
  });

  // 4. Typing Indicators (Excludes sender's own socket so sender doesn't see themselves typing)
  socket.on('typing_start', (payload) => {
    const roomName = getRoomName(payload);
    if (!roomName) return;
    socket.to(roomName).emit('user_typing_start', {
      ...payload,
      roomName,
      fromSocketId: socket.id,
      userId: payload.userId || userId,
      userName: payload.userName || 'Someone',
    });
  });

  socket.on('typing_stop', (payload) => {
    const roomName = getRoomName(payload);
    if (!roomName) return;
    socket.to(roomName).emit('user_typing_stop', {
      ...payload,
      roomName,
      fromSocketId: socket.id,
      userId: payload.userId || userId,
    });
  });

  // 5. User Presence Status Update
  socket.on('user_presence', ({ userId: targetId, status }) => {
    userPresenceMap.set(targetId, status);
    io.emit('presence_updated', { userId: targetId, status });
  });

  // 6. Message Reactions
  socket.on('add_reaction', async (payload) => {
    const roomName = getRoomName(payload);
    const { messageId, userId: reactionUserId, emoji } = payload;
    try {
      await prisma.messageReaction.upsert({
        where: { messageId_userId_emoji: { messageId, userId: reactionUserId, emoji } },
        update: {},
        create: { messageId, userId: reactionUserId, emoji },
      });
    } catch {}

    if (roomName) {
      io.to(roomName).emit('reaction_updated', {
        messageId,
        emoji,
        userId: reactionUserId,
        action: 'ADDED',
      });
    }
  });

  socket.on('remove_reaction', async (payload) => {
    const roomName = getRoomName(payload);
    const { messageId, userId: reactionUserId, emoji } = payload;
    try {
      await prisma.messageReaction.deleteMany({
        where: { messageId, userId: reactionUserId, emoji },
      });
    } catch {}

    if (roomName) {
      io.to(roomName).emit('reaction_updated', {
        messageId,
        emoji,
        userId: reactionUserId,
        action: 'REMOVED',
      });
    }
  });

  // 7. Edit & Delete Message
  socket.on('edit_message', async (payload) => {
    const roomName = getRoomName(payload);
    const { messageId, content } = payload;
    try {
      await prisma.message.update({
        where: { id: messageId },
        data: { content: content.trim(), isEdited: true },
      });
    } catch {}

    if (roomName) {
      io.to(roomName).emit('message_edited', {
        messageId,
        content: content.trim(),
        isEdited: true,
      });
    }
  });

  socket.on('delete_message', async (payload) => {
    const roomName = getRoomName(payload);
    const { messageId } = payload;
    try {
      await prisma.message.update({
        where: { id: messageId },
        data: { deletedAt: new Date() },
      });
    } catch {}

    if (roomName) {
      io.to(roomName).emit('message_deleted', {
        messageId,
      });
    }
  });

  // 7. File Upload & Developer Activity Notifications
  socket.on('file_uploaded', (payload) => {
    const roomName = getRoomName(payload);
    if (roomName) {
      io.to(roomName).emit('file_uploaded', payload);
    } else {
      io.emit('file_uploaded', payload);
    }
  });

  socket.on('activity_logged', (payload) => {
    const roomName = getRoomName(payload);
    if (roomName) {
      io.to(roomName).emit('activity_logged', payload);
    } else {
      io.emit('activity_logged', payload);
    }
  });

  socket.on('task_updated', (payload) => {
    const roomName = getRoomName(payload);
    if (roomName) {
      io.to(roomName).emit('task_updated', payload);
    } else {
      io.emit('task_updated', payload);
    }
  });

  socket.on('bug_updated', (payload) => {
    const roomName = getRoomName(payload);
    if (roomName) {
      io.to(roomName).emit('bug_updated', payload);
    } else {
      io.emit('bug_updated', payload);
    }
  });

  // 8. Project & Member Realtime Triggers
  socket.on('project_created', (payload) => {
    io.emit('project_created', payload);
  });

  socket.on('project_deleted', (payload) => {
    io.emit('project_deleted', payload);
  });

  socket.on('member_added', (payload) => {
    io.emit('member_added', payload);
  });

  socket.on('member_removed', (payload) => {
    io.emit('member_removed', payload);
  });

  socket.on('workspace_sync', (payload) => {
    io.emit('workspace_sync', payload);
  });

  // 9. WebRTC Realtime Voice & Video Calling Handlers
  // A. 1-on-1 Direct Call Invitation
  socket.on('webrtc_call_user', (payload) => {
    // payload: { userToCall, fromUser, isVideo, roomId, callType, title }
    if (!payload?.userToCall) return;
    io.to(`user:${payload.userToCall}`).emit('webrtc_incoming_call', {
      callerSocketId: socket.id,
      callerUser: payload.fromUser,
      isVideo: payload.isVideo ?? true,
      roomId: payload.roomId,
      callType: payload.callType || 'DIRECT',
      title: payload.title || payload.fromUser?.name || 'Incoming Call',
    });
  });

  // B. 1-on-1 Call Declined/Busy
  socket.on('webrtc_call_rejected', (payload) => {
    if (payload?.toSocketId) {
      io.to(payload.toSocketId).emit('webrtc_call_rejected', {
        fromUser: payload.fromUser,
        reason: payload.reason || 'declined',
      });
    } else if (payload?.toUserId) {
      io.to(`user:${payload.toUserId}`).emit('webrtc_call_rejected', {
        fromUser: payload.fromUser,
        reason: payload.reason || 'declined',
      });
    }
  });

  // C. Join Call Room (Mesh conference for Direct or Group calls)
  socket.on('webrtc_join_room', (payload) => {
    const { roomId, user, isVideo = true, isMuted = false } = payload || {};
    if (!roomId) return;

    socket.join(`call:${roomId}`);

    if (!activeCallRooms.has(roomId)) {
      activeCallRooms.set(roomId, new Map());
    }
    const room = activeCallRooms.get(roomId);

    // Get existing participants before adding self
    const existingParticipants = Array.from(room.values()).filter((p) => p.socketId !== socket.id);

    // Send existing peers to newly joined participant
    socket.emit('webrtc_room_users', {
      roomId,
      participants: existingParticipants,
    });

    // Save self to room
    room.set(socket.id, {
      socketId: socket.id,
      userId: user?.id || userId,
      user: user || { id: userId, name: 'Developer' },
      isVideo,
      isMuted,
      isScreenSharing: false,
    });

    // Notify other peers in room that a new user joined
    socket.to(`call:${roomId}`).emit('webrtc_user_joined', {
      socketId: socket.id,
      userId: user?.id || userId,
      user: user || { id: userId, name: 'Developer' },
      isVideo,
      isMuted,
    });

    // Broadcast room status change across workspace
    io.emit('webrtc_room_status_changed', {
      roomId,
      participantCount: room.size,
      participants: Array.from(room.values()),
    });
  });

  // D. Relay WebRTC Signal (SDP Offer / Answer)
  socket.on('webrtc_signal', (payload) => {
    // payload: { toSocketId, signal, fromUser }
    if (payload?.toSocketId && payload?.signal) {
      io.to(payload.toSocketId).emit('webrtc_signal', {
        fromSocketId: socket.id,
        fromUserId: userId,
        fromUser: payload.fromUser,
        signal: payload.signal,
      });
    }
  });

  // E. Relay ICE Candidate
  socket.on('webrtc_ice_candidate', (payload) => {
    // payload: { toSocketId, candidate }
    if (payload?.toSocketId && payload?.candidate) {
      io.to(payload.toSocketId).emit('webrtc_ice_candidate', {
        fromSocketId: socket.id,
        candidate: payload.candidate,
      });
    }
  });

  // F. Media State Toggle (Mute / Video / Screen Share status sync)
  socket.on('webrtc_media_toggle', (payload) => {
    const { roomId, isMuted, isVideoOff, isScreenSharing } = payload || {};
    if (roomId && activeCallRooms.has(roomId)) {
      const room = activeCallRooms.get(roomId);
      if (room.has(socket.id)) {
        const participant = room.get(socket.id);
        if (isMuted !== undefined) participant.isMuted = isMuted;
        if (isVideoOff !== undefined) participant.isVideo = !isVideoOff;
        if (isScreenSharing !== undefined) participant.isScreenSharing = isScreenSharing;
      }
      socket.to(`call:${roomId}`).emit('webrtc_peer_media_toggled', {
        socketId: socket.id,
        userId,
        isMuted,
        isVideoOff,
        isScreenSharing,
      });
    }
  });

  // G. Leave Call Room
  socket.on('webrtc_leave_room', (payload) => {
    const roomId = payload?.roomId;
    leaveCallRoom(socket, roomId);
  });

  // H. Query Active Call Rooms
  socket.on('webrtc_get_active_rooms', () => {
    const summary = {};
    for (const [rId, room] of activeCallRooms.entries()) {
      summary[rId] = {
        participantCount: room.size,
        participants: Array.from(room.values()),
      };
    }
    socket.emit('webrtc_active_rooms_list', summary);
  });

  // 10. Disconnect Cleanup
  socket.on('disconnect', () => {
    // Clean up any call room participations
    leaveCallRoom(socket);

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

// 6. Graceful Start & Shutdown
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use by another process.`);
    console.error(`💡 Tip: To free up the port, run:`);
    console.error(`   fuser -k ${PORT}/tcp  OR  kill $(lsof -t -i:${PORT})\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`\n==========================================================`);
  console.log(`⚡ ZettaDev Realtime Socket Gateway is LIVE on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`📊 Status Check: http://localhost:${PORT}/status`);
  console.log(`💬 Connected to TiDB Cloud & Next.js Frontend (port 3000)`);
  console.log(`==========================================================\n`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down realtime server...');
  server.close(() => process.exit(0));
});
