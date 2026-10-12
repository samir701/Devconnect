import { connect } from '@tidbcloud/serverless';
import {
  User,
  Project,
  ProjectMember,
  Message,
  Task,
  Bug,
  Attachment,
  ActivityLog,
  DirectConversation,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_PROJECTS,
  INITIAL_MEMBERS,
  INITIAL_TASKS,
  INITIAL_BUGS,
  INITIAL_ATTACHMENTS,
  INITIAL_ACTIVITY,
  INITIAL_MESSAGES,
} from '../models/sampleData';

// TiDB Cloud Serverless Connection
const DATABASE_URL = process.env.DATABASE_URL || process.env.TIDB_DATABASE_URL;
const TIDB_HOST = process.env.TIDB_HOST;

const isPlaceholder = DATABASE_URL && (DATABASE_URL.includes('<USERNAME>') || DATABASE_URL.includes('<PASSWORD>'));

let tidbClient: ReturnType<typeof connect> | null = null;

if (DATABASE_URL && !isPlaceholder) {
  try {
    tidbClient = connect({ url: DATABASE_URL });
  } catch (err) {
    console.warn('[TiDB] Failed to connect using DATABASE_URL:', err);
  }
} else if (TIDB_HOST && process.env.TIDB_USER && process.env.TIDB_PASSWORD) {
  try {
    tidbClient = connect({
      host: TIDB_HOST,
      username: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE || 'devconnect',
    });
  } catch (err) {
    console.warn('[TiDB] Failed to connect using TiDB credentials:', err);
  }
}

// In-Memory Serverless Data Store (Stateful within node instances, initialized with rich seed data)
// Uses globalThis to survive serverless HMR in dev and warmup
declare global {
  // eslint-disable-next-line no-var
  var __devconnect_store: {
    users: Map<string, User>;
    projects: Map<string, Project>;
    members: ProjectMember[];
    messages: Message[];
    tasks: Map<string, Task>;
    bugs: Map<string, Bug>;
    attachments: Map<string, Attachment>;
    activity: ActivityLog[];
  } | undefined;
}

if (!globalThis.__devconnect_store) {
  const usersMap = new Map<string, User>();
  INITIAL_USERS.forEach((u) => usersMap.set(u.id, { ...u }));

  const projectsMap = new Map<string, Project>();
  INITIAL_PROJECTS.forEach((p) => projectsMap.set(p.id, { ...p }));

  const tasksMap = new Map<string, Task>();
  INITIAL_TASKS.forEach((t) => tasksMap.set(t.id, { ...t }));

  const bugsMap = new Map<string, Bug>();
  INITIAL_BUGS.forEach((b) => bugsMap.set(b.id, { ...b }));

  const attachmentsMap = new Map<string, Attachment>();
  INITIAL_ATTACHMENTS.forEach((a) => attachmentsMap.set(a.id, { ...a }));

  globalThis.__devconnect_store = {
    users: usersMap,
    projects: projectsMap,
    members: [...INITIAL_MEMBERS],
    messages: [...INITIAL_MESSAGES],
    tasks: tasksMap,
    bugs: bugsMap,
    attachments: attachmentsMap,
    activity: [...INITIAL_ACTIVITY],
  };
}

const store = globalThis.__devconnect_store;

export function getDbStatus() {
  return {
    provider: tidbClient ? 'TIDB_CLOUD_SERVERLESS' : 'VERCEL_SERVERLESS_STORE',
    connected: !!tidbClient,
    host: TIDB_HOST || (DATABASE_URL ? 'gateway.tidbcloud.com' : 'Local / Serverless Memory'),
  };
}

// ================= USER OPERATIONS =================
export async function getUsers(): Promise<User[]> {
  return Array.from(store.users.values());
}

export async function getUserById(id: string): Promise<User | null> {
  return store.users.get(id) || null;
}

export async function updateUser(id: string, partial: Partial<User>): Promise<User | null> {
  const current = store.users.get(id);
  if (!current) return null;
  const updated = { ...current, ...partial };
  store.users.set(id, updated);
  return updated;
}

