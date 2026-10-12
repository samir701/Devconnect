export type UserStatus = 'ONLINE' | 'AWAY' | 'OFFLINE';
export type ProjectRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'QA' | 'VIEWER';
export type MessageType = 'TEXT' | 'CODE' | 'FILE' | 'IMAGE' | 'BUG' | 'TASK' | 'SYSTEM';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';
export type BugStatus = 'OPEN' | 'INVESTIGATING' | 'IN_PROGRESS' | 'FIXED' | 'CLOSED';
export type StorageProvider = 'BACKBLAZE_B2' | 'LOCAL' | 'S3';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  title: string;
  bio?: string;
  skills: string[];
  github?: string;
  linkedin?: string;
  status: UserStatus;
  lastSeen?: string;
  currentProjectId?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  githubRepo?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'PAUSED';
  channels: string[];
  createdAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  user?: User;
}

export interface DirectConversation {
  id: string;
  participantIds: [string, string];
  otherUser?: User;
  lastMessage?: string;
  lastActivity: string;
  unreadCount?: number;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface Attachment {
  id: string;
  messageId?: string;
  projectId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  fileSize: number; // in bytes
  storageProvider: StorageProvider;
  storageKey: string;
  fileUrl: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  messageId?: string;
  title: string;
  description?: string;
  priority: PriorityLevel;
  status: TaskStatus;
  assignedTo?: string;
  assigneeUser?: User;
  createdBy: string;
  creatorUser?: User;
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Bug {
  id: string;
  projectId: string;
  messageId?: string;
  title: string;
  description?: string;
  endpoint?: string;
  priority: PriorityLevel;
  status: BugStatus;
  assignedTo?: string;
  assigneeUser?: User;
  createdBy: string;
  creatorUser?: User;
  createdAt: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  projectId?: string;
  conversationId?: string;
  channel?: string;
  senderId: string;
  sender?: User;
  messageType: MessageType;
  content: string;
  codeLanguage?: string;
  codeFilename?: string;
  taskData?: Task;
  bugData?: Bug;
  attachmentData?: Attachment;
  reactions?: MessageReaction[];
  replyToMessageId?: string;
  replyToMessage?: {
    id: string;
    senderName: string;
    content: string;
  };
  isPinned?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  projectId: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  eventType: 'COMMIT' | 'PR_OPEN' | 'PR_COMMENT' | 'PR_MERGE' | 'TASK_CREATED' | 'BUG_REPORTED' | 'BUG_RESOLVED' | 'FILE_UPLOADED';
  title: string;
  details?: string;
  refName?: string;
  timestamp: string;
}

export interface SecretDetectionResult {
  hasSecret: boolean;
  secretType?: string;
  matchedText?: string;
  hint?: string;
}
