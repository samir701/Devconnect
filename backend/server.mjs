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

  // Handle server-to-server broadcast for file uploads, activity logs, task/bug updates, and notifications
  const eventMatch = req.url.match(/^\/(?:api\/)?events\/(file_uploaded|activity_logged|task_updated|bug_updated|new_notification)/);
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
  const userId = socket.handshake.query.userId || 'user_samir';
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

  // 3. Send Message (Persist in TiDB + Broadcast to Room)
  socket.on('send_message', async (payload) => {
    const roomName = getRoomName(payload);
    if (!payload.content || !roomName) return;

    let createdMessage;
    // If message was already created via REST API, pass it through directly
    if (payload.id && payload.sender) {
      createdMessage = payload;
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

  // 8. Disconnect Cleanup
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