// ================= PROJECT OPERATIONS =================
export async function getProjects(): Promise<Project[]> {
  return Array.from(store.projects.values());
}

export async function getProjectById(id: string): Promise<Project | null> {
  return store.projects.get(id) || null;
}

export async function createProject(data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
  const id = `proj_${Date.now()}`;
  const newProject: Project = {
    ...data,
    id,
    channels: data.channels || ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
    createdAt: new Date().toISOString(),
  };
  store.projects.set(id, newProject);

  // Add owner as OWNER
  store.members.push({
    id: `m_${Date.now()}`,
    projectId: id,
    userId: data.ownerId,
    role: 'OWNER',
    joinedAt: new Date().toISOString(),
  });

  // Log activity
  store.activity.unshift({
    id: `act_${Date.now()}`,
    projectId: id,
    userId: data.ownerId,
    userName: store.users.get(data.ownerId)?.name || 'Developer',
    eventType: 'COMMIT',
    title: `Project initialized: ${newProject.name}`,
    details: newProject.description,
    timestamp: 'Just now',
  });

  return newProject;
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const members = store.members.filter((m) => m.projectId === projectId);
  return members.map((m) => ({
    ...m,
    user: store.users.get(m.userId),
  }));
}

export async function addProjectMember(projectId: string, userId: string, role: ProjectMember['role']): Promise<ProjectMember> {
  const existing = store.members.find((m) => m.projectId === projectId && m.userId === userId);
  if (existing) {
    existing.role = role;
    return { ...existing, user: store.users.get(userId) };
  }
  const newMember: ProjectMember = {
    id: `m_${Date.now()}`,
    projectId,
    userId,
    role,
    joinedAt: new Date().toISOString(),
  };
  store.members.push(newMember);
  return { ...newMember, user: store.users.get(userId) };
}

// ================= MESSAGE OPERATIONS =================
export async function getMessages(filters: {
  projectId?: string;
  conversationId?: string;
  channel?: string;
}): Promise<Message[]> {
  return store.messages
    .filter((msg) => {
      if (filters.projectId) {
        if (msg.projectId !== filters.projectId) return false;
        if (filters.channel && msg.channel !== filters.channel) return false;
        return true;
      }
      if (filters.conversationId) {
        return msg.conversationId === filters.conversationId;
      }
      return false;
    })
    .map((msg) => ({
      ...msg,
      sender: store.users.get(msg.senderId),
    }));
}

export async function createMessage(msgData: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
  const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newMsg: Message = {
    ...msgData,
    id,
    createdAt: new Date().toISOString(),
    reactions: [],
  };

  store.messages.push(newMsg);

  // If message contains a task or bug, track activity
  if (newMsg.projectId) {
    if (newMsg.messageType === 'BUG' && newMsg.bugData) {
      store.activity.unshift({
        id: `act_${Date.now()}`,
        projectId: newMsg.projectId,
        userId: newMsg.senderId,
        userName: store.users.get(newMsg.senderId)?.name,
        eventType: 'BUG_REPORTED',
        title: `Bug reported: ${newMsg.bugData.title}`,
        details: newMsg.bugData.description,
        timestamp: 'Just now',
      });
    } else if (newMsg.messageType === 'TASK' && newMsg.taskData) {
      store.activity.unshift({
        id: `act_${Date.now()}`,
        projectId: newMsg.projectId,
        userId: newMsg.senderId,
        userName: store.users.get(newMsg.senderId)?.name,
        eventType: 'TASK_CREATED',
        title: `Task created: ${newMsg.taskData.title}`,
        details: newMsg.taskData.description,
        timestamp: 'Just now',
      });
    } else if (newMsg.messageType === 'FILE' && newMsg.attachmentData) {
      store.activity.unshift({
        id: `act_${Date.now()}`,
        projectId: newMsg.projectId,
        userId: newMsg.senderId,
        userName: store.users.get(newMsg.senderId)?.name,
        eventType: 'FILE_UPLOADED',
        title: `Uploaded file: ${newMsg.attachmentData.fileName}`,
        details: `${(newMsg.attachmentData.fileSize / 1024).toFixed(1)} KB stored in Backblaze B2`,
        timestamp: 'Just now',
      });
    }
  }

  return {
    ...newMsg,
    sender: store.users.get(newMsg.senderId),
  };
}

