import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

async function runWebRTCTests() {
  console.log(`\n==========================================================`);
  console.log(`🧪 Testing WebRTC Calling Signaling at ${SOCKET_URL}`);
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

  // Client 1: Alice
  const alice = io(SOCKET_URL, {
    query: { userId: 'user_alice' },
    transports: ['websocket'],
    reconnection: false,
  });

  // Client 2: Bob
  const bob = io(SOCKET_URL, {
    query: { userId: 'user_bob' },
    transports: ['websocket'],
    reconnection: false,
  });

  try {
    await test('Socket connection handshake for Alice and Bob', async () => {
      await Promise.all([
        new Promise((resolve, reject) => {
          if (alice.connected) return resolve();
          alice.once('connect', resolve);
          alice.once('connect_error', reject);
          setTimeout(() => reject(new Error('Alice connection timeout')), 3000);
        }),
        new Promise((resolve, reject) => {
          if (bob.connected) return resolve();
          bob.once('connect', resolve);
          bob.once('connect_error', reject);
          setTimeout(() => reject(new Error('Bob connection timeout')), 3000);
        }),
      ]);
    });

    // 1. Direct Call Ringing
    await test('Direct 1-on-1 Call: Alice calls Bob, Bob receives webrtc_incoming_call', async () => {
      const incomingPromise = new Promise((resolve, reject) => {
        bob.once('webrtc_incoming_call', (data) => {
          if (data.callerUser.id === 'user_alice' && data.isVideo === true) {
            resolve(data);
          } else {
            reject(new Error('Unexpected caller payload'));
          }
        });
        setTimeout(() => reject(new Error('webrtc_incoming_call timeout')), 3000);
      });

      alice.emit('webrtc_call_user', {
        userToCall: 'user_bob',
        fromUser: { id: 'user_alice', name: 'Alice' },
        isVideo: true,
        roomId: 'direct_user_alice_user_bob',
        callType: 'DIRECT',
      });

      await incomingPromise;
    });

    // 2. Direct Call Rejection
    await test('Direct 1-on-1 Call: Bob declines, Alice receives webrtc_call_rejected', async () => {
      const rejectPromise = new Promise((resolve, reject) => {
        alice.once('webrtc_call_rejected', (data) => {
          if (data.reason === 'declined') {
            resolve(data);
          } else {
            reject(new Error('Unexpected reject reason'));
          }
        });
        setTimeout(() => reject(new Error('webrtc_call_rejected timeout')), 3000);
      });

      bob.emit('webrtc_call_rejected', {
        toUserId: 'user_alice',
        fromUser: { id: 'user_bob', name: 'Bob' },
        reason: 'declined',
      });

      await rejectPromise;
    });

    // 3. Group / Channel Room Join & Peer Discovery
    await test('Group Call Room: Alice and Bob join call:proj_ai_channel, receive room users', async () => {
      const roomId = 'group_proj_ai_channel';

      // Alice joins room
      const aliceRoomUsersPromise = new Promise((resolve, reject) => {
        alice.once('webrtc_room_users', (data) => {
          resolve(data);
        });
        setTimeout(() => reject(new Error('Alice room users timeout')), 3000);
      });

      alice.emit('webrtc_join_room', {
        roomId,
        user: { id: 'user_alice', name: 'Alice' },
        isVideo: true,
        isMuted: false,
      });

      await aliceRoomUsersPromise;

      // Bob joins room -> Alice should receive webrtc_user_joined
      const aliceNotifiedPromise = new Promise((resolve, reject) => {
        alice.once('webrtc_user_joined', (data) => {
          if (data.userId === 'user_bob') {
            resolve(data);
          } else {
            reject(new Error('Unexpected user joined'));
          }
        });
        setTimeout(() => reject(new Error('Alice webrtc_user_joined timeout')), 3000);
      });

      bob.emit('webrtc_join_room', {
        roomId,
        user: { id: 'user_bob', name: 'Bob' },
        isVideo: true,
        isMuted: false,
      });

      await aliceNotifiedPromise;
    });

    // 4. WebRTC Signal Relay (SDP Offer / Answer)
    await test('WebRTC Signal Relay: Alice sends SDP offer, Bob receives it', async () => {
      const signalPromise = new Promise((resolve, reject) => {
        bob.once('webrtc_signal', (data) => {
          if (data.signal?.sdp === 'mock_sdp_offer') {
            resolve(data);
          } else {
            reject(new Error('Unexpected signal payload'));
          }
        });
        setTimeout(() => reject(new Error('webrtc_signal timeout')), 3000);
      });

      alice.emit('webrtc_signal', {
        toSocketId: bob.id,
        signal: { type: 'offer', sdp: 'mock_sdp_offer' },
        fromUser: { id: 'user_alice', name: 'Alice' },
      });

      await signalPromise;
    });

    // 5. WebRTC ICE Candidate Relay
    await test('WebRTC ICE Candidate Relay: Bob sends candidate, Alice receives it', async () => {
      const icePromise = new Promise((resolve, reject) => {
        alice.once('webrtc_ice_candidate', (data) => {
          if (data.candidate?.candidate === 'mock_candidate_line') {
            resolve(data);
          } else {
            reject(new Error('Unexpected ICE payload'));
          }
        });
        setTimeout(() => reject(new Error('webrtc_ice_candidate timeout')), 3000);
      });

      bob.emit('webrtc_ice_candidate', {
        toSocketId: alice.id,
        candidate: { candidate: 'mock_candidate_line', sdpMid: '0', sdpMLineIndex: 0 },
      });

      await icePromise;
    });

    // 6. Media Toggle Sync
    await test('Media State Toggle: Alice mutes mic, Bob receives webrtc_peer_media_toggled', async () => {
      const togglePromise = new Promise((resolve, reject) => {
        bob.once('webrtc_peer_media_toggled', (data) => {
          if (data.isMuted === true) {
            resolve(data);
          } else {
            reject(new Error('Unexpected mute payload'));
          }
        });
        setTimeout(() => reject(new Error('webrtc_peer_media_toggled timeout')), 3000);
      });

      alice.emit('webrtc_media_toggle', {
        roomId: 'group_proj_ai_channel',
        isMuted: true,
      });

      await togglePromise;
    });

    // 7. Active Rooms Query
    await test('Active Call Rooms Query: Bob queries active rooms, gets group_proj_ai_channel', async () => {
      const activeRoomsPromise = new Promise((resolve, reject) => {
        bob.once('webrtc_active_rooms_list', (data) => {
          if (data['group_proj_ai_channel'] && data['group_proj_ai_channel'].participantCount >= 2) {
            resolve(data);
          } else {
            reject(new Error(`Unexpected active rooms: ${JSON.stringify(data)}`));
          }
        });
        setTimeout(() => reject(new Error('webrtc_active_rooms_list timeout')), 3000);
      });

      bob.emit('webrtc_get_active_rooms');
      await activeRoomsPromise;
    });

    // 8. Leave Room & Clean Disconnect
    await test('Leave Call Room: Alice leaves, Bob receives webrtc_user_left', async () => {
      const leavePromise = new Promise((resolve, reject) => {
        bob.once('webrtc_user_left', (data) => {
          if (data.userId === 'user_alice') {
            resolve(data);
          } else {
            reject(new Error('Unexpected user left'));
          }
        });
        setTimeout(() => reject(new Error('webrtc_user_left timeout')), 3000);
      });

      alice.emit('webrtc_leave_room', { roomId: 'group_proj_ai_channel' });
      await leavePromise;
    });
  } finally {
    alice.disconnect();
    bob.disconnect();
  }

  console.log(`\n==========================================================`);
  console.log(`🏁 WebRTC Signaling Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`==========================================================\n`);

  if (failed > 0) process.exit(1);
}

runWebRTCTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
