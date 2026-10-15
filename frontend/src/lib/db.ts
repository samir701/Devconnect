import fs from 'fs';
import path from 'path';
import { connect } from '@tidbcloud/serverless';
import { prisma } from './prisma';
import {
  User,
  Project,
  ProjectMember,
  ProjectRole,
  Message,
  MessageReaction,
  Task,
  Bug,
  Attachment,
  ActivityLog,
  DirectConversation,
  AppNotification,
  NotificationPreferences,
} from './types';
import {
  INITIAL_USERS,
  INITIAL_PROJECTS,
  INITIAL_MEMBERS,
  INITIAL_TASKS,
  INITIAL_BUGS,
  INITIAL_ATTACHMENTS,
  INITIAL_ACTIVITY,
  INITIAL_MESSAGES,
  INITIAL_NOTIFICATIONS,
} from './sampleData';
import { logActivity, emitRealtimeEvent, getActivityFeed } from './activity';

// TiDB Cloud Serverless Connection
const DEFAULT_DATABASE_URL =
  'mysql://2gbvCHB7bimYT2o.root:ZMVsFTMPh846aMiR@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/devconnect?sslaccept=strict';

const rawDbUrl = process.env.DATABASE_URL || process.env.TIDB_DATABASE_URL;
const DATABASE_URL =
  rawDbUrl &&
  !rawDbUrl.includes('<USERNAME>') &&
  !rawDbUrl.includes('<PASSWORD>') &&
  !rawDbUrl.includes('username:password') &&
  !rawDbUrl.includes('YourPassword')
    ? rawDbUrl
    : DEFAULT_DATABASE_URL;

const TIDB_HOST = process.env.TIDB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com';

export const isDatabaseConfigured = true;

let tidbClient: ReturnType<typeof connect> | null = null;

try {
  tidbClient = connect({ url: DATABASE_URL });
} catch (err) {
  console.warn('[TiDB] Failed to connect using DATABASE_URL:', err);
  if (TIDB_HOST && process.env.TIDB_USER && process.env.TIDB_PASSWORD) {
    try {
      tidbClient = connect({
        host: TIDB_HOST,
        username: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE || 'devconnect',
      });
    } catch (err2) {
      console.warn('[TiDB] Failed to connect using TiDB credentials:', err2);
    }
  }
}

// ================= LOCAL DISK PERSISTENCE LAYER =================
function getStoreFilePath(): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === 'production' ||
    (typeof process.cwd === 'function' && process.cwd().startsWith('/var/task'))
  );

  let dir = isServerless
    ? path.join('/tmp', '.devconnect-data')
    : path.resolve(process.cwd(), '.devconnect-data');

  if (!isServerless && path.basename(process.cwd()).toLowerCase() === 'frontend') {
    dir = path.resolve(process.cwd(), '../.devconnect-data');
  }

  try {
    if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    }
  } catch {}
  return path.join(dir, 'local-store.json');
}

const STORE_FILE_PATH = getStoreFilePath();

interface PersistentStoreData {
  messages: Message[];
  tasks: Task[];
  bugs: Bug[];
  attachments: Attachment[];
  activity: ActivityLog[];
  notifications: AppNotification[];
  users: User[];
  members: ProjectMember[];
  projects?: Project[];
}

export function loadPersistedStore(): Partial<PersistentStoreData> | null {
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ STORE_FILE_PATH)) {
      const raw = fs.readFileSync(/*turbopackIgnore: true*/ STORE_FILE_PATH, 'utf-8');
      if (raw && raw.trim()) {
        return JSON.parse(raw);
      }
    }
  } catch {}
  return null;
}

export function saveStoreToDisk() {
  if (!globalThis.__devconnect_store) return;
  try {
    const dir = path.dirname(STORE_FILE_PATH);
    if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    }
    const data: PersistentStoreData = {
      messages: globalThis.__devconnect_store.messages,
      tasks: Array.from(globalThis.__devconnect_store.tasks.values()),
      bugs: Array.from(globalThis.__devconnect_store.bugs.values()),
      attachments: Array.from(globalThis.__devconnect_store.attachments.values()),
      activity: globalThis.__devconnect_store.activity,
      notifications: Array.from(globalThis.__devconnect_store.notifications.values()),
      users: Array.from(globalThis.__devconnect_store.users.values()),
      members: globalThis.__devconnect_store.members,
      projects: Array.from(globalThis.__devconnect_store.projects.values()),
    };
    const json = JSON.stringify(data, null, 2);
    const tmp = STORE_FILE_PATH + '.tmp';
    fs.writeFileSync(/*turbopackIgnore: true*/ tmp, json, 'utf-8');
    try {
      fs.renameSync(/*turbopackIgnore: true*/ tmp, STORE_FILE_PATH);
    } catch {
      fs.writeFileSync(/*turbopackIgnore: true*/ STORE_FILE_PATH, json, 'utf-8');
    }
  } catch {
    // Primary persistence in production is TiDB Cloud; safely ignore ephemeral disk write errors
  }
}

// In-Memory Serverless Data Store (Stateful within node instances, initialized with rich seed data)
// Uses globalThis to survive serverless HMR in dev and warmup, backed by disk persistence
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
    notifications: Map<string, AppNotification>;
    notificationPreferences: Map<string, NotificationPreferences>;
  } | undefined;
}