export async function toggleMessageReaction(messageId: string, userId: string, emoji: string): Promise<Message | null> {
  const msg = store.messages.find((m) => m.id === messageId);
  if (!msg) return null;

  if (!msg.reactions) msg.reactions = [];
  const existingReaction = msg.reactions.find((r) => r.emoji === emoji);

  if (existingReaction) {
    if (existingReaction.userIds.includes(userId)) {
      existingReaction.userIds = existingReaction.userIds.filter((id) => id !== userId);
      existingReaction.count -= 1;
      if (existingReaction.count <= 0) {
        msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
      }
    } else {
      existingReaction.userIds.push(userId);
      existingReaction.count += 1;
    }
  } else {
    msg.reactions.push({
      emoji,
      count: 1,
      userIds: [userId],
    });
  }

  return {
    ...msg,
    sender: store.users.get(msg.senderId),
  };
}

export async function deleteMessage(messageId: string): Promise<boolean> {
  const idx = store.messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return false;
  store.messages.splice(idx, 1);
  return true;
}

// ================= TASK OPERATIONS =================
export async function getTasks(projectId: string): Promise<Task[]> {
  const tasks = Array.from(store.tasks.values()).filter((t) => t.projectId === projectId);
  return tasks.map((t) => ({
    ...t,
    assigneeUser: t.assignedTo ? store.users.get(t.assignedTo) : undefined,
    creatorUser: store.users.get(t.createdBy),
  }));
}

export async function createTask(taskData: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
  const id = `task_${Date.now()}`;
  const newTask: Task = {
    ...taskData,
    id,
    createdAt: new Date().toISOString(),
  };
  store.tasks.set(id, newTask);

  // Activity log
  store.activity.unshift({
    id: `act_${Date.now()}`,
    projectId: newTask.projectId,
    userId: newTask.createdBy,
    userName: store.users.get(newTask.createdBy)?.name,
    eventType: 'TASK_CREATED',
    title: `Task created: ${newTask.title}`,
    details: newTask.description,
    timestamp: 'Just now',
  });

  return {
    ...newTask,
    assigneeUser: newTask.assignedTo ? store.users.get(newTask.assignedTo) : undefined,
    creatorUser: store.users.get(newTask.createdBy),
  };
}

export async function updateTask(id: string, partial: Partial<Task>): Promise<Task | null> {
  const existing = store.tasks.get(id);
  if (!existing) return null;
  const updated: Task = { ...existing, ...partial, updatedAt: new Date().toISOString() };
  store.tasks.set(id, updated);
  return {
    ...updated,
    assigneeUser: updated.assignedTo ? store.users.get(updated.assignedTo) : undefined,
    creatorUser: store.users.get(updated.createdBy),
  };
}

// ================= BUG OPERATIONS =================
export async function getBugs(projectId: string): Promise<Bug[]> {
  const bugs = Array.from(store.bugs.values()).filter((b) => b.projectId === projectId);
  return bugs.map((b) => ({
    ...b,
    assigneeUser: b.assignedTo ? store.users.get(b.assignedTo) : undefined,
    creatorUser: store.users.get(b.createdBy),
  }));
}

export async function createBug(bugData: Omit<Bug, 'id' | 'createdAt'>): Promise<Bug> {
  const id = `bug_${Date.now()}`;
  const newBug: Bug = {
    ...bugData,
    id,
    createdAt: new Date().toISOString(),
  };
  store.bugs.set(id, newBug);

  // Activity log
  store.activity.unshift({
    id: `act_${Date.now()}`,
    projectId: newBug.projectId,
    userId: newBug.createdBy,
    userName: store.users.get(newBug.createdBy)?.name,
    eventType: 'BUG_REPORTED',
    title: `Bug reported: ${newBug.title}`,
    details: `${newBug.endpoint ? `Endpoint: ${newBug.endpoint} • ` : ''}${newBug.description}`,
    timestamp: 'Just now',
  });

  return {
    ...newBug,
    assigneeUser: newBug.assignedTo ? store.users.get(newBug.assignedTo) : undefined,
    creatorUser: store.users.get(newBug.createdBy),
  };
}

