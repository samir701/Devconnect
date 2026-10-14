import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

async function testTriggers() {
  console.log('Testing Realtime Trigger Broadcasts...');

  const client = io(SOCKET_URL, {
    query: { userId: 'test_trigger_user' },
    transports: ['websocket'],
  });

  await new Promise((resolve) => client.once('connect', resolve));
  console.log('Connected to socket gateway');

  let memberAddedReceived = false;
  let memberRemovedReceived = false;
  let projectCreatedReceived = false;
  let projectDeletedReceived = false;

  client.on('member_added', (data) => {
    console.log('Received member_added trigger:', data);
    memberAddedReceived = true;
  });

  client.on('member_removed', (data) => {
    console.log('Received member_removed trigger:', data);
    memberRemovedReceived = true;
  });

  client.on('project_created', (data) => {
    console.log('Received project_created trigger:', data);
    projectCreatedReceived = true;
  });

  client.on('project_deleted', (data) => {
    console.log('Received project_deleted trigger:', data);
    projectDeletedReceived = true;
  });

  // Test emitting via HTTP to /api/events/
  await fetch(`${SOCKET_URL}/api/events/project_created`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'test_proj', name: 'Test Group' }),
  });

  await fetch(`${SOCKET_URL}/api/events/member_added`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'test_proj', userId: 'user_1' }),
  });

  await fetch(`${SOCKET_URL}/api/events/member_removed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'test_proj', userId: 'user_1' }),
  });

  await fetch(`${SOCKET_URL}/api/events/project_deleted`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'test_proj' }),
  });

  await new Promise((r) => setTimeout(r, 1000));

  client.disconnect();

  if (memberAddedReceived && memberRemovedReceived && projectCreatedReceived && projectDeletedReceived) {
    console.log('All trigger events received successfully!');
    process.exit(0);
  } else {
    console.error('Missing triggers:', { memberAddedReceived, memberRemovedReceived, projectCreatedReceived, projectDeletedReceived });
    process.exit(1);
  }
}

testTriggers().catch((err) => {
  console.error(err);
  process.exit(1);
});
