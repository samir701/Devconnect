export type UserStatus = 'AVAILABLE' | 'ONLINE' | 'AWAY' | 'OFFLINE';
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
  headline?: string;
  bio?: string;
  skills: string[];
  github?: string;
  githubUrl?: string;
  linkedin?: string;
  linkedinUrl?: string;
  status: UserStatus;
  lastSeen?: string;
  currentProjectId?: string;
  passwordHash?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  githubRepo?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'PAUSED';
  channels: string[];
  maxMembers?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  user?: User;
}

export type ConversationType = 'DIRECT' | 'PROJECT_CHANNEL';

export interface Conversation {
  id: string;
  type: ConversationType;
  projectId?: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  members?: ConversationMember[];
  otherUser?: User;
  unreadCount?: number;
  lastMessage?: string;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadAt?: string;
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
  projectId?: string;
  uploaderId?: string;
  userId?: string; // backwards compatibility alias
  fileName: string;
  fileType?: string; // MIME type
  mimeType?: string; // backwards compatibility alias
  fileSize: number; // in bytes
  storageProvider?: string;
  storageKey: string;
  fileUrl?: string;
  createdAt: string;
  uploader?: User;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  attachmentId?: string;
  storageKey: string;
  isCloudB2: boolean;
  bucket?: string;
  expiresIn?: number;
  headers?: Record<string, string>;
  attachment?: Attachment;
}

export interface ConfirmUploadRequest {
  attachmentId: string;
  messageId?: string;
  projectId?: string;
  conversationId?: string;
}

export interface ConfirmUploadResponse {
  success: boolean;
  attachment: Attachment;
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
  assignee?: User;
  createdBy: string;
  creatorUser?: User;
  creator?: User;
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
  assignee?: User;
  createdBy: string;
  creatorUser?: User;
  reporter?: User;
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
  metadata?: string;
  codeLanguage?: string;
  codeFilename?: string;
  taskData?: Task;
  bugData?: Bug;
  attachmentData?: Attachment;
  attachments?: Attachment[];
  reactions?: MessageReaction[];
  replyToMessageId?: string;
  replyToMessage?: {
    id: string;
    senderName: string;
    content: string;
  };
  isPinned?: boolean;
  isEdited?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'error';
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ActionType =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'BUG_REPORTED'
  | 'BUG_STATUS_CHANGED'
  | 'FILE_UPLOADED'
  | 'MEMBER_JOINED'
  | 'MESSAGE_CONVERTED'
  | 'CODE_SHARED'
  | string;

export interface ActivityLog {
  id: string;
  projectId: string;
  userId?: string;
  actionType?: ActionType;
  entityId?: string;
  entityType?: 'TASK' | 'BUG' | 'FILE' | 'MESSAGE' | string;
  metadata?: string;
  createdAt?: string;
  // UI & relational display helpers
  user?: User;
  userName?: string;
  userAvatar?: string;
  title?: string;
  details?: string;
  refName?: string;
  timestamp?: string;
  eventType?: string; // backwards compatibility alias for actionType
}

export interface ConvertMessageRequest {
  type: 'TASK' | 'BUG';
  title?: string;
  description?: string;
  priority?: PriorityLevel;
  status?: TaskStatus | BugStatus;
  assignedTo?: string;
  dueDate?: string;
  endpoint?: string;
}

export interface SecretDetectionResult {
  hasSecret: boolean;
  secretType?: string;
  matchedText?: string;
  hint?: string;
}

// ─── Phase 6: Notifications ───────────────────────────────────────────────────

export type NotificationType =
  | 'MENTION'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'BUG_ASSIGNED'
  | 'BUG_RESOLVED'
  | 'DIRECT_MESSAGE'
  | 'REPLY';

export type NotificationPriority = 'HIGH' | 'NORMAL' | 'LOW';

export interface AppNotification {
  id: string;
  recipientId?: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  entityId?: string;
  entityType?: 'TASK' | 'BUG' | 'MESSAGE';
  senderId?: string;
  sender?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  projectId?: string;
  project?: Pick<Project, 'id' | 'name'>;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  emailOnTaskAssigned: boolean;
  emailOnTaskCompleted: boolean;
  emailOnBugAssigned: boolean;
  emailOnMention: boolean;
  inAppAll: boolean;
}