export async function updateBug(id: string, partial: Partial<Bug>): Promise<Bug | null> {
  const existing = store.bugs.get(id);
  if (!existing) return null;
  const updated: Bug = { ...existing, ...partial, updatedAt: new Date().toISOString() };
  store.bugs.set(id, updated);

  if (partial.status === 'FIXED') {
    store.activity.unshift({
      id: `act_${Date.now()}`,
      projectId: updated.projectId,
      eventType: 'BUG_RESOLVED',
      title: `Bug resolved: ${updated.title}`,
      details: `Status moved to FIXED`,
      timestamp: 'Just now',
    });
  }

  return {
    ...updated,
    assigneeUser: updated.assignedTo ? store.users.get(updated.assignedTo) : undefined,
    creatorUser: store.users.get(updated.createdBy),
  };
}

// ================= ATTACHMENT OPERATIONS =================
export async function getAttachments(projectId: string): Promise<Attachment[]> {
  return Array.from(store.attachments.values()).filter((a) => a.projectId === projectId);
}

export async function createAttachment(data: Omit<Attachment, 'id' | 'createdAt'>): Promise<Attachment> {
  const id = `att_${Date.now()}`;
  const newAtt: Attachment = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  };
  store.attachments.set(id, newAtt);
  return newAtt;
}

// ================= ACTIVITY OPERATIONS =================
export async function getActivity(projectId: string): Promise<ActivityLog[]> {
  return store.activity.filter((act) => act.projectId === projectId);
}

// ================= CONVERSATIONS (1-TO-1) =================
export async function getConversations(userId: string): Promise<DirectConversation[]> {
  const otherUsers = Array.from(store.users.values()).filter((u) => u.id !== userId);
  return otherUsers.map((other) => {
    // Look up recent message between users
    const conversationId = [userId, other.id].sort().join('_');
    const recentMessages = store.messages.filter((m) => m.conversationId === conversationId || m.conversationId === `dm_${userId}_${other.id}` || m.conversationId === `dm_${other.id}_${userId}`);
    const lastMsg = recentMessages[recentMessages.length - 1];

    return {
      id: conversationId,
      participantIds: [userId, other.id] as [string, string],
      otherUser: other,
      lastMessage: lastMsg ? lastMsg.content : `Direct conversation with ${other.name}`,
      lastActivity: lastMsg ? lastMsg.createdAt : other.lastSeen || 'Recently',
      unreadCount: 0,
    };
  });
}

// ================= GLOBAL SEARCH =================
export async function searchAll(query: string, projectId?: string) {
  const q = query.toLowerCase().trim();
  if (!q) return { messages: [], tasks: [], bugs: [], files: [], users: [] };

  const matchedMessages = store.messages.filter((m) => {
    if (projectId && m.projectId && m.projectId !== projectId) return false;
    return m.content.toLowerCase().includes(q) || (m.codeFilename && m.codeFilename.toLowerCase().includes(q));
  });

  const matchedTasks = Array.from(store.tasks.values()).filter((t) => {
    if (projectId && t.projectId !== projectId) return false;
    return t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q));
  });

  const matchedBugs = Array.from(store.bugs.values()).filter((b) => {
    if (projectId && b.projectId !== projectId) return false;
    return b.title.toLowerCase().includes(q) || (b.description && b.description.toLowerCase().includes(q)) || (b.endpoint && b.endpoint.toLowerCase().includes(q));
  });

  const matchedFiles = Array.from(store.attachments.values()).filter((f) => {
    if (projectId && f.projectId !== projectId) return false;
    return f.fileName.toLowerCase().includes(q);
  });

  const matchedUsers = Array.from(store.users.values()).filter((u) => {
    return u.name.toLowerCase().includes(q) || u.title.toLowerCase().includes(q) || u.skills.some((s) => s.toLowerCase().includes(q));
  });

  return {
    messages: matchedMessages,
    tasks: matchedTasks,
    bugs: matchedBugs,
    files: matchedFiles,
    users: matchedUsers,
  };
}
