// Automated validation test for Phase 4: File System & Backblaze B2 Storage Architecture
const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Starting Phase 4 E2E Verification Tests (Backblaze B2 & File System)...\n');
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
  let testAttachmentId = null;
  let testStorageKey = null;

  // 1. File size guardrail test (Max 25MB)
  await test('POST /api/files/upload-url rejects files exceeding 25MB size limit', async () => {
    const res = await fetch(`${BASE_URL}/api/files/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({
        fileName: 'huge_database_dump.sql',
        fileType: 'application/sql',
        fileSize: 30 * 1024 * 1024, // 30 MB
        projectId: testProjectId,
      }),
    });
    if (res.status !== 400) throw new Error(`Expected status 400, got ${res.status}`);
    const data = await res.json();
    if (!data.error || !data.error.includes('25MB')) {
      throw new Error(`Expected 25MB limit error message, got: ${data.error}`);
    }
  });

  // 2. Authorization guardrail on upload
  await test('POST /api/files/upload-url verifies project membership', async () => {
    const res = await fetch(`${BASE_URL}/api/files/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_outsider' }, // Not a member of the project
      body: JSON.stringify({
        fileName: 'unauthorized_file.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        projectId: testProjectId,
      }),
    });
    if (res.status !== 403 && res.status !== 401) {
      throw new Error(`Expected status 403 or 401 for unauthorized member, got ${res.status}`);
    }
  });

  // 3. Generate Presigned Upload URL & Reserve Metadata in TiDB
  await test('POST /api/files/upload-url generates presigned upload URL and reserves TiDB metadata', async () => {
    const res = await fetch(`${BASE_URL}/api/files/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({
        fileName: 'architecture_diagram.png',
        fileType: 'image/png',
        fileSize: 204800, // 200 KB
        projectId: testProjectId,
      }),
    });
    if (res.status !== 201) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.uploadUrl) throw new Error('Missing uploadUrl in response');
    if (!data.storageKey) throw new Error('Missing storageKey in response');
    if (!data.storageKey.startsWith(`zettadev/project-files/${testProjectId}/`)) {
      throw new Error(`Unexpected storageKey structure: ${data.storageKey}`);
    }
    if (!data.attachment || !data.attachment.id) {
      throw new Error('Missing reserved attachment metadata in TiDB');
    }
    testAttachmentId = data.attachment.id;
    testStorageKey = data.storageKey;
  });

  // 4. Direct Upload Fallback endpoint
  await test('POST /api/files/upload handles direct fallback uploads safely', async () => {
    const res = await fetch(`${BASE_URL}/api/files/upload?storageKey=${encodeURIComponent(testStorageKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'x-user-id': 'user_samir' },
      body: Buffer.from('mock binary data representing architecture diagram'),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Upload fallback did not succeed');
  });

  // 5. Confirm Upload Completion
  await test('POST /api/files/confirm links attachment metadata and notifies realtime gateway', async () => {
    const res = await fetch(`${BASE_URL}/api/files/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({
        attachmentId: testAttachmentId,
        projectId: testProjectId,
        messageId: 'msg_test_001',
      }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Confirmation failed');
    if (data.attachment.messageId !== 'msg_test_001') {
      throw new Error('Attachment messageId was not updated');
    }
  });

  // 6. List Project Files with Categorization & Statistics
  await test('GET /api/projects/:id/files lists files with category summaries', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${testProjectId}/files`, {
      headers: { 'x-user-id': 'user_samir' },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.files)) throw new Error('Expected files array');
    if (!data.summary || typeof data.summary.totalCount !== 'number') {
      throw new Error('Expected summary with totalCount');
    }
    if (!data.summary.categories) throw new Error('Expected category breakdown');
  });

  // 7. Filter Project Files by Category
  await test('GET /api/projects/:id/files?category=images filters for image attachments', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${testProjectId}/files?category=images`, {
      headers: { 'x-user-id': 'user_samir' },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.files)) throw new Error('Expected files array');
    const allImages = data.files.every((f) =>
      ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].some((ext) => f.fileName.endsWith(`.${ext}`))
    );
    if (!allImages) throw new Error('Found non-image files in images category filter');
  });

  // 8. Secure Download Access Control (Reject Unauthorized User)
  await test('GET /api/files/:id/download forbids unauthorized non-members', async () => {
    const res = await fetch(`${BASE_URL}/api/files/${testAttachmentId}/download`, {
      headers: { 'x-user-id': 'user_outsider' }, // Not a member of the project
      redirect: 'manual',
    });
    if (res.status !== 403 && res.status !== 401) {
      throw new Error(`Expected status 403 or 401 for unauthorized download attempt, got ${res.status}`);
    }
  });

  // 9. Secure Download for Authorized Member
  await test('GET /api/files/:id/download generates secure presigned download response for member', async () => {
    const res = await fetch(`${BASE_URL}/api/files/${testAttachmentId}/download`, {
      headers: { 'x-user-id': 'user_samir' },
      redirect: 'manual', // Intercept 302 redirect
    });
    // Should be either 302 redirect to presigned B2 URL or 200 streamed binary
    if (res.status !== 302 && res.status !== 200) {
      throw new Error(`Expected status 302 redirect or 200 stream, got ${res.status}`);
    }
    if (res.status === 302) {
      const location = res.headers.get('location');
      if (!location) throw new Error('Missing location header on 302 redirect');
    }
  });

  // 10. Message Composer Integration with Attachment
  await test('POST /api/messages persists message with FILE/IMAGE attachmentData linked', async () => {
    const res = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({
        projectId: testProjectId,
        channel: 'general',
        content: 'Review the updated system architecture diagram attached from B2.',
        messageType: 'IMAGE',
        attachmentData: {
          id: testAttachmentId,
          fileName: 'architecture_diagram.png',
          fileType: 'image/png',
          fileSize: 204800,
          storageKey: testStorageKey,
          storageProvider: 'backblaze_b2',
        },
      }),
    });
    if (res.status !== 201) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.message || !data.message.attachmentData) {
      throw new Error('Message does not contain attachmentData');
    }
  });

  console.log('\n==========================================================');
  console.log(`Phase 4 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('==========================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
