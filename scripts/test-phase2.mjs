// Automated validation test for Phase 2: Users & Projects API & RBAC
const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Starting Phase 2 E2E Verification Tests...\n');
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

  let createdProjectId = null;
  let addedMemberId = null;

  // 1. User Profile Endpoints
  await test('GET /api/users/me returns session profile with skills and headline', async () => {
    const res = await fetch(`${BASE_URL}/api/users/me`, {
      headers: { 'x-user-id': 'user_samir' },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.user || data.user.id !== 'user_samir') throw new Error('Invalid user payload');
  });

  await test('PATCH /api/users/me updates headline and status to AVAILABLE', async () => {
    const res = await fetch(`${BASE_URL}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({
        headline: 'Lead Architect | Next.js 16 | TiDB Cloud',
        status: 'AVAILABLE',
      }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.user.headline !== 'Lead Architect | Next.js 16 | TiDB Cloud') throw new Error('Headline mismatch');
  });

  await test('GET /api/users/:id returns public developer profile', async () => {
    const res = await fetch(`${BASE_URL}/api/users/user_debmalya`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.user || data.user.name !== 'Debmalya Roy') throw new Error('Developer profile mismatch');
  });

  // 2. Project Creation & Atomic Transactions
  await test('POST /api/projects creates project and atomically assigns creator as OWNER', async () => {
    const res = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({
        name: 'Phase 2 Test Core Service',
        description: 'End-to-end integration validation for RBAC and memberships',
        githubRepo: 'zettaweb/phase2-test',
      }),
    });
    if (res.status !== 201) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.project || !data.project.id) throw new Error('No project returned');
    createdProjectId = data.project.id;
  });

  await test('GET /api/projects/:id returns project details and userRole as OWNER', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${createdProjectId}`, {
      headers: { 'x-user-id': 'user_samir' },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.userRole !== 'OWNER') throw new Error(`Expected role OWNER, got ${data.userRole}`);
    if (!Array.isArray(data.members)) throw new Error('Expected members array');
  });

  await test('PATCH /api/projects/:id updates project details (allowed for OWNER)', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${createdProjectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({
        description: 'Updated description by Project Owner',
      }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.project.description !== 'Updated description by Project Owner') throw new Error('Update failed');
  });

  // 3. Project Members & RBAC
  await test('POST /api/projects/:id/members adds Debmalya as DEVELOPER', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({
        userId: 'user_debmalya',
        role: 'DEVELOPER',
      }),
    });
    if (res.status !== 201) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.member || data.member.role !== 'DEVELOPER') throw new Error('Member role mismatch');
    addedMemberId = data.member.id;
  });

  await test('RBAC Guard: Non-member cannot invite users (403 Forbidden)', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_arun' }, // Arun is not a member of this project
      body: JSON.stringify({
        userId: 'user_sarah',
        role: 'DEVELOPER',
      }),
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('PATCH /api/projects/:id/members/:memberId updates role to QA', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members/${addedMemberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({
        role: 'QA',
      }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.member.role !== 'QA') throw new Error(`Role update failed, got ${data.member.role}`);
  });

  await test('Sole Owner Protection: Cannot demote the sole project OWNER (400 Bad Request)', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members/user_samir`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user_samir' },
      body: JSON.stringify({
        role: 'DEVELOPER',
      }),
    });
    if (res.status !== 400) throw new Error(`Expected 400 for demoting sole owner, got ${res.status}`);
  });

  await test('DELETE /api/projects/:id/members/:memberId removes QA member', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members/${addedMemberId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': 'user_samir' },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Failed to delete member');
  });

  await test('DELETE /api/projects/:id archives the project (restricted to OWNER)', async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${createdProjectId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': 'user_samir' },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.project.status !== 'ARCHIVED') throw new Error('Project was not archived');
  });

  console.log(`\n========================================`);
  console.log(`🏁 Phase 2 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
