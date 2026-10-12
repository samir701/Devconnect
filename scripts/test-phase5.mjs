#!/usr/bin/env node

/**
 * Phase 5 Verification Test Suite: Developer Features & Workflow
 * Tests Bug Reporting, Task Management, Message Conversion, Activity Feed, and RBAC Guardrails.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n🚀 Starting Phase 5 E2E Verification Tests (Developer Features & Engineering Workflow)...\n');

  const projectId = 'proj_ai_employee';
  let createdBugId = '';
  let createdTaskId = '';
  let testMessageId = '';

  try {
    // ----------------------------------------------------
    // TEST 1: POST /api/projects/:id/bugs (Create Bug)
    // ----------------------------------------------------
    const createBugRes = await fetch(`${BASE_URL}/api/projects/${projectId}/bugs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_samir',
      },
      body: JSON.stringify({
        title: 'Authentication token expiration mismatch',
        description: 'JWT expires in 15 mins instead of 24 hours on mobile devices',
        endpoint: '/api/auth/token',
        priority: 'CRITICAL',
        status: 'OPEN',
        assignedTo: 'user_debmalya',
      }),
    });

    const createBugData = await createBugRes.json();
    assert(createBugRes.status === 201 && createBugData.bug?.id, 'POST /api/projects/:id/bugs creates new bug report');
    createdBugId = createBugData.bug?.id;
    assert(createBugData.bug?.priority === 'CRITICAL', 'Bug report assigns specified CRITICAL priority');
    assert(createBugData.bug?.endpoint === '/api/auth/token', 'Bug report preserves endpoint metadata');

    // ----------------------------------------------------
    // TEST 2: GET /api/projects/:id/bugs (List with filters)
    // ----------------------------------------------------
    const getBugsRes = await fetch(`${BASE_URL}/api/projects/${projectId}/bugs?priority=CRITICAL`, {
      headers: { 'x-user-id': 'user_samir' },
    });
    const getBugsData = await getBugsRes.json();
    assert(
      getBugsRes.status === 200 &&
      Array.isArray(getBugsData.bugs) &&
      getBugsData.bugs.some((b) => b.id === createdBugId),
      'GET /api/projects/:id/bugs?priority=CRITICAL filters bugs by priority'
    );

    // ----------------------------------------------------
    // TEST 3: PATCH /api/bugs/:id (Update Bug Workflow State)
    // ----------------------------------------------------
    const patchBugRes = await fetch(`${BASE_URL}/api/bugs/${createdBugId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_debmalya',
      },
      body: JSON.stringify({
        status: 'FIXED',
      }),
    });
    const patchBugData = await patchBugRes.json();
    assert(
      patchBugRes.status === 200 && patchBugData.bug?.status === 'FIXED',
      'PATCH /api/bugs/:id transitions bug workflow status to FIXED'
    );

    // ----------------------------------------------------
    // TEST 4: POST /api/projects/:id/tasks (Create Task)
    // ----------------------------------------------------
    const createTaskRes = await fetch(`${BASE_URL}/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_samir',
      },
      body: JSON.stringify({
        title: 'Implement WebSocket reconnection telemetry',
        description: 'Track socket reconnect attempts and log disconnect reason',
        priority: 'HIGH',
        status: 'TODO',
        assignedTo: 'user_samir',
        dueDate: 'Friday',
      }),
    });
    const createTaskData = await createTaskRes.json();
    assert(createTaskRes.status === 201 && createTaskData.task?.id, 'POST /api/projects/:id/tasks creates new task');
    createdTaskId = createTaskData.task?.id;
    assert(createTaskData.task?.dueDate === 'Friday', 'Task preserves dueDate field');

    // ----------------------------------------------------
    // TEST 5: GET /api/projects/:id/tasks (List with filters)
    // ----------------------------------------------------
    const getTasksRes = await fetch(`${BASE_URL}/api/projects/${projectId}/tasks?status=TODO`, {
      headers: { 'x-user-id': 'user_samir' },
    });
    const getTasksData = await getTasksRes.json();
    assert(
      getTasksRes.status === 200 &&
      Array.isArray(getTasksData.tasks) &&
      getTasksData.tasks.some((t) => t.id === createdTaskId),
      'GET /api/projects/:id/tasks?status=TODO filters tasks by status'
    );

    // ----------------------------------------------------
    // TEST 6: PATCH /api/tasks/:id (Update Task State)
    // ----------------------------------------------------
    const patchTaskRes = await fetch(`${BASE_URL}/api/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_samir',
      },
      body: JSON.stringify({
        status: 'COMPLETED',
      }),
    });
    const patchTaskData = await patchTaskRes.json();
    assert(
      patchTaskRes.status === 200 && patchTaskData.task?.status === 'COMPLETED',
      'PATCH /api/tasks/:id updates status to COMPLETED'
    );

    // ----------------------------------------------------
    // TEST 7: Prepare a chat message for conversion tests
    // ----------------------------------------------------
    const sendMsgRes = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_samir',
      },
      body: JSON.stringify({
        projectId,
        channel: 'general',
        content: 'We need to migrate Redis cluster to version 7.2 before next week',
        messageType: 'TEXT',
      }),
    });
    const sendMsgData = await sendMsgRes.json();
    testMessageId = sendMsgData.message?.id;
    assert(sendMsgRes.status === 201 && testMessageId, 'POST /api/messages creates baseline message for conversion');

    // ----------------------------------------------------
    // TEST 8: POST /api/messages/:id/convert (Convert Message to Task)
    // ----------------------------------------------------
    const convertTaskRes = await fetch(`${BASE_URL}/api/messages/${testMessageId}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_samir',
      },
      body: JSON.stringify({
        type: 'TASK',
        title: 'Migrate Redis cluster to v7.2',
        priority: 'HIGH',
        dueDate: 'Next Monday',
      }),
    });
    const convertTaskData = await convertTaskRes.json();
    assert(
      convertTaskRes.status === 201 &&
      convertTaskData.success === true &&
      convertTaskData.type === 'TASK' &&
      convertTaskData.task?.messageId === testMessageId,
      'POST /api/messages/:id/convert converts message to Task with atomic back-reference'
    );

    // ----------------------------------------------------
    // TEST 9: Convert second message to Bug Report
    // ----------------------------------------------------
    const sendMsgBugRes = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_debmalya',
      },
      body: JSON.stringify({
        projectId,
        channel: 'development',
        content: 'Postgres connection pool exhausted under high concurrent load on /api/billing',
        messageType: 'TEXT',
      }),
    });
    const sendMsgBugData = await sendMsgBugRes.json();
    const bugMsgId = sendMsgBugData.message?.id;

    const convertBugRes = await fetch(`${BASE_URL}/api/messages/${bugMsgId}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_debmalya',
      },
      body: JSON.stringify({
        type: 'BUG',
        title: 'Connection pool exhausted on billing route',
        endpoint: '/api/billing',
        priority: 'CRITICAL',
      }),
    });
    const convertBugData = await convertBugRes.json();
    assert(
      convertBugRes.status === 201 &&
      convertBugData.success === true &&
      convertBugData.type === 'BUG' &&
      convertBugData.bug?.messageId === bugMsgId,
      'POST /api/messages/:id/convert converts message to Bug report with atomic back-reference'
    );

    // ----------------------------------------------------
    // TEST 10: RBAC Guardrails - VIEWER Role Enforcement
    // ----------------------------------------------------
    // Add temporary viewer member to test RBAC
    const addViewerRes = await fetch(`${BASE_URL}/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_samir', // OWNER
      },
      body: JSON.stringify({
        userId: 'user_priya',
        role: 'VIEWER',
      }),
    });

    // Attempt to create bug as VIEWER -> Should be 403 Forbidden
    const viewerCreateBugRes = await fetch(`${BASE_URL}/api/projects/${projectId}/bugs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_priya',
      },
      body: JSON.stringify({
        title: 'Unauthorized bug attempt',
      }),
    });
    assert(
      viewerCreateBugRes.status === 403,
      'RBAC Guard: VIEWER role cannot create bug reports (403 Forbidden)'
    );

    // Attempt to create task as VIEWER -> Should be 403 Forbidden
    const viewerCreateTaskRes = await fetch(`${BASE_URL}/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_priya',
      },
      body: JSON.stringify({
        title: 'Unauthorized task attempt',
      }),
    });
    assert(
      viewerCreateTaskRes.status === 403,
      'RBAC Guard: VIEWER role cannot create tasks (403 Forbidden)'
    );

    // Attempt to convert message as VIEWER -> Should be 403 Forbidden
    const viewerConvertRes = await fetch(`${BASE_URL}/api/messages/${testMessageId}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_priya',
      },
      body: JSON.stringify({
        type: 'TASK',
        title: 'Unauthorized convert attempt',
      }),
    });
    assert(
      viewerConvertRes.status === 403,
      'RBAC Guard: VIEWER role cannot convert messages (403 Forbidden)'
    );

    // ----------------------------------------------------
    // TEST 11: GET /api/projects/:id/activity (Project Activity Feed)
    // ----------------------------------------------------
    const getActivityRes = await fetch(`${BASE_URL}/api/projects/${projectId}/activity?limit=20`, {
      headers: { 'x-user-id': 'user_samir' },
    });
    const getActivityData = await getActivityRes.json();
    assert(
      getActivityRes.status === 200 &&
      Array.isArray(getActivityData.activities) &&
      getActivityData.activities.length > 0,
      'GET /api/projects/:id/activity returns paginated chronological activity timeline'
    );

    const hasBugOrTaskActivity = getActivityData.activities.some(
      (a) => a.actionType === 'BUG_REPORTED' || a.actionType === 'TASK_CREATED' || a.eventType === 'BUG_REPORTED'
    );
    assert(
      hasBugOrTaskActivity,
      'Activity feed captures and enriches developer events (BUG_REPORTED, TASK_CREATED)'
    );

  } catch (err) {
    console.error('Fatal test error:', err);
    failedTests++;
  }

  console.log('\n==========================================================');
  console.log(`Phase 5 Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('==========================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