if (!globalThis.__devconnect_store) {
  const persisted = loadPersistedStore();

  const usersMap = new Map<string, User>();
  INITIAL_USERS.forEach((u) => usersMap.set(u.id, { ...u }));
  if (persisted?.users) {
    persisted.users.forEach((u) => usersMap.set(u.id, { ...(usersMap.get(u.id) || {}), ...u }));
  }

  const projectsMap = new Map<string, Project>();
  INITIAL_PROJECTS.forEach((p) => projectsMap.set(p.id, { ...p }));
  if (persisted?.projects) {
    persisted.projects.forEach((p) => projectsMap.set(p.id, { ...(projectsMap.get(p.id) || {}), ...p }));
  }

  const tasksMap = new Map<string, Task>();
  INITIAL_TASKS.forEach((t) => tasksMap.set(t.id, { ...t }));
  if (persisted?.tasks) {
    persisted.tasks.forEach((t) => tasksMap.set(t.id, { ...t }));
  }

  const bugsMap = new Map<string, Bug>();
  INITIAL_BUGS.forEach((b) => bugsMap.set(b.id, { ...b }));
  if (persisted?.bugs) {
    persisted.bugs.forEach((b) => bugsMap.set(b.id, { ...b }));
  }

  const attachmentsMap = new Map<string, Attachment>();
  INITIAL_ATTACHMENTS.forEach((a) => attachmentsMap.set(a.id, { ...a }));
  if (persisted?.attachments) {
    persisted.attachments.forEach((a) => attachmentsMap.set(a.id, { ...a }));
  }

  const notifsMap = new Map<string, AppNotification>();
  INITIAL_NOTIFICATIONS.forEach((n) => notifsMap.set(n.id, { ...n }));
  if (persisted?.notifications) {
    persisted.notifications.forEach((n) => notifsMap.set(n.id, { ...n }));
  }

  // Combine initial messages and persisted messages
  // Ensure no duplicates by ID, preserving any sent messages
  const messagesMap = new Map<string, Message>();
  INITIAL_MESSAGES.forEach((m) => messagesMap.set(m.id, { ...m }));
  if (persisted?.messages) {
    persisted.messages.forEach((m) => messagesMap.set(m.id, { ...m }));
  }
  const messagesList = Array.from(messagesMap.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const activityList = persisted?.activity && persisted.activity.length > 0
    ? [...persisted.activity]
    : [...INITIAL_ACTIVITY];

  const membersList = persisted?.members && persisted.members.length > 0
    ? [...persisted.members]
    : [...INITIAL_MEMBERS];

  globalThis.__devconnect_store = {
    users: usersMap,
    projects: projectsMap,
    members: membersList,
    messages: messagesList,
    tasks: tasksMap,
    bugs: bugsMap,
    attachments: attachmentsMap,
    activity: activityList,
    notifications: notifsMap,
    notificationPreferences: new Map(),
  };

  saveStoreToDisk();
}

// Ensure newly added maps exist even if globalThis.__devconnect_store was already initialized earlier
if (!globalThis.__devconnect_store.notifications) {
  const notifsMap = new Map<string, AppNotification>();
  INITIAL_NOTIFICATIONS.forEach((n) => notifsMap.set(n.id, { ...n }));
  globalThis.__devconnect_store.notifications = notifsMap;
}
if (!globalThis.__devconnect_store.notificationPreferences) {
  globalThis.__devconnect_store.notificationPreferences = new Map();
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
function mapDbUserToUser(u: any): User {
  let parsedSkills: string[] = ['JavaScript', 'TypeScript'];
  if (u.skills) {
    try {
      parsedSkills =
        typeof u.skills === 'string' && u.skills.startsWith('[')
          ? JSON.parse(u.skills)
          : u.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
    } catch {
      parsedSkills = ['JavaScript', 'TypeScript'];
    }
  }
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    passwordHash: u.passwordHash || undefined,
    avatarUrl: u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.name)}`,
    title: u.headline || 'Software Developer',
    skills: parsedSkills,
    status: (u.status === 'AVAILABLE' ? 'ONLINE' : u.status === 'AWAY' ? 'AWAY' : 'OFFLINE') as any,
    lastSeen: u.lastSeen ? new Date(u.lastSeen).toISOString() : 'Just now',
    bio: u.bio || undefined,
    githubUrl: u.githubUrl || undefined,
    linkedinUrl: u.linkedinUrl || undefined,
  };
}

export async function getUsers(): Promise<User[]> {
  try {
    const dbUsers = await prisma.user.findMany();
    if (dbUsers && dbUsers.length > 0) {
      for (const u of dbUsers) {
        store.users.set(u.id, mapDbUserToUser(u));
      }
      return dbUsers
        .map(mapDbUserToUser)
        .filter((u) => !u.email.endsWith('@test.dev') && !u.email.endsWith('@example.com'));
    }
  } catch (err) {
    console.warn('[DB] Failed to fetch users from database, using local store:', err);
  }
  return Array.from(store.users.values()).filter(
    (u) => !u.email.endsWith('@test.dev') && !u.email.endsWith('@example.com')
  );
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const u = await prisma.user.findUnique({ where: { id } });
    if (u) {
      const mapped = mapDbUserToUser(u);
      store.users.set(u.id, mapped);
      return mapped;
    }
  } catch (err) {
    console.warn('[DB] Failed to fetch user by id from database:', err);
  }
  return store.users.get(id) || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      const mapped = mapDbUserToUser(u);
      store.users.set(u.id, mapped);
      return mapped;
    }
  } catch (err) {
    console.warn('[DB] Failed to fetch user by email from database:', err);
  }
  const users = Array.from(store.users.values());
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function createUser(userData: User): Promise<User> {
  try {
    await prisma.user.create({
      data: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        passwordHash: userData.passwordHash || null,
        avatarUrl: userData.avatarUrl || null,
        headline: userData.title || null,
        skills: JSON.stringify(userData.skills || []),
        status: 'AVAILABLE',
      },
    });
  } catch (err) {
    console.warn('[DB] Failed to create user in database:', err);
  }
  store.users.set(userData.id, userData);
  saveStoreToDisk();
  return userData;
}

export async function updateUser(id: string, partial: Partial<User>): Promise<User | null> {
  try {
    const dataToUpdate: any = {};
    if (partial.name !== undefined) dataToUpdate.name = partial.name;
    if (partial.avatarUrl !== undefined) dataToUpdate.avatarUrl = partial.avatarUrl;
    if (partial.title !== undefined) dataToUpdate.headline = partial.title;
    if (partial.skills !== undefined) dataToUpdate.skills = JSON.stringify(partial.skills);
    if (partial.bio !== undefined) dataToUpdate.bio = partial.bio;
    if (partial.githubUrl !== undefined) dataToUpdate.githubUrl = partial.githubUrl;
    if (partial.linkedinUrl !== undefined) dataToUpdate.linkedinUrl = partial.linkedinUrl;
    if (partial.passwordHash !== undefined) dataToUpdate.passwordHash = partial.passwordHash;
    if (partial.status !== undefined) {
      dataToUpdate.status = partial.status === 'ONLINE' ? 'AVAILABLE' : partial.status === 'AWAY' ? 'AWAY' : 'OFFLINE';
    }
    if (Object.keys(dataToUpdate).length > 0) {
      await prisma.user.update({
        where: { id },
        data: dataToUpdate,
      });
    }
  } catch (err) {
    console.warn('[DB] Failed to update user in database:', err);
  }
  const current = store.users.get(id);
  if (!current) return null;
  const updated = { ...current, ...partial };
  store.users.set(id, updated);
  saveStoreToDisk();
  return updated;
}

// ================= PROJECT OPERATIONS =================
export async function getProjects(): Promise<Project[]> {
  return Array.from(store.projects.values()).filter((p) => p.status !== 'ARCHIVED');
}

export async function getAllProjects(): Promise<Project[]> {
  return Array.from(store.projects.values());
}

export async function getProjectsForUser(userId: string): Promise<Project[]> {
  const memberProjectIds = new Set(
    store.members.filter((m) => m.userId === userId).map((m) => m.projectId)
  );
  return Array.from(store.projects.values()).filter(
    (p) => (p.ownerId === userId || memberProjectIds.has(p.id)) && p.status !== 'ARCHIVED'
  );
}

export async function getProjectById(id: string): Promise<Project | null> {
  if (isDatabaseConfigured) {
    try {
      const dbProj = await prisma.project.findUnique({
        where: { id },
      });
      if (dbProj) {
        return {
          id: dbProj.id,
          name: dbProj.name,
          description: dbProj.description || '',
          ownerId: dbProj.ownerId,
          githubRepo: dbProj.githubRepo || undefined,
          status: dbProj.status as any,
          channels: dbProj.channels ? JSON.parse(dbProj.channels) : ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
          createdAt: dbProj.createdAt.toISOString(),
          updatedAt: dbProj.updatedAt.toISOString(),
        };
      }
    } catch {}
  }
  return store.projects.get(id) || null;
}

export async function createProject(data: Omit<Project, 'id' | 'createdAt'> & { id?: string }): Promise<Project> {
  const id = data.id || `proj_${Date.now()}`;
  const newProject: Project = {
    ...data,
    id,
    channels: data.channels || ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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

  saveStoreToDisk();
  return newProject;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
  const current = store.projects.get(id);
  if (!current) return null;
  const updated: Project = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  store.projects.set(id, updated);
  saveStoreToDisk();
  return updated;
}

export async function archiveProject(id: string): Promise<Project | null> {
  const current = store.projects.get(id);
  if (!current) return null;
  const archived: Project = {
    ...current,
    status: 'ARCHIVED',
    updatedAt: new Date().toISOString(),
  };
  store.projects.set(id, archived);
  saveStoreToDisk();
  return archived;
}

export async function deleteProject(id: string): Promise<boolean> {
  const current = store.projects.get(id);
  if (!current) return false;
  store.projects.delete(id);
  store.members = store.members.filter((m) => m.projectId !== id);
  for (const [taskId, task] of store.tasks.entries()) {
    if (task.projectId === id) store.tasks.delete(taskId);
  }
  for (const [bugId, bug] of store.bugs.entries()) {
    if (bug.projectId === id) store.bugs.delete(bugId);
  }
  for (const [attId, att] of store.attachments.entries()) {
    if (att.projectId === id) store.attachments.delete(attId);
  }
  store.activity = store.activity.filter((act) => act.projectId !== id);
  saveStoreToDisk();
  return true;
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  if (isDatabaseConfigured) {
    try {
      const dbMembers = await prisma.projectMember.findMany({
        where: { projectId },
        include: { user: true },
      });
      if (dbMembers && dbMembers.length > 0) {
        return dbMembers.map((m) => ({
          id: m.id,
          projectId: m.projectId,
          userId: m.userId,
          role: m.role as any,
          joinedAt: m.joinedAt.toISOString(),
          user: m.user
            ? {
                id: m.user.id,
                name: m.user.name,
                email: m.user.email,
                avatarUrl: m.user.avatarUrl || '',
                title: m.user.headline || 'Developer',
                skills: [],
                status: m.user.status as any,
              }
            : store.users.get(m.userId),
        }));
      }
    } catch {}
  }
  const members = store.members.filter((m) => m.projectId === projectId);
  return members.map((m) => ({
    ...m,
    user: store.users.get(m.userId),
  }));
}

export async function addProjectMember(projectId: string, userId: string, role: ProjectMember['role']): Promise<ProjectMember> {
  if (isDatabaseConfigured) {
    try {
      const dbMember = await prisma.projectMember.upsert({
        where: {
          projectId_userId: { projectId, userId },
        },
        update: { role },
        create: { projectId, userId, role },
        include: { user: true },
      });
      if (dbMember) {
        const formatted: ProjectMember = {
          id: dbMember.id,
          projectId: dbMember.projectId,
          userId: dbMember.userId,
          role: dbMember.role as any,
          joinedAt: dbMember.joinedAt.toISOString(),
          user: dbMember.user
            ? {
                id: dbMember.user.id,
                name: dbMember.user.name,
                email: dbMember.user.email,
                avatarUrl: dbMember.user.avatarUrl || '',
                title: dbMember.user.headline || 'Developer',
                skills: [],
                status: dbMember.user.status as any,
              }
            : store.users.get(userId),
        };
        const idx = store.members.findIndex((m) => m.projectId === projectId && m.userId === userId);
        if (idx !== -1) store.members[idx] = formatted;
        else store.members.push(formatted);
        return formatted;
      }
    } catch {}
  }

  const existing = store.members.find((m) => m.projectId === projectId && m.userId === userId);
  if (existing) {
    existing.role = role;
    saveStoreToDisk();
    return { ...existing, user: store.users.get(userId) };
  }
  const newMember: ProjectMember = {
    id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    projectId,
    userId,
    role,
    joinedAt: new Date().toISOString(),
  };
  store.members.push(newMember);
  saveStoreToDisk();
  return { ...newMember, user: store.users.get(userId) };
}

export async function updateProjectMemberRole(
  projectId: string,
  memberIdOrUserId: string,
  newRole: ProjectRole
): Promise<ProjectMember | null> {
  if (isDatabaseConfigured) {
    try {
      const dbMember = await prisma.projectMember.update({
        where: { id: memberIdOrUserId },
        data: { role: newRole },
        include: { user: true },
      });
      if (dbMember) {
        const updated: ProjectMember = {
          id: dbMember.id,
          projectId: dbMember.projectId,
          userId: dbMember.userId,
          role: dbMember.role as any,
          joinedAt: dbMember.joinedAt.toISOString(),
        };
        return updated;
      }
    } catch {}
  }

  const member = store.members.find(
    (m) => m.projectId === projectId && (m.id === memberIdOrUserId || m.userId === memberIdOrUserId)
  );
  if (!member) return null;
  member.role = newRole;
  return { ...member, user: store.users.get(member.userId) };
}

export async function removeProjectMember(
  projectId: string,
  memberIdOrUserId: string
): Promise<boolean> {
  let dbDeleted = false;
  if (isDatabaseConfigured) {
    try {
      const res = await prisma.projectMember.deleteMany({
        where: {
          projectId,
          OR: [
            { id: memberIdOrUserId },
            { userId: memberIdOrUserId },
          ],
        },
      });
      if (res.count > 0) dbDeleted = true;
    } catch {}
  }

  const index = store.members.findIndex(
    (m) => m.projectId === projectId && (m.id === memberIdOrUserId || m.userId === memberIdOrUserId)
  );
  if (index !== -1) {
    store.members.splice(index, 1);
    saveStoreToDisk();
    return true;
  }
  return dbDeleted;
}

// ================= MESSAGE OPERATIONS =================
export async function getMessages(filters: {
  projectId?: string;
  conversationId?: string;
  channel?: string;
}): Promise<Message[]> {
  if (isDatabaseConfigured) {
    try {
    const whereClause: any = {
      deletedAt: null,
    };
    if (filters.projectId) {
      whereClause.projectId = filters.projectId;
      if (filters.channel) {
        if (filters.channel === 'tasks') {
          whereClause.OR = [
            { channel: 'tasks' },
            { messageType: 'TASK' },
          ];
        } else if (filters.channel === 'bugs') {
          whereClause.OR = [
            { channel: 'bugs' },
            { messageType: 'BUG' },
          ];
        } else {
          whereClause.channel = filters.channel;
        }
      }
    } else if (filters.conversationId) {
      whereClause.conversationId = filters.conversationId;
    }

    const dbMessages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            headline: true,
            status: true,
          },
        },
        attachments: true,
        reactions: true,
        tasks: {
          include: { assignee: true, creator: true },
        },
        bugs: {
          include: { assignee: true, reporter: true },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: { select: { name: true } },
          },
        },
      },
    });

    if (dbMessages && dbMessages.length > 0) {
      return dbMessages.map((m) => {
        const att = m.attachments?.[0];
        const mappedAttachment: Attachment | undefined = att
          ? {
              id: att.id,
              messageId: att.messageId || undefined,
              projectId: att.projectId || undefined,
              uploaderId: att.uploaderId || undefined,
              fileName: att.fileName,
              fileType: att.fileType || undefined,
              mimeType: att.fileType || undefined,
              fileSize: att.fileSize,
              storageProvider: att.storageProvider || 'backblaze_b2',
              storageKey: att.storageKey,
              fileUrl: att.fileUrl || undefined,
              createdAt: att.createdAt.toISOString(),
            }
          : undefined;

        const allAttachments: Attachment[] = (m.attachments || []).map((a) => ({
          id: a.id,
          messageId: a.messageId || undefined,
          projectId: a.projectId || undefined,
          uploaderId: a.uploaderId || undefined,
          fileName: a.fileName,
          fileType: a.fileType || undefined,
          mimeType: a.fileType || undefined,
          fileSize: a.fileSize,
          storageProvider: a.storageProvider || 'backblaze_b2',
          storageKey: a.storageKey,
          fileUrl: a.fileUrl || undefined,
          createdAt: a.createdAt.toISOString(),
        }));

        const reactionMap = new Map<string, string[]>();
        for (const r of m.reactions || []) {
          if (!reactionMap.has(r.emoji)) {
            reactionMap.set(r.emoji, []);
          }
          reactionMap.get(r.emoji)!.push(r.userId);
        }
        const reactions: MessageReaction[] = Array.from(reactionMap.entries()).map(([emoji, userIds]) => ({
          emoji,
          count: userIds.length,
          userIds,
        }));

        const dbTask = m.tasks?.[0];
        let metaParsed: any = null;
        try { if (m.metadata) metaParsed = JSON.parse(m.metadata); } catch {}

        const mappedTask: Task | undefined = dbTask
          ? {
              id: dbTask.id,
              projectId: dbTask.projectId,
              messageId: dbTask.messageId || undefined,
              title: dbTask.title,
              description: dbTask.description || undefined,
              priority: dbTask.priority as any,
              status: dbTask.status as any,
              assignedTo: dbTask.assignedTo || undefined,
              assigneeUser: dbTask.assignee
                ? {
                    id: dbTask.assignee.id,
                    name: dbTask.assignee.name,
                    email: dbTask.assignee.email,
                    avatarUrl: dbTask.assignee.avatarUrl || '',
                    title: dbTask.assignee.headline || 'Developer',
                    headline: dbTask.assignee.headline || '',
                    skills: [],
                    status: (dbTask.assignee.status as any) || 'AVAILABLE',
                  }
                : (dbTask.assignedTo ? store.users.get(dbTask.assignedTo) : undefined),
              createdBy: dbTask.createdBy,
              dueDate: dbTask.dueDate ? dbTask.dueDate.toISOString() : undefined,
              createdAt: dbTask.createdAt.toISOString(),
            }
          : undefined;

        const dbBug = m.bugs?.[0];
        const mappedBug: Bug | undefined = dbBug
          ? {
              id: dbBug.id,
              projectId: dbBug.projectId,
              messageId: dbBug.messageId || undefined,
              title: dbBug.title,
              description: dbBug.description || undefined,
              endpoint: dbBug.endpoint || undefined,
              priority: dbBug.priority as any,
              status: dbBug.status as any,
              assignedTo: dbBug.assignedTo || undefined,
              assigneeUser: dbBug.assignee
                ? {
                    id: dbBug.assignee.id,
                    name: dbBug.assignee.name,
                    email: dbBug.assignee.email,
                    avatarUrl: dbBug.assignee.avatarUrl || '',
                    title: dbBug.assignee.headline || 'Developer',
                    headline: dbBug.assignee.headline || '',
                    skills: [],
                    status: (dbBug.assignee.status as any) || 'AVAILABLE',
                  }
                : (dbBug.assignedTo ? store.users.get(dbBug.assignedTo) : undefined),
              createdBy: dbBug.createdBy,
              createdAt: dbBug.createdAt.toISOString(),
            }
          : undefined;

        return {
          id: m.id,
          projectId: m.projectId || undefined,
          conversationId: m.conversationId || undefined,
          channel: m.channel || 'general',
          senderId: m.senderId,
          messageType: (m.messageType as any) || 'TEXT',
          content: m.content,
          metadata: m.metadata || undefined,
          codeLanguage: metaParsed?.codeLanguage || undefined,
          codeFilename: metaParsed?.codeFilename || undefined,
          taskData: mappedTask,
          bugData: mappedBug,
          attachmentData: mappedAttachment,
          attachments: allAttachments,
          reactions,
          isEdited: m.isEdited,
          replyToMessageId: m.replyToMessageId || undefined,
          replyToMessage: m.replyTo
            ? {
                id: m.replyTo.id,
                senderName: m.replyTo.sender?.name || 'Developer',
                content: m.replyTo.content,
              }
            : undefined,
          sender: m.sender
            ? {
                id: m.sender.id,
                name: m.sender.name,
                email: m.sender.email,
                avatarUrl: m.sender.avatarUrl || '',
                title: m.sender.headline || 'Developer',
                headline: m.sender.headline || '',
                skills: [],
                status: (m.sender.status as any) || 'AVAILABLE',
              }
            : store.users.get(m.senderId),
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt ? m.updatedAt.toISOString() : undefined,
          deletedAt: m.deletedAt ? m.deletedAt.toISOString() : undefined,
        };
      });
    }
  } catch (err) {
    console.error('Error fetching messages from TiDB:', err);
  }
}

  if (fs.existsSync(STORE_FILE_PATH)) {
    try {
      const persisted = loadPersistedStore();
      if (persisted?.messages && persisted.messages.length > store.messages.length) {
        const map = new Map<string, Message>();
        store.messages.forEach((m) => map.set(m.id, m));
        persisted.messages.forEach((m) => map.set(m.id, m));
        store.messages = Array.from(map.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
    } catch {}
  }

  return store.messages
    .filter((msg) => {
      if (filters.projectId) {
        if (msg.projectId !== filters.projectId) return false;
        if (filters.channel) {
          if (filters.channel === 'tasks') {
            if (msg.channel !== 'tasks' && msg.messageType !== 'TASK') return false;
          } else if (filters.channel === 'bugs') {
            if (msg.channel !== 'bugs' && msg.messageType !== 'BUG') return false;
          } else if (msg.channel !== filters.channel) {
            return false;
          }
        }
        return true;
      }
      if (filters.conversationId) {
        if (msg.conversationId === filters.conversationId) return true;
        const targetParts = filters.conversationId.replace('dm_', '').split('_').sort().join('_');
        const msgParts = (msg.conversationId || '').replace('dm_', '').split('_').sort().join('_');
        return targetParts.length > 0 && targetParts === msgParts;
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

  if (isDatabaseConfigured) {
    try {
      // 1. Ensure sender user exists in TiDB
      if (msgData.senderId) {
        const dbSender = await prisma.user.findUnique({ where: { id: msgData.senderId } });
        if (!dbSender) {
          const storeSender = store.users.get(msgData.senderId);
          const safeStatus =
            storeSender?.status === 'AWAY'
              ? 'AWAY'
              : storeSender?.status === 'OFFLINE'
              ? 'OFFLINE'
              : 'AVAILABLE';
          await prisma.user.create({
            data: {
              id: msgData.senderId,
              email: storeSender?.email || `${msgData.senderId}@zettadev.io`,
              name: storeSender?.name || 'Developer',
              avatarUrl: storeSender?.avatarUrl || '',
              headline: storeSender?.headline || 'Developer',
              status: safeStatus,
            },
          });
        }
      }

      // 2. Ensure project exists in TiDB if linked
      if (msgData.projectId) {
        const dbProj = await prisma.project.findUnique({ where: { id: msgData.projectId } });
        if (!dbProj) {
          const storeProj = store.projects.get(msgData.projectId);
          await prisma.project.create({
            data: {
              id: msgData.projectId,
              name: storeProj?.name || 'Dev Project',
              description: storeProj?.description || '',
              ownerId: storeProj?.ownerId || msgData.senderId || 'user_creator',
              status: 'ACTIVE',
            },
          });
        }
      }

      // 3. Ensure conversation exists in TiDB if linked
      if (msgData.conversationId) {
        const dbConv = await prisma.conversation.findUnique({ where: { id: msgData.conversationId } });
        if (!dbConv) {
          await prisma.conversation.create({
            data: {
              id: msgData.conversationId,
              type: msgData.projectId ? 'PROJECT_CHANNEL' : 'DIRECT',
              projectId: msgData.projectId || null,
            },
          });
        }
      }

      const msgMeta = msgData.metadata || (
        msgData.codeLanguage || msgData.codeFilename || msgData.taskData || msgData.bugData
          ? JSON.stringify({
              codeLanguage: msgData.codeLanguage,
              codeFilename: msgData.codeFilename,
              ...(msgData.taskData ? { taskId: msgData.taskData.id, ...msgData.taskData } : {}),
              ...(msgData.bugData ? { bugId: msgData.bugData.id, ...msgData.bugData } : {}),
            })
          : null
      );

      await prisma.message.create({
        data: {
          id,
          conversationId: msgData.conversationId || null,
          projectId: msgData.projectId || null,
          channel: msgData.channel || 'general',
          senderId: msgData.senderId,
          content: msgData.content,
          messageType: msgData.messageType || 'TEXT',
          metadata: msgMeta,
          replyToMessageId: msgData.replyToMessageId || null,
        },
      });

      if (msgData.taskData?.id) {
        try {
          await prisma.task.update({
            where: { id: msgData.taskData.id },
            data: { messageId: id },
          });
        } catch {}
      }
      if (msgData.bugData?.id) {
        try {
          await prisma.bug.update({
            where: { id: msgData.bugData.id },
            data: { messageId: id },
          });
        } catch {}
      }
    } catch (err) {
      console.error('Error persisting message in TiDB:', err);
    }
  }

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

  saveStoreToDisk();

  return {
    ...newMsg,
    sender: store.users.get(newMsg.senderId),
  };
}

export async function updateMessage(messageId: string, content: string): Promise<Message | null> {
  const msg = store.messages.find((m) => m.id === messageId);
  if (!msg) return null;
  msg.content = content.trim();
  msg.isEdited = true;
  msg.updatedAt = new Date().toISOString();
  saveStoreToDisk();
  return {
    ...msg,
    sender: store.users.get(msg.senderId),
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

  saveStoreToDisk();

  return {
    ...msg,
    sender: store.users.get(msg.senderId),
  };
}

export async function deleteMessage(messageId: string): Promise<boolean> {
  if (isDatabaseConfigured) {
    try {
      await prisma.message.update({
        where: { id: messageId },
        data: { deletedAt: new Date() },
      });
    } catch {}
  }
  const idx = store.messages.findIndex((m) => m.id === messageId);
  if (idx !== -1) {
    store.messages.splice(idx, 1);
    saveStoreToDisk();
  }
  return true;
}

// ================= TASK OPERATIONS =================
export async function getTasks(projectId: string): Promise<Task[]> {
  if (isDatabaseConfigured) {
    try {
      const dbTasks = await prisma.task.findMany({
        where: { projectId },
        include: {
          assignee: true,
          creator: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (dbTasks && dbTasks.length > 0) {
        return dbTasks.map((t) => ({
          id: t.id,
          projectId: t.projectId,
          messageId: t.messageId || undefined,
          title: t.title,
          description: t.description || undefined,
          priority: t.priority as any,
          status: t.status as any,
          assignedTo: t.assignedTo || undefined,
          assigneeUser: t.assignee
            ? {
                id: t.assignee.id,
                name: t.assignee.name,
                email: t.assignee.email,
                avatarUrl: t.assignee.avatarUrl || '',
                title: t.assignee.headline || 'Developer',
                skills: [],
                status: t.assignee.status as any,
              }
            : (t.assignedTo ? store.users.get(t.assignedTo) : undefined),
          createdBy: t.createdBy,
          creatorUser: t.creator
            ? {
                id: t.creator.id,
                name: t.creator.name,
                email: t.creator.email,
                avatarUrl: t.creator.avatarUrl || '',
                title: t.creator.headline || 'Developer',
                skills: [],
                status: t.creator.status as any,
              }
            : store.users.get(t.createdBy),
          dueDate: t.dueDate ? t.dueDate.toISOString() : undefined,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }));
      }
    } catch (err) {}
  }

  const tasks = Array.from(store.tasks.values()).filter((t) => t.projectId === projectId);
  return tasks.map((t) => ({
    ...t,
    assigneeUser: t.assignedTo ? store.users.get(t.assignedTo) : undefined,
    creatorUser: store.users.get(t.createdBy),
  }));
}

export async function createTask(taskData: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
  let createdTask: Task | null = null;
  const parsedDueDate = taskData.dueDate && !isNaN(Date.parse(taskData.dueDate)) ? new Date(taskData.dueDate) : null;

  if (isDatabaseConfigured) {
    try {
      const dbTask = await prisma.task.create({
        data: {
          projectId: taskData.projectId,
          messageId: taskData.messageId || null,
          title: taskData.title,
          description: taskData.description || null,
          priority: taskData.priority || 'MEDIUM',
          status: taskData.status || 'TODO',
          assignedTo: taskData.assignedTo || null,
          createdBy: taskData.createdBy || 'user_creator',
          dueDate: parsedDueDate,
        },
        include: {
          assignee: true,
          creator: true,
        },
      });

      createdTask = {
        id: dbTask.id,
        projectId: dbTask.projectId,
        messageId: dbTask.messageId || undefined,
        title: dbTask.title,
        description: dbTask.description || undefined,
        priority: dbTask.priority as any,
        status: dbTask.status as any,
        assignedTo: dbTask.assignedTo || undefined,
        assigneeUser: dbTask.assignee
          ? {
              id: dbTask.assignee.id,
              name: dbTask.assignee.name,
              email: dbTask.assignee.email,
              avatarUrl: dbTask.assignee.avatarUrl || '',
              title: dbTask.assignee.headline || 'Developer',
              skills: [],
              status: dbTask.assignee.status as any,
            }
          : (dbTask.assignedTo ? store.users.get(dbTask.assignedTo) : undefined),
        createdBy: dbTask.createdBy,
        creatorUser: dbTask.creator
          ? {
              id: dbTask.creator.id,
              name: dbTask.creator.name,
              email: dbTask.creator.email,
              avatarUrl: dbTask.creator.avatarUrl || '',
              title: dbTask.creator.headline || 'Developer',
              skills: [],
              status: dbTask.creator.status as any,
            }
          : store.users.get(dbTask.createdBy),
        dueDate: dbTask.dueDate ? dbTask.dueDate.toISOString() : (taskData.dueDate || undefined),
        createdAt: dbTask.createdAt.toISOString(),
        updatedAt: dbTask.updatedAt.toISOString(),
      };
    } catch (err) {}
  }

  if (!createdTask) {
    const id = `task_${Date.now()}`;
    createdTask = {
      ...taskData,
      id,
      createdAt: new Date().toISOString(),
      assigneeUser: taskData.assignedTo ? store.users.get(taskData.assignedTo) : undefined,
      creatorUser: store.users.get(taskData.createdBy),
    };
  }

  store.tasks.set(createdTask.id, createdTask);

  // Structured Activity log
  await logActivity({
    projectId: createdTask.projectId,
    userId: createdTask.createdBy,
    actionType: 'TASK_CREATED',
    entityId: createdTask.id,
    entityType: 'TASK',
    metadata: {
      title: createdTask.title,
      description: createdTask.description,
      priority: createdTask.priority,
      status: createdTask.status,
      assignedTo: createdTask.assignedTo,
    },
    title: `Task created: ${createdTask.title}`,
    details: createdTask.description || `Priority: ${createdTask.priority}`,
  });

  // Realtime broadcast
  await emitRealtimeEvent('task_updated', {
    projectId: createdTask.projectId,
    task: createdTask,
    action: 'CREATED',
  });

  saveStoreToDisk();

  return createdTask;
}

export async function updateTask(id: string, partial: Partial<Task>): Promise<Task | null> {
  const existing = store.tasks.get(id);
  const parsedDueDate = partial.dueDate && !isNaN(Date.parse(partial.dueDate)) ? new Date(partial.dueDate) : undefined;

  let updatedTask: Task | null = null;
  if (isDatabaseConfigured) {
    try {
      const updateData: any = {};
      if (partial.title !== undefined) updateData.title = partial.title;
      if (partial.description !== undefined) updateData.description = partial.description;
      if (partial.priority !== undefined) updateData.priority = partial.priority;
      if (partial.status !== undefined) updateData.status = partial.status;
      if (partial.assignedTo !== undefined) updateData.assignedTo = partial.assignedTo;
      if (parsedDueDate !== undefined) updateData.dueDate = parsedDueDate;

      let targetDbId = id;
      try {
        const dbTask = await prisma.task.update({
          where: { id: targetDbId },
          data: updateData,
          include: { assignee: true, creator: true },
        });
        targetDbId = dbTask.id;
      } catch {
        // If not found by direct ID, try finding by messageId or stripped task_ prefix
        const possibleMsgId = id.replace(/^task_/, '');
        const foundTask = await prisma.task.findFirst({
          where: {
            OR: [
              { messageId: id },
              { messageId: possibleMsgId },
            ],
          },
        });
        if (foundTask) {
          targetDbId = foundTask.id;
          await prisma.task.update({
            where: { id: targetDbId },
            data: updateData,
          });
        }
      }

      const dbTask = await prisma.task.findUnique({
        where: { id: targetDbId },
        include: { assignee: true, creator: true },
      });

      if (dbTask) {
        updatedTask = {
          id: dbTask.id,
          projectId: dbTask.projectId,
          messageId: dbTask.messageId || undefined,
          title: dbTask.title,
          description: dbTask.description || undefined,
          priority: dbTask.priority as any,
          status: dbTask.status as any,
          assignedTo: dbTask.assignedTo || undefined,
          assigneeUser: dbTask.assignee
            ? {
                id: dbTask.assignee.id,
                name: dbTask.assignee.name,
                email: dbTask.assignee.email,
                avatarUrl: dbTask.assignee.avatarUrl || '',
                title: dbTask.assignee.headline || 'Developer',
                skills: [],
                status: dbTask.assignee.status as any,
              }
            : (dbTask.assignedTo ? store.users.get(dbTask.assignedTo) : undefined),
          createdBy: dbTask.createdBy,
          creatorUser: dbTask.creator
            ? {
                id: dbTask.creator.id,
                name: dbTask.creator.name,
                email: dbTask.creator.email,
                avatarUrl: dbTask.creator.avatarUrl || '',
                title: dbTask.creator.headline || 'Developer',
                skills: [],
                status: dbTask.creator.status as any,
              }
            : store.users.get(dbTask.createdBy),
          dueDate: dbTask.dueDate ? dbTask.dueDate.toISOString() : undefined,
          createdAt: dbTask.createdAt.toISOString(),
          updatedAt: dbTask.updatedAt.toISOString(),
        };
      }
    } catch (err) {}
  }

  if (!updatedTask) {
    if (!existing) return null;
    updatedTask = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString(),
      assigneeUser: (partial.assignedTo || existing.assignedTo) ? store.users.get(partial.assignedTo || existing.assignedTo!) : undefined,
      creatorUser: store.users.get(existing.createdBy),
    };
  }

  // Sync linked message metadata and in-memory store
  if (isDatabaseConfigured && updatedTask.messageId) {
    try {
      const dbMsg = await prisma.message.findUnique({ where: { id: updatedTask.messageId } });
      if (dbMsg) {
        let metaObj: any = {};
        try { if (dbMsg.metadata) metaObj = JSON.parse(dbMsg.metadata); } catch {}
        metaObj.status = updatedTask.status;
        metaObj.priority = updatedTask.priority;
        metaObj.taskId = updatedTask.id;
        await prisma.message.update({
          where: { id: updatedTask.messageId },
          data: { metadata: JSON.stringify(metaObj) },
        });
      }
    } catch {}
  }

  for (const m of store.messages) {
    if (m.taskData && (m.taskData.id === id || m.taskData.id === updatedTask.id || m.id === updatedTask.messageId)) {
      m.taskData.status = updatedTask.status;
      if (partial.priority) m.taskData.priority = partial.priority;
    }
  }

  store.tasks.set(id, updatedTask);
  store.tasks.set(updatedTask.id, updatedTask);

  // Activity log for status or assignment change
  const statusChanged = existing && existing.status !== updatedTask.status;
  await logActivity({
    projectId: updatedTask.projectId,
    userId: partial.assignedTo || updatedTask.createdBy,
    actionType: 'TASK_UPDATED',
    entityId: updatedTask.id,
    entityType: 'TASK',
    metadata: {
      title: updatedTask.title,
      status: updatedTask.status,
      priority: updatedTask.priority,
      previousStatus: existing?.status,
    },
    title: statusChanged
      ? `Task moved to ${updatedTask.status}: ${updatedTask.title}`
      : `Task updated: ${updatedTask.title}`,
    details: statusChanged ? `Status changed from ${existing?.status} to ${updatedTask.status}` : updatedTask.description,
  });

  await emitRealtimeEvent('task_updated', {
    projectId: updatedTask.projectId,
    task: updatedTask,
    action: 'UPDATED',
  });

  saveStoreToDisk();

  return updatedTask;
}

// ================= BUG OPERATIONS =================
export async function getBugs(projectId: string): Promise<Bug[]> {
  if (isDatabaseConfigured) {
    try {
      const dbBugs = await prisma.bug.findMany({
      where: { projectId },
      include: {
        assignee: true,
        reporter: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (dbBugs && dbBugs.length > 0) {
      return dbBugs.map((b) => ({
        id: b.id,
        projectId: b.projectId,
        messageId: b.messageId || undefined,
        title: b.title,
        description: b.description || undefined,
        endpoint: b.endpoint || undefined,
        priority: b.priority as any,
        status: b.status as any,
        assignedTo: b.assignedTo || undefined,
        assigneeUser: b.assignee
          ? {
              id: b.assignee.id,
              name: b.assignee.name,
              email: b.assignee.email,
              avatarUrl: b.assignee.avatarUrl || '',
              title: b.assignee.headline || 'Developer',
              skills: [],
              status: b.assignee.status as any,
            }
          : (b.assignedTo ? store.users.get(b.assignedTo) : undefined),
        createdBy: b.createdBy,
        creatorUser: b.reporter
          ? {
              id: b.reporter.id,
              name: b.reporter.name,
              email: b.reporter.email,
              avatarUrl: b.reporter.avatarUrl || '',
              title: b.reporter.headline || 'Developer',
              skills: [],
              status: b.reporter.status as any,
            }
          : store.users.get(b.createdBy),
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      }));
    }
  } catch (err) {}
  }

  const bugs = Array.from(store.bugs.values()).filter((b) => b.projectId === projectId);
  return bugs.map((b) => ({
    ...b,
    assigneeUser: b.assignedTo ? store.users.get(b.assignedTo) : undefined,
    creatorUser: store.users.get(b.createdBy),
  }));
}

export async function createBug(bugData: Omit<Bug, 'id' | 'createdAt'>): Promise<Bug> {
  let createdBug: Bug | null = null;

  if (isDatabaseConfigured) {
    try {
      const dbBug = await prisma.bug.create({
        data: {
          projectId: bugData.projectId,
          messageId: bugData.messageId || null,
          title: bugData.title,
          description: bugData.description || null,
          endpoint: bugData.endpoint || null,
          priority: bugData.priority || 'HIGH',
          status: bugData.status || 'OPEN',
          assignedTo: bugData.assignedTo || null,
          createdBy: bugData.createdBy || 'user_creator',
        },
        include: {
          assignee: true,
          reporter: true,
        },
      });

      createdBug = {
        id: dbBug.id,
        projectId: dbBug.projectId,
        messageId: dbBug.messageId || undefined,
        title: dbBug.title,
        description: dbBug.description || undefined,
        endpoint: dbBug.endpoint || undefined,
        priority: dbBug.priority as any,
        status: dbBug.status as any,
        assignedTo: dbBug.assignedTo || undefined,
        assigneeUser: dbBug.assignee
          ? {
              id: dbBug.assignee.id,
              name: dbBug.assignee.name,
              email: dbBug.assignee.email,
              avatarUrl: dbBug.assignee.avatarUrl || '',
              title: dbBug.assignee.headline || 'Developer',
              skills: [],
              status: dbBug.assignee.status as any,
            }
          : (dbBug.assignedTo ? store.users.get(dbBug.assignedTo) : undefined),
        createdBy: dbBug.createdBy,
        creatorUser: dbBug.reporter
          ? {
              id: dbBug.reporter.id,
              name: dbBug.reporter.name,
              email: dbBug.reporter.email,
              avatarUrl: dbBug.reporter.avatarUrl || '',
              title: dbBug.reporter.headline || 'Developer',
              skills: [],
              status: dbBug.reporter.status as any,
            }
          : store.users.get(dbBug.createdBy),
        createdAt: dbBug.createdAt.toISOString(),
        updatedAt: dbBug.updatedAt.toISOString(),
      };
    } catch (err) {}
  }

  if (!createdBug) {
    const id = `bug_${Date.now()}`;
    createdBug = {
      ...bugData,
      id,
      createdAt: new Date().toISOString(),
      assigneeUser: bugData.assignedTo ? store.users.get(bugData.assignedTo) : undefined,
      creatorUser: store.users.get(bugData.createdBy),
    };
  }

  store.bugs.set(createdBug.id, createdBug);

  // Structured Activity log
  await logActivity({
    projectId: createdBug.projectId,
    userId: createdBug.createdBy,
    actionType: 'BUG_REPORTED',
    entityId: createdBug.id,
    entityType: 'BUG',
    metadata: {
      title: createdBug.title,
      endpoint: createdBug.endpoint,
      priority: createdBug.priority,
      status: createdBug.status,
      assignedTo: createdBug.assignedTo,
    },
    title: `Bug reported: ${createdBug.title}`,
    details: `${createdBug.endpoint ? `Endpoint: ${createdBug.endpoint} • ` : ''}${createdBug.description || ''}`,
  });

  // Realtime broadcast
  await emitRealtimeEvent('bug_updated', {
    projectId: createdBug.projectId,
    bug: createdBug,
    action: 'CREATED',
  });

  saveStoreToDisk();

  return createdBug;
}

export async function updateBug(id: string, partial: Partial<Bug>): Promise<Bug | null> {
  const existing = store.bugs.get(id);

  let updatedBug: Bug | null = null;
  if (isDatabaseConfigured) {
    try {
      const updateData: any = {};
      if (partial.title !== undefined) updateData.title = partial.title;
      if (partial.description !== undefined) updateData.description = partial.description;
      if (partial.endpoint !== undefined) updateData.endpoint = partial.endpoint;
      if (partial.priority !== undefined) updateData.priority = partial.priority;
      if (partial.status !== undefined) updateData.status = partial.status;
      if (partial.assignedTo !== undefined) updateData.assignedTo = partial.assignedTo;

      let targetDbId = id;
      try {
        const dbBug = await prisma.bug.update({
          where: { id: targetDbId },
          data: updateData,
          include: { assignee: true, reporter: true },
        });
        targetDbId = dbBug.id;
      } catch {
        // If not found by direct ID, try finding by messageId or stripped bug_ prefix
        const possibleMsgId = id.replace(/^bug_/, '');
        const foundBug = await prisma.bug.findFirst({
          where: {
            OR: [
              { messageId: id },
              { messageId: possibleMsgId },
            ],
          },
        });
        if (foundBug) {
          targetDbId = foundBug.id;
          await prisma.bug.update({
            where: { id: targetDbId },
            data: updateData,
          });
        }
      }

      const dbBug = await prisma.bug.findUnique({
        where: { id: targetDbId },
        include: { assignee: true, reporter: true },
      });

      if (dbBug) {
        updatedBug = {
          id: dbBug.id,
          projectId: dbBug.projectId,
          messageId: dbBug.messageId || undefined,
          title: dbBug.title,
          description: dbBug.description || undefined,
          endpoint: dbBug.endpoint || undefined,
          priority: dbBug.priority as any,
          status: dbBug.status as any,
          assignedTo: dbBug.assignedTo || undefined,
          assigneeUser: dbBug.assignee
            ? {
                id: dbBug.assignee.id,
                name: dbBug.assignee.name,
                email: dbBug.assignee.email,
                avatarUrl: dbBug.assignee.avatarUrl || '',
                title: dbBug.assignee.headline || 'Developer',
                skills: [],
                status: dbBug.assignee.status as any,
              }
            : (dbBug.assignedTo ? store.users.get(dbBug.assignedTo) : undefined),
          createdBy: dbBug.createdBy,
          creatorUser: dbBug.reporter
            ? {
                id: dbBug.reporter.id,
                name: dbBug.reporter.name,
                email: dbBug.reporter.email,
                avatarUrl: dbBug.reporter.avatarUrl || '',
                title: dbBug.reporter.headline || 'Developer',
                skills: [],
                status: dbBug.reporter.status as any,
              }
            : store.users.get(dbBug.createdBy),
          createdAt: dbBug.createdAt.toISOString(),
          updatedAt: dbBug.updatedAt.toISOString(),
        };
      }
    } catch (err) {}
  }

  if (!updatedBug) {
    if (!existing) return null;
    updatedBug = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString(),
      assigneeUser: (partial.assignedTo || existing.assignedTo) ? store.users.get(partial.assignedTo || existing.assignedTo!) : undefined,
      creatorUser: store.users.get(existing.createdBy),
    };
  }

  // Sync linked message metadata and in-memory store
  if (isDatabaseConfigured && updatedBug.messageId) {
    try {
      const dbMsg = await prisma.message.findUnique({ where: { id: updatedBug.messageId } });
      if (dbMsg) {
        let metaObj: any = {};
        try { if (dbMsg.metadata) metaObj = JSON.parse(dbMsg.metadata); } catch {}
        metaObj.status = updatedBug.status;
        metaObj.priority = updatedBug.priority;
        metaObj.bugId = updatedBug.id;
        await prisma.message.update({
          where: { id: updatedBug.messageId },
          data: { metadata: JSON.stringify(metaObj) },
        });
      }
    } catch {}
  }

  for (const m of store.messages) {
    if (m.bugData && (m.bugData.id === id || m.bugData.id === updatedBug.id || m.id === updatedBug.messageId)) {
      m.bugData.status = updatedBug.status;
      if (partial.priority) m.bugData.priority = partial.priority;
    }
  }

  store.bugs.set(id, updatedBug);
  store.bugs.set(updatedBug.id, updatedBug);

  const statusChanged = existing && existing.status !== updatedBug.status;
  await logActivity({
    projectId: updatedBug.projectId,
    userId: partial.assignedTo || updatedBug.createdBy,
    actionType: statusChanged ? 'BUG_STATUS_CHANGED' : 'BUG_REPORTED',
    entityId: updatedBug.id,
    entityType: 'BUG',
    metadata: {
      title: updatedBug.title,
      status: updatedBug.status,
      priority: updatedBug.priority,
      previousStatus: existing?.status,
    },
    title: statusChanged
      ? `Bug moved to ${updatedBug.status}: ${updatedBug.title}`
      : `Bug updated: ${updatedBug.title}`,
    details: statusChanged ? `Status changed from ${existing?.status} to ${updatedBug.status}` : (updatedBug.description || ''),
  });

  await emitRealtimeEvent('bug_updated', {
    projectId: updatedBug.projectId,
    bug: updatedBug,
    action: 'UPDATED',
  });

  saveStoreToDisk();

  return updatedBug;
}

// ================= ATTACHMENT OPERATIONS =================
export async function getAttachments(projectId: string): Promise<Attachment[]> {
  if (isDatabaseConfigured) {
    try {
      const dbAttachments = await prisma.attachment.findMany({
        where: { projectId },
        include: {
          uploader: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (dbAttachments && dbAttachments.length > 0) {
        return dbAttachments.map((a) => ({
          id: a.id,
          messageId: a.messageId || undefined,
          projectId: a.projectId || undefined,
          uploaderId: a.uploaderId,
          userId: a.uploaderId,
          fileName: a.fileName,
          fileType: a.fileType,
          mimeType: a.fileType,
          fileSize: a.fileSize,
          storageProvider: a.storageProvider,
          storageKey: a.storageKey,
          fileUrl: a.fileUrl || undefined,
          createdAt: a.createdAt.toISOString(),
          uploader: a.uploader
            ? {
                id: a.uploader.id,
                name: a.uploader.name,
                email: a.uploader.email,
                avatarUrl: a.uploader.avatarUrl || '',
                title: a.uploader.headline || 'Developer',
                skills: a.uploader.skills ? JSON.parse(a.uploader.skills) : [],
                status: a.uploader.status as any,
              }
            : undefined,
        }));
      }
    } catch (err) {
      // Fallback to in-memory store
    }
  }
  return Array.from(store.attachments.values()).filter((a) => a.projectId === projectId);
}

export async function getAttachmentById(id: string): Promise<Attachment | null> {
  if (isDatabaseConfigured) {
    try {
      const att = await prisma.attachment.findUnique({
        where: { id },
        include: {
          uploader: true,
          project: true,
          message: true,
        },
      });
      if (att) {
        return {
          id: att.id,
          messageId: att.messageId || undefined,
          projectId: att.projectId || undefined,
          uploaderId: att.uploaderId,
          userId: att.uploaderId,
          fileName: att.fileName,
          fileType: att.fileType,
          mimeType: att.fileType,
          fileSize: att.fileSize,
          storageProvider: att.storageProvider,
          storageKey: att.storageKey,
          fileUrl: att.fileUrl || undefined,
          createdAt: att.createdAt.toISOString(),
          uploader: att.uploader
            ? {
                id: att.uploader.id,
                name: att.uploader.name,
                email: att.uploader.email,
                avatarUrl: att.uploader.avatarUrl || '',
                title: att.uploader.headline || 'Developer',
                skills: [],
                status: att.uploader.status as any,
              }
            : undefined,
        };
      }
    } catch {}
  }
  return store.attachments.get(id) || null;
}

export async function createAttachment(data: {
  id?: string;
  projectId?: string;
  messageId?: string;
  uploaderId?: string;
  userId?: string;
  fileName: string;
  fileType?: string;
  mimeType?: string;
  fileSize: number;
  storageProvider?: string;
  storageKey: string;
  fileUrl?: string;
}): Promise<Attachment> {
  const uploaderId = data.uploaderId || data.userId || 'user_uploader';
  const fileType = data.fileType || data.mimeType || 'application/octet-stream';
  const storageProvider = data.storageProvider || 'backblaze_b2';

  let created: Attachment | null = null;
  if (isDatabaseConfigured) {
    try {
      const dbRecord = await prisma.attachment.create({
        data: {
          id: data.id,
          projectId: data.projectId || null,
          messageId: data.messageId || null,
          uploaderId,
          fileName: data.fileName,
          fileType,
          fileSize: data.fileSize,
          storageProvider,
          storageKey: data.storageKey,
          fileUrl: data.fileUrl || null,
        },
      });
      created = {
        id: dbRecord.id,
        projectId: dbRecord.projectId || undefined,
        messageId: dbRecord.messageId || undefined,
        uploaderId: dbRecord.uploaderId,
        userId: dbRecord.uploaderId,
        fileName: dbRecord.fileName,
        fileType: dbRecord.fileType,
        mimeType: dbRecord.fileType,
        fileSize: dbRecord.fileSize,
        storageProvider: dbRecord.storageProvider,
        storageKey: dbRecord.storageKey,
        fileUrl: dbRecord.fileUrl || undefined,
        createdAt: dbRecord.createdAt.toISOString(),
      };
    } catch {
      // If TiDB create fails, proceed to store fallback
    }
  }

  if (!created) {
    const id = data.id || `att_${Date.now()}`;
    created = {
      id,
      projectId: data.projectId,
      messageId: data.messageId,
      uploaderId,
      userId: uploaderId,
      fileName: data.fileName,
      fileType,
      mimeType: fileType,
      fileSize: data.fileSize,
      storageProvider,
      storageKey: data.storageKey,
      fileUrl: data.fileUrl || '',
      createdAt: new Date().toISOString(),
    };
  }

  store.attachments.set(created.id, created);

  // Activity log
  if (created.projectId) {
    store.activity.unshift({
      id: `act_${Date.now()}`,
      projectId: created.projectId,
      userId: created.uploaderId,
      userName: store.users.get(created.uploaderId || '')?.name || 'Developer',
      eventType: 'FILE_UPLOADED',
      title: `File uploaded: ${created.fileName}`,
      details: `${(created.fileSize / 1024).toFixed(1)} KB stored in Backblaze B2`,
      timestamp: 'Just now',
    });
  }

  return created;
}

export async function updateAttachment(
  id: string,
  partial: Partial<Attachment>
): Promise<Attachment | null> {
  if (isDatabaseConfigured) {
    try {
      const updatedDb = await prisma.attachment.update({
        where: { id },
        data: {
          messageId: partial.messageId,
          projectId: partial.projectId,
          fileName: partial.fileName,
          fileType: partial.fileType || partial.mimeType,
          fileSize: partial.fileSize,
          storageKey: partial.storageKey,
          fileUrl: partial.fileUrl,
        },
      });
      const updated: Attachment = {
        id: updatedDb.id,
        messageId: updatedDb.messageId || undefined,
        projectId: updatedDb.projectId || undefined,
        uploaderId: updatedDb.uploaderId,
        userId: updatedDb.uploaderId,
        fileName: updatedDb.fileName,
        fileType: updatedDb.fileType,
        mimeType: updatedDb.fileType,
        fileSize: updatedDb.fileSize,
        storageProvider: updatedDb.storageProvider,
        storageKey: updatedDb.storageKey,
        fileUrl: updatedDb.fileUrl || undefined,
        createdAt: updatedDb.createdAt.toISOString(),
      };
      store.attachments.set(id, updated);
      return updated;
    } catch {}
  }

  const existing = store.attachments.get(id);
  if (!existing) return null;
  const merged = { ...existing, ...partial };
  store.attachments.set(id, merged);
  return merged;
}

// ================= ACTIVITY OPERATIONS =================
export async function getActivity(projectId: string): Promise<ActivityLog[]> {
  try {
    const { activities } = await getActivityFeed(projectId);
    if (activities && activities.length > 0) return activities;
  } catch {}
  return store.activity.filter((act) => act.projectId === projectId);
}

// ================= CONVERSATIONS (1-TO-1) =================
export async function getConversations(userId: string): Promise<DirectConversation[]> {
  const allUsers = await getUsers();
  const otherUsers = allUsers.filter(
    (u) => u.id !== userId && !u.email.endsWith('@test.dev') && !u.email.endsWith('@example.com')
  );

  const convList = otherUsers.map((other) => {
    // Look up recent message between users
    const conversationId = [userId, other.id].sort().join('_');
    const recentMessages = store.messages.filter(
      (m) =>
        m.conversationId === conversationId ||
        m.conversationId === `dm_${userId}_${other.id}` ||
        m.conversationId === `dm_${other.id}_${userId}`
    );
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

  // Sort conversations: most recent message/activity moves to the TOP
  convList.sort((a, b) => {
    const timeA =
      a.lastActivity && a.lastActivity !== 'Recently' && a.lastActivity !== 'Just now'
        ? new Date(a.lastActivity).getTime()
        : 0;
    const timeB =
      b.lastActivity && b.lastActivity !== 'Recently' && b.lastActivity !== 'Just now'
        ? new Date(b.lastActivity).getTime()
        : 0;
    return timeB - timeA;
  });

  return convList;
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

// ================= NOTIFICATION OPERATIONS =================
export async function getNotificationsFromStore(
  recipientId: string,
  options?: { unreadOnly?: boolean; priority?: string; page?: number; limit?: number }
): Promise<{ notifications: AppNotification[]; total: number; unreadCount: number }> {
  // 1. Try Prisma TiDB if model exists, db configured, and query succeeds
  if (isDatabaseConfigured && (prisma as any)?.notification) {
    try {
      const where: any = { recipientId };
      if (options?.unreadOnly) where.read = false;
      if (options?.priority) where.priority = options.priority;

      const page = Math.max(1, options?.page || 1);
      const limit = Math.min(50, options?.limit || 20);

      const [notifications, total, unreadCount] = await Promise.all([
        (prisma as any).notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
            project: { select: { id: true, name: true } },
          },
        }),
        (prisma as any).notification.count({ where }),
        (prisma as any).notification.count({ where: { recipientId, read: false } }),
      ]);
      return { notifications, total, unreadCount };
    } catch (err) {
      console.warn('[Notifications] Prisma findMany failed, falling back to memory store:', err);
    }
  }

  // 2. Fallback to resilient in-memory store
  const notifsMap = store.notifications ?? new Map<string, AppNotification>();
  const all = Array.from(notifsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  let filtered = all.filter((n) => !n.recipientId || (n as any).recipientId === recipientId);
  if (options?.unreadOnly) filtered = filtered.filter((n) => !n.read);
  if (options?.priority) filtered = filtered.filter((n) => n.priority === options.priority);

  const unreadCount = all.filter((n) => (!n.recipientId || (n as any).recipientId === recipientId) && !n.read).length;
  const page = Math.max(1, options?.page || 1);
  const limit = Math.min(50, options?.limit || 20);
  const paged = filtered.slice((page - 1) * limit, page * limit);

  return { notifications: paged, total: filtered.length, unreadCount };
}

export async function createNotificationInStore(data: {
  id?: string;
  recipientId: string;
  senderId?: string;
  projectId?: string;
  type: any;
  priority?: any;
  title: string;
  message: string;
  entityId?: string;
  entityType?: any;
}): Promise<AppNotification> {
  const notifsMap = store.notifications ?? (store.notifications = new Map());
  const notifId = data.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sender = data.senderId ? store.users.get(data.senderId) : undefined;
  const project = data.projectId ? store.projects.get(data.projectId) : undefined;

  const notif: AppNotification = {
    id: notifId,
    type: data.type,
    priority: data.priority || 'NORMAL',
    title: data.title,
    message: data.message,
    entityId: data.entityId,
    entityType: data.entityType,
    senderId: data.senderId,
    sender: sender ? { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl } : undefined,
    projectId: data.projectId,
    project: project ? { id: project.id, name: project.name } : undefined,
    read: false,
    createdAt: new Date().toISOString(),
  };

  notifsMap.set(notifId, notif);
  return notif;
}

export async function markNotificationReadInStore(id: string, recipientId: string): Promise<AppNotification | null> {
  // Try Prisma first
  if (isDatabaseConfigured && (prisma as any)?.notification) {
    try {
      const updated = await (prisma as any).notification.update({
        where: { id },
        data: { read: true },
      });
      return updated as AppNotification;
    } catch {}
  }

  const notifsMap = store.notifications ?? new Map();
  const notif = notifsMap.get(id);
  if (notif) {
    notif.read = true;
    notifsMap.set(id, { ...notif });
    return notif;
  }
  return null;
}

export async function markAllNotificationsReadInStore(recipientId: string): Promise<number> {
  // Try Prisma first
  if (isDatabaseConfigured && (prisma as any)?.notification) {
    try {
      const res = await (prisma as any).notification.updateMany({
        where: { recipientId, read: false },
        data: { read: true },
      });
      return res.count;
    } catch {}
  }

  const notifsMap = store.notifications ?? new Map();
  let count = 0;
  for (const [id, notif] of notifsMap.entries()) {
    if ((!notif.recipientId || (notif as any).recipientId === recipientId) && !notif.read) {
      notif.read = true;
      notifsMap.set(id, { ...notif });
      count++;
    }
  }
  return count;
}

export async function getNotificationPreferencesFromStore(userId: string): Promise<NotificationPreferences> {
  if (isDatabaseConfigured && (prisma as any)?.notificationPreference) {
    try {
      const prefs = await (prisma as any).notificationPreference.findUnique({ where: { userId } });
      if (prefs) return prefs as NotificationPreferences;
    } catch {}
  }

  const prefsMap = store.notificationPreferences ?? (store.notificationPreferences = new Map());
  const existing = prefsMap.get(userId);
  if (existing) return existing;

  const defaults: NotificationPreferences = {
    userId,
    emailOnTaskAssigned: true,
    emailOnTaskCompleted: true,
    emailOnBugAssigned: true,
    emailOnMention: true,
    inAppAll: true,
  };
  prefsMap.set(userId, defaults);
  return defaults;
}

export async function updateNotificationPreferencesInStore(
  userId: string,
  partial: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  if (isDatabaseConfigured && (prisma as any)?.notificationPreference) {
    try {
      const updated = await (prisma as any).notificationPreference.upsert({
        where: { userId },
        create: { userId, ...partial },
        update: partial,
      });
      return updated as NotificationPreferences;
    } catch {}
  }

  const prefsMap = store.notificationPreferences ?? (store.notificationPreferences = new Map());
  const current = await getNotificationPreferencesFromStore(userId);
  const updated: NotificationPreferences = { ...current, ...partial, userId };
  prefsMap.set(userId, updated);
  return updated;
}

