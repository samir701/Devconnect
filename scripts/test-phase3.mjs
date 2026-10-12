// Automated validation test for Phase 3: Messaging & Realtime API
const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Starting Phase 3 E2E Verification Tests (Messaging & Realtime)...\n');
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

  let testProjectId = 'proj_ai_employee';
  let testChannelConvId = null;
  let testDirectConvId = null;
  let testMessageId = null;

  // 1. Project Channels
  await test('GET /api/projects/:id/conversations returns project channels', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${testProjectId}/conversations`, {
      headers: { 'x-user-id': 'user_samir' },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.conversations) || data.conversations.length === 0) {
      throw new Error('Expected array of channel conversations');
    }
    testChannelConvId = data.conversations[0].id;
  });

  // 2. Direct Messages (1-to-1)
  await test('GET /api/conversations/direct resolves or creates 1-to-1 conversation', async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/direct?otherUserId=user_debmalya`, {
      headers: { 'x-user-id': 'user_samir' },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.conversation || !data.conversation.id) throw new Error('No conversation returned');
    if (data.conversation.type !== 'DIRECT') throw new Error(`Expected DIRECT type, got ${data.conversation.type}`);
    testDirectConvId = data.conversation.id;
  });

  // 3. Post Message to Conversation
  await test('POST /api/messages sends message to conversation', async () => {
    const res = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({
        conversationId: testChannelConvId,
        projectId: testProjectId,
        channel: 'general',
        content: 'Phase 3 Realtime Test Message: Redis/WebSockets deployed successfully.',
        messageType: 'TEXT',
        senderId: 'user_samir',
      }),
    });
    if (res.status !== 201) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.message || !data.message.id) throw new Error('No message returned');
    testMessageId = data.message.id;
  });

  // 4. Paginated Message History
  await test('GET /api/conversations/:id/messages returns paginated messages with author profile', async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/${testChannelConvId}/messages?limit=10`, {
      headers: { 'x-user-id': 'user_samir' },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.messages)) throw new Error('Expected messages array');
    const msg = data.messages.find((m) => m.id === testMessageId);
    if (!msg) throw new Error('Sent test message not found in conversation history');
    if (!msg.sender || !msg.sender.name) throw new Error('Missing sender profile');
  });

  // 5. Toggle Emoji Reaction
  await test('POST /api/messages/:id/reactions toggles emoji reaction (🚀)', async () => {
    const res = await fetch(`${BASE_URL}/api/messages/${testMessageId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({ emoji: '🚀' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.reactions)) throw new Error('Expected reactions array');
    const hasRocket = data.reactions.some((r) => r.emoji === '🚀');
    if (!hasRocket) throw new Error('Emoji reaction not present in aggregated response');
  });

  // 6. Edit Message
  await test('PATCH /api/messages/:id edits message and flags isEdited = true', async () => {
    const res = await fetch(`${BASE_URL}/api/messages/${testMessageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({ content: 'Phase 3 Realtime Test Message (Edited)' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.message.content !== 'Phase 3 Realtime Test Message (Edited)') throw new Error('Content not updated');
    if (data.message.isEdited !== true) throw new Error('isEdited flag not set to true');
  });

  // 7. Soft Delete Message
  await test('DELETE /api/messages/:id soft-deletes message', async () => {
    const res = await fetch(`${BASE_URL}/api/messages/${testMessageId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': 'user_samir' },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Delete operation failed');
  });

  console.log(`\n========================================`);
  console.log(`🏁 Phase 3 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
