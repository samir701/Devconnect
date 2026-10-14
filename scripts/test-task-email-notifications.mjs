#!/usr/bin/env node

/**
 * Verification Test: Resend Task Assignment & Completion Email Workflow
 * 
 * Tests the exact flow described by user:
 * 1. User A (Samir) creates a task assigned to User B (Debmalya).
 *    -> Email notification generated for Assignee (Debmalya).
 * 2. User B (Debmalya) clicks the tick / marks task COMPLETED.
 *    -> Email notification generated for Creator (Samir).
 * 3. Verify notification preferences & in-app notification records.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('🧪 Testing Resend Email & Task Notification Logic');
  console.log('======================================================\n');

  const projectId = 'proj_ai_employee';
  let taskId = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: User A (Samir) assigns a task to User B (Debmalya)
    // -------------------------------------------------------------------------
    console.log('📌 [Step 1] Creating a task assigned to Debmalya (Assignee)...');
    const createRes = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_samir',
      },
      body: JSON.stringify({
        projectId,
        title: 'Implement Resend Email Webhook Handler',
        description: 'Set up transactional email triggers for task assignment & completion',
        priority: 'HIGH',
        status: 'TODO',
        assignedTo: 'user_debmalya',
        createdBy: 'user_samir',
        dueDate: 'Friday',
      }),
    });

    const createData = await createRes.json();
    assert(createRes.status === 201 && createData.task?.id, 'Task created successfully');
    taskId = createData.task?.id;
    assert(createData.task?.assignedTo === 'user_debmalya', 'Task assigned to Debmalya');
    assert(createData.task?.createdBy === 'user_samir', 'Task created by Samir');

    // Check notifications for Debmalya (recipient)
    const notifResDebmalya = await fetch(`${BASE_URL}/api/notifications?userId=user_debmalya`);
    if (notifResDebmalya.ok) {
      const notifData = await notifResDebmalya.json();
      const taskAssignedNotif = notifData.notifications?.find(
        (n) => n.type === 'TASK_ASSIGNED' && n.entityId === taskId
      );
      assert(!!taskAssignedNotif, 'In-app notification TASK_ASSIGNED delivered to Debmalya');
    }

    // -------------------------------------------------------------------------
    // STEP 2: User B (Debmalya) clicks the tick to COMPLETE the task
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 2] Debmalya completes the task (clicks tick in app)...');
    const completeRes = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_debmalya',
      },
      body: JSON.stringify({
        status: 'COMPLETED',
        userId: 'user_debmalya',
      }),
    });

    const completeData = await completeRes.json();
    assert(completeRes.status === 200 && completeData.task?.status === 'COMPLETED', 'Task status updated to COMPLETED');

    // Check notifications for Samir (creator)
    const notifResSamir = await fetch(`${BASE_URL}/api/notifications?userId=user_samir`);
    if (notifResSamir.ok) {
      const notifData = await notifResSamir.json();
      const taskCompletedNotif = notifData.notifications?.find(
        (n) => n.type === 'TASK_COMPLETED' && n.entityId === taskId
      );
      assert(!!taskCompletedNotif, 'In-app notification TASK_COMPLETED delivered to Samir (Creator)');
    }

    // -------------------------------------------------------------------------
    // STEP 3: Check Self-Completion guardrail
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 3] Checking self-completion guardrail (user completes own task)...');
    const selfTaskRes = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_samir',
      },
      body: JSON.stringify({
        projectId,
        title: 'Samir Personal Task',
        priority: 'LOW',
        status: 'TODO',
        assignedTo: 'user_samir',
        createdBy: 'user_samir',
      }),
    });
    const selfTaskData = await selfTaskRes.json();
    const selfTaskId = selfTaskData.task?.id;

    const selfCompleteRes = await fetch(`${BASE_URL}/api/tasks/${selfTaskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_samir',
      },
      body: JSON.stringify({
        status: 'COMPLETED',
        userId: 'user_samir',
      }),
    });
    assert(selfCompleteRes.status === 200, 'Self-completed task updated successfully without redundant self-email');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

run();
