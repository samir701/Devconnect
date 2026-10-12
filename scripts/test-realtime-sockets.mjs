import { io } from 'socket.io-client';

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRealtimeTests() {
  console.log(`\n==========================================================`);
  console.log(`🧪 Testing ZettaDev Realtime System at ${SOCKET_URL}`);
  console.log(`==========================================================\n`);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // First verify HTTP health check
  await test('HTTP /health check endpoint', async () => {
    const res = await fetch(`${SOCKET_URL}/health`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Unexpected status: ${data.status}`);
    if (data.service !== 'ZettaDev Realtime Socket Gateway') throw new Error(`Unexpected service name`);
  });

  // Client 1: Samir Patra
  const client1 = io(SOCKET_URL, {
    query: { userId: 'user_samir' },
    transports: ['websocket'],
    reconnection: false,
  });

  // Client 2: Debmalya Sen
  const client2 = io(SOCKET_URL, {
    query: { userId: 'user_debmalya' },
    transports: ['websocket'],
    reconnection: false,
  });

  try {
    // 1. Connection Handshake
    await test('Socket connection handshake for Client 1 and Client 2', async () => {
      await Promise.all([
        new Promise((resolve, reject) => {
          if (client1.connected) return resolve();
          client1.once('connect', resolve);
          client1.once('connect_error', reject);
          setTimeout(() => reject(new Error('Client 1 connection timeout')), 4000);
        }),
        new Promise((resolve, reject) => {
          if (client2.connected) return resolve();
          client2.once('connect', resolve);
          client2.once('connect_error', reject);
          setTimeout(() => reject(new Error('Client 2 connection timeout')), 4000);
        }),
      ]);
    });

    const testConvId = `conv_rt_test_${Date.now()}`;

    // 2. Room Join
    await test('Join conversation room', async () => {
      await Promise.all([
        new Promise((resolve, reject) => {
          client1.once('joined_conversation', (data) => {
            if (data.conversationId === testConvId) resolve();
            else reject(new Error(`Wrong convId: ${data.conversationId}`));
          });
          client1.emit('join_conversation', { conversationId: testConvId, userId: 'user_samir' });
          setTimeout(() => reject(new Error('Join conversation timeout C1')), 3000);
        }),
        new Promise((resolve, reject) => {
          client2.once('joined_conversation', (data) => {
            if (data.conversationId === testConvId) resolve();
            else reject(new Error(`Wrong convId: ${data.conversationId}`));
          });
          client2.emit('join_conversation', { conversationId: testConvId, userId: 'user_debmalya' });
          setTimeout(() => reject(new Error('Join conversation timeout C2')), 3000);
        }),
      ]);
    });

    // 3. Typing Indicators
    await test('Typing indicators (start & stop broadcast)', async () => {
      const typingStartReceived = new Promise((resolve, reject) => {
        client2.once('user_typing_start', (data) => {
          if (data.userId === 'user_samir') resolve();
          else reject(new Error(`Unexpected typing userId: ${data.userId}`));
        });
        setTimeout(() => reject(new Error('user_typing_start timeout')), 3000);
      });

      client1.emit('typing_start', {
        conversationId: testConvId,
        userId: 'user_samir',
        userName: 'Samir Patra',
      });

      await typingStartReceived;

      const typingStopReceived = new Promise((resolve, reject) => {
        client2.once('user_typing_stop', (data) => {
          if (data.userId === 'user_samir') resolve();
          else reject(new Error(`Unexpected typing stop userId: ${data.userId}`));
        });
        setTimeout(() => reject(new Error('user_typing_stop timeout')), 3000);
      });

      client1.emit('typing_stop', {
        conversationId: testConvId,
        userId: 'user_samir',
      });

      await typingStopReceived;
    });

    // 4. Realtime Message Broadcast
    let testMessage = null;
    await test('Real-time message send & receive across clients', async () => {
      const msgPromise = new Promise((resolve, reject) => {
        client2.once('new_message', (msg) => {
          if (msg.content.includes('Hello Debmalya from Samir via Realtime Socket!')) {
            testMessage = msg;
            resolve();
          } else {
            reject(new Error(`Unexpected message content: ${msg.content}`));
          }
        });
        setTimeout(() => reject(new Error('new_message timeout')), 4000);
      });

      client1.emit('send_message', {
        conversationId: testConvId,
        senderId: 'user_samir',
        content: 'Hello Debmalya from Samir via Realtime Socket!',
        messageType: 'TEXT',
      });

      await msgPromise;
      if (!testMessage || !testMessage.id) throw new Error('No message ID returned');
    });

    // 5. Message Reactions
    await test('Emoji reaction addition broadcast', async () => {
      const reactionPromise = new Promise((resolve, reject) => {
        client1.once('reaction_updated', (data) => {
          if (data.messageId === testMessage.id && data.emoji === '🚀') {
            resolve();
          } else {
            reject(new Error(`Reaction mismatch: ${JSON.stringify(data)}`));
          }
        });
        setTimeout(() => reject(new Error('reaction_updated timeout')), 3000);
      });

      client2.emit('add_reaction', {
        messageId: testMessage.id,
        conversationId: testConvId,
        userId: 'user_debmalya',
        emoji: '🚀',
      });

      await reactionPromise;
    });

    // 6. Edit Message
    await test('Message edit broadcast with isEdited flag', async () => {
      const editPromise = new Promise((resolve, reject) => {
        client2.once('message_edited', (data) => {
          if (data.messageId === testMessage.id && data.content.includes('(Edited Version)')) {
            resolve();
          } else {
            reject(new Error(`Edit mismatch: ${JSON.stringify(data)}`));
          }
        });
        setTimeout(() => reject(new Error('message_edited timeout')), 3000);
      });

      client1.emit('edit_message', {
        messageId: testMessage.id,
        conversationId: testConvId,
        content: 'Hello Debmalya from Samir via Realtime Socket! (Edited Version)',
      });

      await editPromise;
    });

    // 7. Soft Delete Message
    await test('Message delete broadcast', async () => {
      const deletePromise = new Promise((resolve, reject) => {
        client2.once('message_deleted', (data) => {
          if (data.messageId === testMessage.id) {
            resolve();
          } else {
            reject(new Error(`Delete mismatch: ${JSON.stringify(data)}`));
          }
        });
        setTimeout(() => reject(new Error('message_deleted timeout')), 3000);
      });

      client1.emit('delete_message', {
        messageId: testMessage.id,
        conversationId: testConvId,
      });

      await deletePromise;
    });

    // 8. Presence Updates
    await test('Presence status change broadcast (AWAY -> ONLINE)', async () => {
      const presencePromise = new Promise((resolve, reject) => {
        client2.once('presence_updated', (data) => {
          if (data.userId === 'user_samir' && data.status === 'AWAY') {
            resolve();
          }
        });
        setTimeout(() => reject(new Error('presence_updated timeout')), 3000);
      });

      client1.emit('user_presence', {
        userId: 'user_samir',
        status: 'AWAY',
      });

      await presencePromise;
    });

  } finally {
    client1.disconnect();
    client2.disconnect();
  }

  console.log(`\n==========================================================`);
  console.log(`🏁 Realtime Socket Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`==========================================================\n`);

  if (failed > 0) process.exit(1);
}

runRealtimeTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
