'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { io, Socket } from 'socket.io-client';
import { callAudio } from './callAudio';
import {
  User,
  Project,
  ProjectMember,
  ProjectRole,
  Message,
  Task,
  Bug,
  Attachment,
  ActivityLog,
  DirectConversation,
  MessageType,
  TaskStatus,
  BugStatus,
  PriorityLevel,
  ConvertMessageRequest,
  AppNotification,
  NotificationPreferences,
} from './types';
import { extractParticipantIds, normalizeConversationId } from './conversation';

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'DIRECT_MESSAGE' | 'GROUP_MESSAGE' | 'MENTION' | 'SYSTEM';
  sender?: {
    id?: string;
    name: string;
    avatarUrl?: string;
  };
  projectId?: string;
  channel?: string;
  conversationId?: string;
  conversation?: DirectConversation;
  createdAt: string;
}

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  users: User[];
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  activeChannel: string;
  activeConversation: DirectConversation | null;
  conversations: DirectConversation[];
  messages: Message[];
  tasks: Task[];
  bugs: Bug[];
  attachments: Attachment[];
  activity: ActivityLog[];
  members: ProjectMember[];
  typingUsers: string[];
  triggerTyping: (userName: string, isTyping: boolean) => void;
  isSocketConnected: boolean;

  // Navigation & selection
  selectProject: (id: string) => void;
  deleteProject: (projectId: string) => Promise<boolean>;
  selectChannel: (ch: string) => void;
  selectConversation: (conv: DirectConversation) => void;

  // Actions
  sendMessage: (payload: {
    content: string;
    messageType?: MessageType;
    metadata?: string;
    codeLanguage?: string;
    codeFilename?: string;
    bugData?: Partial<Bug>;
    taskData?: Partial<Task>;
    attachmentData?: Partial<Attachment>;
    replyToMessageId?: string;
    replyToMessage?: { id: string; senderName: string; content: string };
  }) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;

  // Tasks & Bugs
  createTask: (data: Partial<Task>) => Promise<Task | null>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  createBug: (data: Partial<Bug>) => Promise<Bug | null>;
  updateBugStatus: (bugId: string, status: BugStatus) => Promise<void>;

  // Files
  uploadFile: (file: File) => Promise<void>;

  // AI Assistant
  aiMessages: { role: 'user' | 'assistant'; text: string; timestamp: string }[];
  isAiLoading: boolean;
  askAi: (prompt: string) => Promise<void>;

  // Modals & Panels
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  isCreateBugOpen: boolean;
  setIsCreateBugOpen: (open: boolean) => void;
  isCreateTaskOpen: boolean;
  setIsCreateTaskOpen: (open: boolean) => void;
  isProfileOpen: boolean;
  setIsProfileOpen: (open: boolean) => void;
  isCreateProjectOpen: boolean;
  setIsCreateProjectOpen: (open: boolean) => void;
  isDeleteProjectOpen: boolean;
  setIsDeleteProjectOpen: (open: boolean) => void;
  projectToDelete: Project | null;
  setProjectToDelete: (proj: Project | null) => void;
  isProjectMembersOpen: boolean;
  setIsProjectMembersOpen: (open: boolean) => void;
  userRole: ProjectRole | null;
  isStatusOpen: boolean;
  setIsStatusOpen: (open: boolean) => void;
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (open: boolean) => void;
  activeRightTab: 'info' | 'bugs' | 'tasks' | 'files' | 'activity' | 'ai';
  setActiveRightTab: (tab: 'info' | 'bugs' | 'tasks' | 'files' | 'activity' | 'ai') => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  logout: () => Promise<void>;

  // Pre-fill converters
  convertMessageToBug: (msg: Message) => void;
  convertMessageToTask: (msg: Message) => void;
  prefillBug: Partial<Bug> | null;
  prefillTask: Partial<Task> | null;
  isConvertModalOpen: boolean;
  setIsConvertModalOpen: (open: boolean) => void;
  convertingMessage: Message | null;
  setConvertingMessage: (msg: Message | null) => void;
  convertMessage: (messageId: string, payload: ConvertMessageRequest) => Promise<void>;
  openConvertModal: (msg: Message, defaultType?: 'TASK' | 'BUG') => void;

  refreshData: (isBackground?: boolean) => Promise<void>;
  isAutoSyncActive: boolean;
  lastSyncedAt: Date | null;

  // Phase 6 – Notifications
  notifications: AppNotification[];
  unreadCount: number;
  isNotifOpen: boolean;
  setIsNotifOpen: (open: boolean) => void;
  notifPreferences: NotificationPreferences | null;
  fetchNotifications: () => Promise<void>;
  markNotifRead: (id: string) => Promise<void>;
  markAllNotifsRead: () => Promise<void>;
  fetchNotifPreferences: () => Promise<void>;
  saveNotifPreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  isNotifSettingsOpen: boolean;
  setIsNotifSettingsOpen: (open: boolean) => void;
  // Realtime Notification Toasts
  toasts: ToastNotification[];
  dismissToast: (id: string) => void;
  triggerToast: (toast: Omit<ToastNotification, 'id' | 'createdAt'>) => void;
}

const AppContext = createContext<AppContextType | null>(null);

// LocalStorage caching & view persistence helpers
const getStorageItem = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setStorageItem = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {}
};

const getCachedMessages = (viewKey: string): Message[] | null => {
  const raw = getStorageItem(`devconnect_msgs_${viewKey}`);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return null;
};

const setCachedMessages = (viewKey: string, msgs: Message[]) => {
  try {
    setStorageItem(`devconnect_msgs_${viewKey}`, JSON.stringify(msgs.slice(-100)));
  } catch {}
};

export const doesMessageMatchView = (
  msg: Message,
  currentConv: DirectConversation | null,
  currentProjId: string | null,
  currentChannel: string
): boolean => {
  // 1. Direct Conversation View: ONLY match messages for THIS direct conversation
  if (currentConv) {
    if (!msg.conversationId) return false;
    if (msg.conversationId === currentConv.id) return true;
    const targetNorm = normalizeConversationId(currentConv.id);
    const msgNorm = normalizeConversationId(msg.conversationId);
    if (targetNorm && msgNorm && targetNorm === msgNorm) return true;
    if (currentConv.participantIds && currentConv.participantIds.length === 2) {
      const [p1, p2] = currentConv.participantIds;
      if (
        (msg.senderId === p1 || msg.senderId === p2) &&
        (msg.recipientId === p1 || msg.recipientId === p2)
      ) {
        return true;
      }
    }
    return false;
  }

  // 2. Project Channel View: direct messages MUST NOT appear in project channels!
  if (msg.conversationId) {
    return false;
  }

  // Ensure message belongs to the current active project
  if (currentProjId && msg.projectId && msg.projectId !== currentProjId) {
    return false;
  }

  if (msg.channel === currentChannel) return true;
  if (currentChannel === 'tasks' && (msg.messageType === 'TASK' || msg.taskData)) return true;
  if (currentChannel === 'bugs' && (msg.messageType === 'BUG' || msg.bugData)) return true;
  return false;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('devconnect_active_conv_id')) {
        return null;
      }
      return localStorage.getItem('devconnect_active_project') || null;
    }
    return null;
  });
  const [activeChannel, setActiveChannel] = useState<string>('general');
  const [activeConversation, setActiveConversation] = useState<DirectConversation | null>(null);
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  const activeProjectIdRef = useRef(activeProjectId);
  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  const activeConversationRef = useRef(activeConversation);
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const activeChannelRef = useRef(activeChannel);
  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const activeViewSeqRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const triggerToast = useCallback(
    (toastData: Omit<ToastNotification, 'id' | 'createdAt'>) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newToast: ToastNotification = {
        ...toastData,
        id,
        createdAt: new Date().toISOString(),
      };
      setToasts((prev) => [newToast, ...prev.slice(0, 4)]);
      callAudio.playNotificationChime();

      setTimeout(() => {
        dismissToast(id);
      }, 6000);
    },
    [dismissToast]
  );

  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreateBugOpen, setIsCreateBugOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isProjectMembersOpen, setIsProjectMembersOpen] = useState(false);
  const [userRole, setUserRole] = useState<ProjectRole | null>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<'info' | 'bugs' | 'tasks' | 'files' | 'activity' | 'ai'>('info');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertingMessage, setConvertingMessage] = useState<Message | null>(null);

  // Phase 6 – Notification state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isNotifSettingsOpen, setIsNotifSettingsOpen] = useState(false);
  const [notifPreferences, setNotifPreferences] = useState<NotificationPreferences | null>(null);

  // Conversion pre-fills
  const [prefillBug, setPrefillBug] = useState<Partial<Bug> | null>(null);
  const [prefillTask, setPrefillTask] = useState<Partial<Task> | null>(null);

  // AI Assistant State
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'assistant'; text: string; timestamp: string }[]>([
    {
      role: 'assistant',
      text: 'Hello Samir! I am your project-aware AI assistant. I can summarize team progress, inspect recent Git commits, track bug statuses, or answer technical questions about your project.',
      timestamp: 'Today',
    },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Live Auto-Sync State
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const isFetchingDetailsRef = useRef(false);
  const isRefreshingBaseRef = useRef(false);

  // Fetch base data (projects, users, conversations, user profile)
  const refreshData = useCallback(async (isBackground = false) => {
    try {
      // 1. Current user
      let loggedInUser: User | null = null;
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const uData = await userRes.json();
        loggedInUser = uData.user || null;
        setCurrentUser((prev) => {
          if (
            prev?.id === loggedInUser?.id &&
            prev?.name === loggedInUser?.name &&
            prev?.status === loggedInUser?.status
          ) {
            return prev;
          }
          return loggedInUser;
        });
      }

      if (!loggedInUser && !isBackground) {
        setIsAuthModalOpen(true);
      }

      // 2. Projects
      let newProjects: Project[] = [];
      const projRes = await fetch('/api/projects');
      if (projRes.ok) {
        const pData = await projRes.json();
        newProjects = pData.projects || [];
        setProjects((prev) => {
          if (prev.length === newProjects.length) {
            let same = true;
            for (let i = 0; i < prev.length; i++) {
              if (
                prev[i].id !== newProjects[i].id ||
                prev[i].name !== newProjects[i].name ||
                prev[i].status !== newProjects[i].status ||
                prev[i].maxMembers !== newProjects[i].maxMembers
              ) {
                same = false;
                break;
              }
            }
            if (same) return prev;
          }
          return newProjects;
        });

        // Tell socket to join all project rooms for this user
        if (socketRef.current && socketRef.current.connected && newProjects.length > 0) {
          socketRef.current.emit('join_projects', { projectIds: newProjects.map((p) => p.id) });
        }

        // If user currently has activeProjectId but is not part of that project, reset it
        if (activeProjectIdRef.current && !newProjects.some((p) => p.id === activeProjectIdRef.current)) {
          setActiveProjectId(newProjects.length > 0 ? newProjects[0].id : null);
        }
      }

      // 3. Registered users for team selection and DMs
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const newUsers: User[] = usersData.users || [];
        setUsers((prev) => {
          if (prev.length === newUsers.length) {
            let same = true;
            for (let i = 0; i < prev.length; i++) {
              if (
                prev[i].id !== newUsers[i].id ||
                prev[i].name !== newUsers[i].name ||
                prev[i].status !== newUsers[i].status
              ) {
                same = false;
                break;
              }
            }
            if (same) return prev;
          }
          return newUsers;
        });
      }

      // 4. Conversations
      const effectiveUserId = loggedInUser?.id || currentUser?.id;
      if (effectiveUserId) {
        const convRes = await fetch(`/api/conversations?userId=${effectiveUserId}`);
        if (convRes.ok) {
          const cData = await convRes.json();
          const convList: DirectConversation[] = (cData.conversations || []).filter((c: DirectConversation) => {
            const email = (c.otherUser?.email || '').toLowerCase();
            return !email.endsWith('@test.dev') && !email.endsWith('@example.com') && !email.includes('test_');
          });
          setConversations((prev) => {
            // Merge convList with prev to preserve client-side unread counts and any newer client-side activity
            const merged = convList.map((c) => {
              const existing = prev.find((p) => p.id === c.id);
              if (existing) {
                const existingTime = existing.lastActivity && existing.lastActivity !== 'Recently' ? new Date(existing.lastActivity).getTime() : 0;
                const serverTime = c.lastActivity && c.lastActivity !== 'Recently' ? new Date(c.lastActivity).getTime() : 0;
                if (existingTime > serverTime) {
                  return {
                    ...c,
                    lastMessage: existing.lastMessage,
                    lastActivity: existing.lastActivity,
                    unreadCount: existing.unreadCount !== undefined ? existing.unreadCount : c.unreadCount || 0,
                  };
                }
                return {
                  ...c,
                  unreadCount: existing.unreadCount !== undefined ? existing.unreadCount : c.unreadCount,
                };
              }
              return c;
            });

            // Re-sort merged so newest activity is always on top
            merged.sort((a, b) => {
              const timeA = a.lastActivity && a.lastActivity !== 'Recently' ? new Date(a.lastActivity).getTime() : 0;
              const timeB = b.lastActivity && b.lastActivity !== 'Recently' ? new Date(b.lastActivity).getTime() : 0;
              if (timeA > 0 && timeB > 0) return timeB - timeA;
              if (timeA > 0) return -1;
              if (timeB > 0) return 1;
              return (a.otherUser?.name || '').localeCompare(b.otherUser?.name || '');
            });

            return merged;
          });

          // Auto-restore active conversation or default to first peer if 0 projects assigned
          if (!isBackground) {
            const savedConvId = getStorageItem('devconnect_active_conv_id');
            if (savedConvId) {
              const match = convList.find((c: DirectConversation) => c.id === savedConvId);
              if (match) {
                setActiveConversation(match);
              }
            } else if (newProjects.length === 0 && convList.length > 0 && !activeProjectIdRef.current) {
              setActiveConversation(convList[0]);
            }
          }
        }
      } else {
        setConversations([]);
      }
    } catch (err) {
      if (!isBackground) {
        console.error('Error fetching base data:', err);
      }
    }
  }, [currentUser?.id]);

  // Notifications fetcher
  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/notifications?limit=30');
      if (res.ok) {
        const data = await res.json();
        const newNotifs: AppNotification[] = data.notifications || [];
        setNotifications((prev) => {
          if (prev.length === newNotifs.length) {
            let same = true;
            for (let i = 0; i < prev.length; i++) {
              if (prev[i].id !== newNotifs[i].id || prev[i].read !== newNotifs[i].read) {
                same = false;
                break;
              }
            }
            if (same) return prev;
          }
          return newNotifs;
        });
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silent in background
    }
  }, [currentUser?.id]);

  // Fetch project details when activeProjectId or activeChannel or activeConversation changes
  const fetchActiveDetails = useCallback(async (isBackground = false) => {
    const currentSeq = ++activeViewSeqRef.current;
    const viewKey = activeConversation
      ? `conv_${activeConversation.id}`
      : `proj_${activeProjectId}_chan_${activeChannel}`;

    // Instant optimistic render from cache on room change
    if (!isBackground) {
      const cached = getCachedMessages(viewKey);
      if (cached && cached.length > 0) {
        setMessages(cached);
      }
    }

    try {
      if (activeConversation) {
        // Fetch 1-to-1 messages
        const res = await fetch(`/api/messages?conversationId=${encodeURIComponent(activeConversation.id)}`);
        if (currentSeq !== activeViewSeqRef.current) return; // Stale! View switched while fetch was running

        if (res.ok) {
          const mData = await res.json();
          if (currentSeq !== activeViewSeqRef.current) return;
          const fetchedMsgs: Message[] = (mData.messages || []).map((m: Message) => ({
            ...m,
            status: (m.status || 'delivered') as 'sending' | 'sent' | 'delivered' | 'error',
          }));

          setMessages((prev) => {
            // Retain any pending optimistic messages that are currently in-flight
            const pendingOptimistic = prev.filter(
              (m) =>
                (m.status === 'sending' || m.id.startsWith('temp_')) &&
                !fetchedMsgs.some(
                  (f) =>
                    f.id === m.id ||
                    (f.senderId === m.senderId && f.content === m.content)
                )
            );

            const combined = [...fetchedMsgs, ...pendingOptimistic];
            setCachedMessages(viewKey, combined);
            return combined;
          });
        }
      } else if (activeProjectId) {
        // Fetch project info & channel messages
        const [projRes, msgRes] = await Promise.all([
          fetch(`/api/projects/${activeProjectId}`),
          fetch(`/api/messages?projectId=${activeProjectId}&channel=${activeChannel}`),
        ]);

        if (currentSeq !== activeViewSeqRef.current) return; // Stale! View switched while fetch was running

        if (projRes.ok) {
          const pData = await projRes.json();
          if (currentSeq !== activeViewSeqRef.current) return;

          if (pData.members) {
            setMembers((prev) => {
              if (prev.length === pData.members.length) {
                let same = true;
                for (let i = 0; i < prev.length; i++) {
                  if (
                    prev[i].id !== pData.members[i].id ||
                    prev[i].role !== pData.members[i].role ||
                    prev[i].user?.status !== pData.members[i].user?.status
                  ) {
                    same = false;
                    break;
                  }
                }
                if (same) return prev;
              }
              return pData.members;
            });
          }
          setUserRole(pData.userRole || null);
          if (pData.tasks) {
            const mappedTasks: Task[] = pData.tasks.map((t: Task) => {
              const assignedUser =
                (t.assignedTo && t.assigneeUser?.id === t.assignedTo ? t.assigneeUser : null) ||
                (t.assignedTo && t.assignee?.id === t.assignedTo ? t.assignee : null) ||
                usersRef.current.find((u) => u.id === t.assignedTo) ||
                (pData.members || []).find((m: any) => m.userId === t.assignedTo)?.user ||
                t.assigneeUser ||
                t.assignee;
              return {
                ...t,
                assigneeUser: assignedUser || t.assigneeUser,
              };
            });

            setTasks((prev) => {
              if (prev.length === mappedTasks.length) {
                let same = true;
                for (let i = 0; i < prev.length; i++) {
                  if (
                    prev[i].id !== mappedTasks[i].id ||
                    prev[i].status !== mappedTasks[i].status ||
                    prev[i].title !== mappedTasks[i].title ||
                    prev[i].priority !== mappedTasks[i].priority ||
                    prev[i].assignedTo !== mappedTasks[i].assignedTo ||
                    prev[i].assigneeUser?.id !== mappedTasks[i].assigneeUser?.id ||
                    prev[i].assigneeUser?.name !== mappedTasks[i].assigneeUser?.name
                  ) {
                    same = false;
                    break;
                  }
                }
                if (same) return prev;
              }
              return mappedTasks;
            });
          }
          if (pData.bugs) {
            const mappedBugs: Bug[] = pData.bugs.map((b: Bug) => {
              const assignedUser =
                (b.assignedTo && b.assigneeUser?.id === b.assignedTo ? b.assigneeUser : null) ||
                (b.assignedTo && b.assignee?.id === b.assignedTo ? b.assignee : null) ||
                usersRef.current.find((u) => u.id === b.assignedTo) ||
                (pData.members || []).find((m: any) => m.userId === b.assignedTo)?.user ||
                b.assigneeUser ||
                b.assignee;
              return {
                ...b,
                assigneeUser: assignedUser || b.assigneeUser,
              };
            });

            setBugs((prev) => {
              if (prev.length === mappedBugs.length) {
                let same = true;
                for (let i = 0; i < prev.length; i++) {
                  if (
                    prev[i].id !== mappedBugs[i].id ||
                    prev[i].status !== mappedBugs[i].status ||
                    prev[i].title !== mappedBugs[i].title ||
                    prev[i].priority !== mappedBugs[i].priority ||
                    prev[i].assignedTo !== mappedBugs[i].assignedTo ||
                    prev[i].assigneeUser?.id !== mappedBugs[i].assigneeUser?.id ||
                    prev[i].assigneeUser?.name !== mappedBugs[i].assigneeUser?.name
                  ) {
                    same = false;
                    break;
                  }
                }
                if (same) return prev;
              }
              return mappedBugs;
            });
          }
          if (pData.attachments) {
            setAttachments((prev) => {
              if (prev.length === pData.attachments.length) {
                let same = true;
                for (let i = 0; i < prev.length; i++) {
                  if (
                    prev[i].id !== pData.attachments[i].id ||
                    prev[i].fileName !== pData.attachments[i].fileName
                  ) {
                    same = false;
                    break;
                  }
                }
                if (same) return prev;
              }
              return pData.attachments;
            });
          }
          if (pData.activity) {
            setActivity((prev) => {
              if (prev.length === pData.activity.length) {
                let same = true;
                for (let i = 0; i < prev.length; i++) {
                  if (
                    prev[i].id !== pData.activity[i].id ||
                    prev[i].title !== pData.activity[i].title
                  ) {
                    same = false;
                    break;
                  }
                }
                if (same) return prev;
              }
              return pData.activity;
            });
          }
        }

        if (msgRes.ok) {
          const mData = await msgRes.json();
          if (currentSeq !== activeViewSeqRef.current) return;
          const fetchedMsgs: Message[] = (mData.messages || []).map((m: Message) => ({
            ...m,
            status: (m.status || 'delivered') as 'sending' | 'sent' | 'delivered' | 'error',
          }));

          setMessages((prev) => {
            // Retain any pending optimistic messages that are currently in-flight
            const pendingOptimistic = prev.filter(
              (m) =>
                (m.status === 'sending' || m.id.startsWith('temp_')) &&
                !fetchedMsgs.some(
                  (f) =>
                    f.id === m.id ||
                    (f.senderId === m.senderId && f.content === m.content)
                )
            );

            const combined = [...fetchedMsgs, ...pendingOptimistic];
            setCachedMessages(viewKey, combined);
            return combined;
          });
        }
      }
    } catch (err) {
      if (!isBackground) {
        console.error('Error fetching active view details:', err);
      }
    }
  }, [activeProjectId, activeChannel, activeConversation]);

  // Safely restore persisted view & cached messages from localStorage on client mount (prevents SSR hydration mismatch)
  useEffect(() => {
    const savedConvId = getStorageItem('devconnect_active_conv_id');
    const savedProj = getStorageItem('devconnect_active_project');
    const savedChan = getStorageItem('devconnect_active_channel');

    if (savedConvId) {
      setActiveProjectId(null);
      const viewKey = `conv_${savedConvId}`;
      const cached = getCachedMessages(viewKey);
      if (cached && cached.length > 0) {
        setMessages(cached);
      }
    } else {
      if (savedProj) setActiveProjectId(savedProj);
      if (savedChan) setActiveChannel(savedChan);
      const viewKey = `proj_${savedProj || 'proj_ai_employee'}_chan_${savedChan || 'general'}`;
      const cached = getCachedMessages(viewKey);
      if (cached && cached.length > 0) {
        setMessages(cached);
      }
    }
  }, []);

  // Event-Driven & Trigger-Based Workspace Synchronization
  // Eliminates continuous 3-second polling load on server.
  // Instant refreshes are handled by Realtime Socket triggers (new text, member add/remove, group add/remove).
  useEffect(() => {
    // Initial fetch on mount
    refreshData(false);
    fetchActiveDetails(false);
    fetchNotifications();
    setLastSyncedAt(new Date());

    // Immediate sync on tab focus or visibility change
    const onTabVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchActiveDetails(true);
        refreshData(true);
        fetchNotifications();
        setLastSyncedAt(new Date());
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onTabVisible);
      window.addEventListener('focus', onTabVisible);
    }

    // Relaxed low-frequency fallback ONLY when socket is disconnected (e.g. offline or socket error)
    // Runs at 60 seconds (instead of 3 seconds) to ensure zero excessive server load
    const fallbackTimer = setInterval(() => {
      if (!isSocketConnected && typeof document !== 'undefined' && !document.hidden) {
        fetchActiveDetails(true);
        refreshData(true);
        setLastSyncedAt(new Date());
      }
    }, 60000);

    return () => {
      clearInterval(fallbackTimer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onTabVisible);
        window.removeEventListener('focus', onTabVisible);
      }
    };
  }, [fetchActiveDetails, refreshData, fetchNotifications, isSocketConnected]);

  // Connect to Realtime Socket.IO Server
  useEffect(() => {
    if (!currentUser?.id) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')
        ? 'https://devconnect-a2wa.onrender.com'
        : 'http://localhost:3001');

    const socket = io(socketUrl, {
      query: { userId: currentUser.id },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsSocketConnected(true);
      // Join active room if already selected
      const roomPayload = activeConversation
        ? { conversationId: activeConversation.id }
        : activeProjectId
        ? { projectId: activeProjectId, channel: activeChannel || 'general' }
        : null;
      if (roomPayload) {
        socket.emit('join_conversation', roomPayload);
      }
      if (projectsRef.current && projectsRef.current.length > 0) {
        socket.emit('join_projects', { projectIds: projectsRef.current.map((p) => p.id) });
      }
    });

    socket.on('disconnect', () => {
      setIsSocketConnected(false);
    });

    // 1. Realtime New Message received from another tab or user
    socket.on('new_message', (newMsg: Message) => {
      const isFromOther = newMsg.senderId !== currentUserRef.current?.id;
      const isCurrentlyLooking = doesMessageMatchView(
        newMsg,
        activeConversationRef.current,
        activeProjectIdRef.current,
        activeChannelRef.current
      );

      // If direct conversation message, reorder conversations to the top & create notification
      if (newMsg.conversationId) {
        let updatedConv: DirectConversation | undefined;

        setConversations((prev) => {
          const normTarget = normalizeConversationId(newMsg.conversationId);
          const matchIndex = prev.findIndex(
            (c) =>
              c.id === newMsg.conversationId ||
              normalizeConversationId(c.id) === normTarget
          );

          if (matchIndex >= 0) {
            const matched = prev[matchIndex];
            const isCurrentActive =
              activeConversationRef.current?.id === matched.id ||
              normalizeConversationId(activeConversationRef.current?.id) === normTarget;

            const updated: DirectConversation = {
              ...matched,
              lastMessage: newMsg.content || 'Sent an attachment',
              lastActivity: newMsg.createdAt || new Date().toISOString(),
              unreadCount: isCurrentActive ? 0 : (matched.unreadCount || 0) + 1,
            };
            updatedConv = updated;
            const remaining = prev.filter((_, idx) => idx !== matchIndex);
            return [updated, ...remaining];
          } else {
            // New conversation appeared: add directly without roundtrip refresh
            const otherUser =
              newMsg.sender && newMsg.sender.id !== currentUserRef.current?.id
                ? newMsg.sender
                : usersRef.current.find((u) => u.id === newMsg.senderId);

            if (otherUser) {
              const myId = currentUserRef.current?.id || '';
              const updated: DirectConversation = {
                id: newMsg.conversationId || [myId, otherUser.id].sort().join('_'),
                participantIds: [myId, otherUser.id],
                otherUser,
                lastMessage: newMsg.content || 'Sent an attachment',
                lastActivity: newMsg.createdAt || new Date().toISOString(),
                unreadCount: 1,
              };
              updatedConv = updated;
              return [updated, ...prev];
            }
            return prev;
          }
        });

        // If message is from someone else and user is not looking at this conversation, show notification & toast
        if (isFromOther && !isCurrentlyLooking) {
          const senderUser = newMsg.sender || usersRef.current.find((u) => u.id === newMsg.senderId);
          const newNotif: AppNotification = {
            id: `notif_${Date.now()}_${newMsg.id}`,
            recipientId: currentUserRef.current?.id || '',
            senderId: newMsg.senderId,
            type: 'DIRECT_MESSAGE',
            priority: 'NORMAL',
            title: `New message from ${newMsg.sender?.name || senderUser?.name || 'Developer'}`,
            message: (newMsg.content || 'Sent an attachment').slice(0, 120),
            read: false,
            createdAt: new Date().toISOString(),
            entityId: newMsg.id,
            entityType: 'MESSAGE',
          };
          setNotifications((prev) => [newNotif, ...prev]);
          setUnreadCount((prev) => prev + 1);

          triggerToast({
            title: `New message from ${newMsg.sender?.name || senderUser?.name || 'Developer'}`,
            message: (newMsg.content || 'Sent an attachment').slice(0, 120),
            type: 'DIRECT_MESSAGE',
            sender: senderUser,
            conversationId: newMsg.conversationId,
            conversation: updatedConv,
          });
        }
      } else if (newMsg.projectId) {
        // Group / Channel message: if from someone else and user is not in this channel, show notification & toast
        if (isFromOther && !isCurrentlyLooking) {
          const senderUser = newMsg.sender || usersRef.current.find((u) => u.id === newMsg.senderId);
          const channelName = newMsg.channel || 'general';

          const newNotif: AppNotification = {
            id: `notif_${Date.now()}_${newMsg.id}`,
            recipientId: currentUserRef.current?.id || '',
            senderId: newMsg.senderId,
            projectId: newMsg.projectId,
            type: 'REPLY',
            priority: 'NORMAL',
            title: `#${channelName} • ${senderUser?.name || 'Developer'}`,
            message: (newMsg.content || 'Sent an attachment').slice(0, 120),
            read: false,
            createdAt: new Date().toISOString(),
            entityId: newMsg.id,
            entityType: 'MESSAGE',
          };
          setNotifications((prev) => [newNotif, ...prev]);
          setUnreadCount((prev) => prev + 1);

          triggerToast({
            title: `#${channelName} • ${senderUser?.name || 'Developer'}`,
            message: (newMsg.content || 'Sent an attachment').slice(0, 120),
            type: 'GROUP_MESSAGE',
            sender: senderUser,
            projectId: newMsg.projectId,
            channel: channelName,
          });
        }
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;

        // Check if there is an optimistic temporary message from this user that matches
        const tempMatchIndex = prev.findIndex(
          (m) =>
            m.status === 'sending' &&
            m.senderId === newMsg.senderId &&
            m.content === newMsg.content
        );

        let updated: Message[];
        if (tempMatchIndex >= 0) {
          const oldTemp = prev[tempMatchIndex];
          updated = prev.map((m, idx) =>
            idx === tempMatchIndex
              ? {
                  ...oldTemp,
                  ...newMsg,
                  metadata: newMsg.metadata || oldTemp.metadata,
                  taskData: newMsg.taskData || oldTemp.taskData,
                  bugData: newMsg.bugData || oldTemp.bugData,
                  attachmentData: newMsg.attachmentData || oldTemp.attachmentData,
                  sender: newMsg.sender || oldTemp.sender,
                  status: 'delivered' as const,
                }
              : m
          );
        } else if (
          doesMessageMatchView(
            newMsg,
            activeConversationRef.current,
            activeProjectIdRef.current,
            activeChannelRef.current
          )
        ) {
          updated = [...prev, { ...newMsg, status: 'delivered' as const }];
        } else {
          return prev;
        }

        const viewKey = activeConversationRef.current
          ? `conv_${activeConversationRef.current.id}`
          : `proj_${activeProjectIdRef.current}_chan_${activeChannelRef.current}`;
        setCachedMessages(viewKey, updated);
        return updated;
      });

      // If message involves a task, bug, or file, trigger active view refresh
      if (
        newMsg.messageType === 'TASK' ||
        newMsg.messageType === 'BUG' ||
        newMsg.messageType === 'FILE' ||
        newMsg.taskData ||
        newMsg.bugData ||
        newMsg.attachmentData
      ) {
        fetchActiveDetails(true);
      }
      setLastSyncedAt(new Date());
    });

    // 2. Realtime Message Edit
    socket.on('message_edited', (data: { messageId: string; content: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, content: data.content, isEdited: true } : m
        )
      );
    });

    // 3. Realtime Message Delete
    socket.on('message_deleted', (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    });

    // 4. Realtime Reaction Update
    socket.on('reaction_updated', (data: { messageId: string; emoji: string; userId: string; action: 'ADDED' | 'REMOVED' }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== data.messageId) return m;
          const currentReactions = m.reactions || [];
          const existing = currentReactions.find((r) => r.emoji === data.emoji);

          let newReactions;
          if (data.action === 'ADDED') {
            if (existing) {
              newReactions = currentReactions.map((r) =>
                r.emoji === data.emoji
                  ? {
                      ...r,
                      count: r.userIds.includes(data.userId) ? r.count : r.count + 1,
                      userIds: r.userIds.includes(data.userId) ? r.userIds : [...r.userIds, data.userId],
                    }
                  : r
              );
            } else {
              newReactions = [...currentReactions, { emoji: data.emoji, count: 1, userIds: [data.userId] }];
            }
          } else {
            newReactions = currentReactions
              .map((r) =>
                r.emoji === data.emoji
                  ? {
                      ...r,
                      count: Math.max(0, r.count - 1),
                      userIds: r.userIds.filter((id) => id !== data.userId),
                    }
                  : r
              )
              .filter((r) => r.count > 0);
          }

          return { ...m, reactions: newReactions };
        })
      );
    });

    // 5. Realtime Typing Indicators
    socket.on('user_typing_start', (data: { userName: string; fromSocketId?: string }) => {
      // Exclude self if from same socket
      if (data.fromSocketId && data.fromSocketId === socket.id) return;
      const name = data.userName || 'Someone';
      setTypingUsers((prev) => {
        if (!prev.includes(name)) return [...prev, name];
        return prev;
      });
    });

    socket.on('user_typing_stop', (data: { userName: string; fromSocketId?: string }) => {
      if (data.fromSocketId && data.fromSocketId === socket.id) return;
      setTypingUsers((prev) => prev.filter((u) => u !== data.userName));
    });

    // 6. Realtime File Upload Notification
    socket.on('file_uploaded', (data: { attachment?: Attachment; projectId?: string; messageId?: string }) => {
      if (data.attachment) {
        const att = data.attachment;
        setAttachments((prev) => [att, ...prev.filter((a) => a.id !== att.id)]);
        if (data.messageId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.messageId
                ? {
                    ...m,
                    attachmentData: m.attachmentData || att,
                    attachments: [...(m.attachments || []).filter((a: Attachment) => a.id !== att.id), att],
                  }
                : m
            )
          );
        }
      }
    });

    // 7. Realtime Developer Activity & Workflow Events
    socket.on('activity_logged', (data: { activity?: ActivityLog; projectId?: string }) => {
      if (data.activity) {
        setActivity((prev) => [data.activity!, ...prev.filter((a) => a.id !== data.activity!.id)]);
      }
    });

    socket.on('task_updated', (data: { task?: Task; projectId?: string; action?: string }) => {
      if (data.task) {
        const task = data.task;
        setTasks((prev) => [task, ...prev.filter((t) => t.id !== task.id)]);
        setMessages((prev) =>
          prev.map((m) =>
            m.taskData?.id === task.id || m.id === task.messageId
              ? { ...m, messageType: 'TASK', taskData: task }
              : m
          )
        );
      }
    });

    socket.on('bug_updated', (data: { bug?: Bug; projectId?: string; action?: string }) => {
      if (data.bug) {
        const bug = data.bug;
        setBugs((prev) => [bug, ...prev.filter((b) => b.id !== bug.id)]);
        setMessages((prev) =>
          prev.map((m) =>
            m.bugData?.id === bug.id || m.id === bug.messageId
              ? { ...m, messageType: 'BUG', bugData: bug }
              : m
          )
        );
      }
    });

    socket.on('message_converted', (data: { messageId: string; convertedType: 'TASK' | 'BUG'; task?: Task; bug?: Bug }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== data.messageId) return m;
          if (data.convertedType === 'TASK' && data.task) {
            return { ...m, messageType: 'TASK', taskData: data.task };
          }
          if (data.convertedType === 'BUG' && data.bug) {
            return { ...m, messageType: 'BUG', bugData: data.bug };
          }
          return m;
        })
      );
      if (data.task) {
        setTasks((prev) => [data.task!, ...prev.filter((t) => t.id !== data.task!.id)]);
      }
      if (data.bug) {
        setBugs((prev) => [data.bug!, ...prev.filter((b) => b.id !== data.bug!.id)]);
      }
    });

    // Phase 6 – Real-time notification push
    socket.on('new_notification', (notif: AppNotification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
      setUnreadCount((c) => c + 1);

      triggerToast({
        title: notif.title,
        message: notif.message,
        type: notif.type === 'DIRECT_MESSAGE' ? 'DIRECT_MESSAGE' : 'GROUP_MESSAGE',
        sender: notif.sender,
        projectId: notif.projectId,
      });
    });

    // 8. Realtime Project/Group Triggers (Group added or removed)
    socket.on('project_created', () => {
      refreshData(true);
      setLastSyncedAt(new Date());
    });

    socket.on('project_deleted', (payload: { projectId?: string }) => {
      refreshData(true);
      setLastSyncedAt(new Date());
      if (payload?.projectId) {
        setProjects((prev) => {
          const remaining = prev.filter((p) => p.id !== payload.projectId);
          if (activeProjectIdRef.current === payload.projectId) {
            if (remaining.length > 0) {
              selectProject(remaining[0].id);
            } else {
              setActiveProjectId(null);
            }
          }
          return remaining;
        });
      }
    });

    // 9. Realtime Project Member Triggers (Member added or removed)
    socket.on('member_added', (payload: { projectId?: string; userId?: string; member?: ProjectMember }) => {
      const isMe = payload?.userId === currentUserRef.current?.id;
      if (isMe && payload?.projectId) {
        // Current user was just added to a project by a peer!
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('join_conversation', { projectId: payload.projectId, channel: 'general' });
        }
        triggerToast({
          title: 'Added to Project Group! 🎉',
          message: 'A peer has added you to a project group. Your workspace has been updated in real time.',
          type: 'GROUP_MESSAGE',
          projectId: payload.projectId,
        });
        refreshData(true).then(() => {
          if (!activeProjectIdRef.current && !activeConversationRef.current) {
            selectProject(payload.projectId!);
          }
        });
      } else {
        if (!payload?.projectId || activeProjectIdRef.current === payload.projectId) {
          fetchActiveDetails(true);
        }
        refreshData(true);
      }
      setLastSyncedAt(new Date());
    });

    socket.on('member_removed', (payload: { projectId?: string; userId?: string }) => {
      if (!payload?.projectId || activeProjectIdRef.current === payload.projectId) {
        fetchActiveDetails(true);
      }
      refreshData(true);
      setLastSyncedAt(new Date());
    });

    // 10. Realtime User Registration / Presence Trigger
    socket.on('user_joined', (payload: { user?: User }) => {
      if (payload?.user && payload.user.id !== currentUserRef.current?.id) {
        const newUser = payload.user;
        setUsers((prev) => {
          if (prev.some((u) => u.id === newUser.id)) return prev;
          return [...prev, newUser];
        });
        setConversations((prev) => {
          if (prev.some((c) => c.otherUser?.id === newUser.id)) return prev;
          const myId = currentUserRef.current?.id || '';
          const newConv: DirectConversation = {
            id: [myId, newUser.id].sort().join('_'),
            participantIds: [myId, newUser.id],
            otherUser: newUser,
            lastMessage: `Direct conversation with ${newUser.name}`,
            lastActivity: 'Just now',
            unreadCount: 0,
          };
          return [...prev, newConv];
        });
        triggerToast({
          title: `${newUser.name} joined Devconnect`,
          message: 'Direct messaging is now available with this developer.',
          type: 'DIRECT_MESSAGE',
          sender: newUser,
        });
      }
    });

    socket.on('presence_updated', (payload: { userId: string; status: 'ONLINE' | 'AWAY' | 'OFFLINE' }) => {
      if (!payload?.userId) return;
      setUsers((prev) =>
        prev.map((u) => (u.id === payload.userId ? { ...u, status: payload.status } : u))
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.otherUser?.id === payload.userId
            ? { ...c, otherUser: { ...c.otherUser, status: payload.status } }
            : c
        )
      );
    });

    // 11. Realtime Global Workspace Sync Trigger
    socket.on('workspace_sync', () => {
      fetchActiveDetails(true);
      refreshData(true);
      setLastSyncedAt(new Date());
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUser?.id]);

  // Handle Room Switching (Direct or Project Channel)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const roomPayload = activeConversation
      ? { conversationId: activeConversation.id }
      : activeProjectId
      ? { projectId: activeProjectId, channel: activeChannel || 'general' }
      : null;

    if (roomPayload) {
      socket.emit('join_conversation', roomPayload);
      setTypingUsers([]);

      return () => {
        socket.emit('leave_conversation', roomPayload);
      };
    }
  }, [activeConversation, activeProjectId, activeChannel]);

  const selectProject = (id: string) => {
    setActiveProjectId(id);
    setActiveConversation(null);
    setIsMobileSidebarOpen(false);
    setStorageItem('devconnect_active_project', id);
    if (typeof window !== 'undefined') localStorage.removeItem('devconnect_active_conv_id');
    const ch = activeChannel || 'general';
    const key = `proj_${id}_chan_${ch}`;
    const cached = getCachedMessages(key);
    setMessages(cached || []);
  };

  const deleteProject = async (projectId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete group');
      }

      // Optimistically update projects list and re-route if needed
      setProjects((prev) => {
        const remaining = prev.filter((p) => p.id !== projectId);
        if (activeProjectId === projectId) {
          if (remaining.length > 0) {
            selectProject(remaining[0].id);
          } else {
            setActiveProjectId(null);
          }
        }
        return remaining;
      });

      // Broadcast realtime trigger event to other tabs/collaborators
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit('project_deleted', { projectId });
      }

      await refreshData(true);
      return true;
    } catch (err) {
      console.error('Failed to delete project:', err);
      throw err;
    }
  };

  const selectChannel = (ch: string) => {
    setActiveChannel(ch);
    setActiveConversation(null);
    setIsMobileSidebarOpen(false);
    setStorageItem('devconnect_active_channel', ch);
    if (typeof window !== 'undefined') localStorage.removeItem('devconnect_active_conv_id');
    const pId = activeProjectId || (projects.length > 0 ? projects[0].id : null);
    if (pId && !activeProjectId) setActiveProjectId(pId);
    if (pId) {
      const key = `proj_${pId}_chan_${ch}`;
      const cached = getCachedMessages(key);
      setMessages(cached || []);
    }
  };

  const selectConversation = (conv: DirectConversation) => {
    setActiveConversation(conv);
    setActiveProjectId(null);
    setIsMobileSidebarOpen(false);
    setStorageItem('devconnect_active_conv_id', conv.id);
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
    const key = `conv_${conv.id}`;
    const cached = getCachedMessages(key);
    setMessages(cached || []);
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const sendMessage = async (payload: {
    content: string;
    messageType?: MessageType;
    metadata?: string;
    codeLanguage?: string;
    codeFilename?: string;
    bugData?: Partial<Bug>;
    taskData?: Partial<Task>;
    attachmentData?: Partial<Attachment>;
    replyToMessageId?: string;
    replyToMessage?: { id: string; senderName: string; content: string };
  }) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    const socket = socketRef.current;
    const roomPayload = activeConversation
      ? { conversationId: activeConversation.id }
      : activeProjectId
      ? { projectId: activeProjectId, channel: activeChannel || 'general' }
      : {};

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const optimisticMsg: Message = {
      id: tempId,
      projectId: activeConversation ? undefined : (activeProjectId || undefined),
      conversationId: activeConversation ? activeConversation.id : undefined,
      channel: activeConversation ? undefined : (activeChannel || 'general'),
      senderId: currentUser.id,
      sender: currentUser,
      messageType: payload.messageType || 'TEXT',
      content: payload.content,
      metadata: payload.metadata,
      codeLanguage: payload.codeLanguage,
      codeFilename: payload.codeFilename,
      bugData: payload.bugData as Bug | undefined,
      taskData: payload.taskData as Task | undefined,
      attachmentData: payload.attachmentData as Attachment | undefined,
      replyToMessageId: payload.replyToMessageId,
      replyToMessage: payload.replyToMessage,
      status: 'sending',
      createdAt: nowIso,
    };

    // 1. Immediately place optimistic message into chat state & cache so it appears instantly
    setMessages((prev) => {
      const updated = [...prev, optimisticMsg];
      const viewKey = activeConversation
        ? `conv_${activeConversation.id}`
        : `proj_${activeProjectId}_chan_${activeChannel}`;
      setCachedMessages(viewKey, updated);
      return updated;
    });

    // 2. Reorder conversations immediately to bring active conversation to the top
    if (activeConversation) {
      setConversations((prev) => {
        const normTarget = normalizeConversationId(activeConversation.id);
        const matchIndex = prev.findIndex(
          (c) =>
            c.id === activeConversation.id ||
            normalizeConversationId(c.id) === normTarget
        );
        if (matchIndex >= 0) {
          const matched: DirectConversation = {
            ...prev[matchIndex],
            lastMessage: payload.content || 'Sent an attachment',
            lastActivity: nowIso,
            unreadCount: 0,
          };
          const remaining = prev.filter((_, idx) => idx !== matchIndex);
          return [matched, ...remaining];
        }
        return prev;
      });
    }

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          projectId: activeConversation ? undefined : activeProjectId,
          conversationId: activeConversation ? activeConversation.id : undefined,
          channel: activeConversation ? undefined : activeChannel,
          senderId: currentUser.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const createdMsg: Message = { ...data.message, status: 'delivered' };

        // Replace temporary optimistic message with confirmed delivered message
        setMessages((prev) => {
          const hasTemp = prev.some((m) => m.id === tempId);
          const hasReal = prev.some((m) => m.id === createdMsg.id);
          let updated: Message[];
          if (hasTemp) {
            updated = prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    ...createdMsg,
                    metadata: createdMsg.metadata || m.metadata,
                    taskData: createdMsg.taskData || m.taskData,
                    bugData: createdMsg.bugData || m.bugData,
                    attachmentData: createdMsg.attachmentData || m.attachmentData,
                    sender: createdMsg.sender || m.sender,
                    status: 'delivered' as const,
                  }
                : m
            );
          } else if (!hasReal) {
            updated = [...prev, createdMsg];
          } else {
            updated = prev;
          }
          const viewKey = activeConversation
            ? `conv_${activeConversation.id}`
            : `proj_${activeProjectId}_chan_${activeChannel}`;
          setCachedMessages(viewKey, updated);
          return updated;
        });

        // Broadcast to all other windows/tabs in the room via socket
        if (socket && socket.connected) {
          socket.emit('send_message', {
            ...createdMsg,
            ...roomPayload,
          });
        }

        if (payload.messageType === 'TASK' || payload.messageType === 'BUG' || payload.messageType === 'FILE') {
          fetchActiveDetails();
        }
      } else {
        // Mark optimistic message with error status
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'error' as const } : m))
        );
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Mark optimistic message with error status
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'error' as const } : m))
      );
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      const socket = socketRef.current;
      const roomPayload = activeConversation
        ? { conversationId: activeConversation.id }
        : activeProjectId
        ? { projectId: activeProjectId, channel: activeChannel || 'general' }
        : {};

      if (!currentUser) {
        setIsAuthModalOpen(true);
        return;
      }

      const res = await fetch(`/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, userId: currentUser.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          const updated = prev.map((m) => (m.id === messageId ? data.message : m));
          const viewKey = activeConversation
            ? `conv_${activeConversation.id}`
            : `proj_${activeProjectId}_chan_${activeChannel}`;
          setCachedMessages(viewKey, updated);
          return updated;
        });

        if (socket && socket.connected) {
          socket.emit('add_reaction', {
            messageId,
            emoji,
            userId: currentUser.id,
            ...roomPayload,
          });
        }
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  const editMessage = async (messageId: string, content: string) => {
    try {
      const socket = socketRef.current;
      const roomPayload = activeConversation
        ? { conversationId: activeConversation.id }
        : activeProjectId
        ? { projectId: activeProjectId, channel: activeChannel || 'general' }
        : {};

      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setMessages((prev) => {
          const updated = prev.map((m) => (m.id === messageId ? { ...m, content, isEdited: true } : m));
          const viewKey = activeConversation
            ? `conv_${activeConversation.id}`
            : `proj_${activeProjectId}_chan_${activeChannel}`;
          setCachedMessages(viewKey, updated);
          return updated;
        });

        if (socket && socket.connected) {
          socket.emit('edit_message', {
            messageId,
            content,
            ...roomPayload,
          });
        }
      }
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const socket = socketRef.current;
      const roomPayload = activeConversation
        ? { conversationId: activeConversation.id }
        : activeProjectId
        ? { projectId: activeProjectId, channel: activeChannel || 'general' }
        : {};

      const res = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages((prev) => {
          const updated = prev.filter((m) => m.id !== messageId);
          const viewKey = activeConversation
            ? `conv_${activeConversation.id}`
            : `proj_${activeProjectId}_chan_${activeChannel}`;
          setCachedMessages(viewKey, updated);
          return updated;
        });

        if (socket && socket.connected) {
          socket.emit('delete_message', {
            messageId,
            ...roomPayload,
          });
        }
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const triggerTyping = (userName: string, isTyping: boolean) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const roomPayload = activeConversation
      ? { conversationId: activeConversation.id }
      : activeProjectId
      ? { projectId: activeProjectId, channel: activeChannel || 'general' }
      : null;

    if (!roomPayload) return;

    // Emit over socket to other tabs/users. Do NOT add self to local typingUsers!
    if (isTyping) {
      socket.emit('typing_start', {
        ...roomPayload,
        userId: currentUser?.id,
        userName,
      });
    } else {
      socket.emit('typing_stop', {
        ...roomPayload,
        userId: currentUser?.id,
        userName,
      });
    }
  };

  const createTask = async (data: Partial<Task>): Promise<Task | null> => {
    if (!activeProjectId) return null;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentUser?.id) {
        headers['x-user-id'] = currentUser.id;
      }
      const token = typeof window !== 'undefined' ? localStorage.getItem('devconnect_token') : null;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...data,
          projectId: activeProjectId,
          createdBy: currentUser?.id || '',
        }),
      });
      if (res.ok) {
        const created = await res.json();
        const createdTaskObj = created.task;
        const assignedUser =
          (createdTaskObj.assignedTo && createdTaskObj.assigneeUser?.id === createdTaskObj.assignedTo ? createdTaskObj.assigneeUser : null) ||
          usersRef.current.find((u) => u.id === createdTaskObj.assignedTo) ||
          createdTaskObj.assigneeUser;

        const taskWithAssignee: Task = {
          ...createdTaskObj,
          assigneeUser: assignedUser || createdTaskObj.assigneeUser,
        };

        setTasks((prev) => [taskWithAssignee, ...prev]);
        setIsCreateTaskOpen(false);
        setPrefillTask(null);
        fetchActiveDetails();
        return taskWithAssignee;
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    }
    return null;
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    // 1. Optimistically update tasks state immediately
    setTasks((prev) => {
      const exists = prev.some(
        (t) =>
          t.id === taskId ||
          t.messageId === taskId ||
          `task_${t.messageId}` === taskId ||
          t.id.replace(/^task_/, '') === taskId
      );
      if (exists) {
        return prev.map((t) =>
          t.id === taskId ||
          t.messageId === taskId ||
          `task_${t.messageId}` === taskId ||
          t.id.replace(/^task_/, '') === taskId
            ? { ...t, status }
            : t
        );
      }
      return prev;
    });

    // 2. Optimistically update messages state immediately so the chat card reflects the new status instantly
    setMessages((prev) =>
      prev.map((m) => {
        const matches =
          m.taskData?.id === taskId ||
          m.id === taskId ||
          `task_${m.id}` === taskId ||
          m.id === taskId.replace(/^task_/, '') ||
          (m.metadata && m.metadata.includes(taskId));

        if (matches) {
          const updatedTaskData = m.taskData ? { ...m.taskData, status } : undefined;
          let updatedMeta = m.metadata;
          try {
            const metaObj = JSON.parse(m.metadata || '{}');
            metaObj.status = status;
            updatedMeta = JSON.stringify(metaObj);
          } catch {}
          return {
            ...m,
            metadata: updatedMeta,
            taskData:
              updatedTaskData ||
              (m.messageType === 'TASK'
                ? {
                    id: taskId,
                    projectId: m.projectId || activeProjectId || 'proj_ai_employee',
                    messageId: m.id,
                    title: m.content.replace(/^📋\s*(?:\*\*\[TASK\]\*\*)?:?\s*/i, '').slice(0, 80) || 'Task',
                    priority: 'MEDIUM',
                    status,
                    assignedTo: m.senderId,
                    createdBy: m.senderId,
                    createdAt: m.createdAt,
                  }
                : undefined),
          };
        }
        return m;
      })
    );

    if (status === 'COMPLETED') {
      try {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      } catch {}
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentUser?.id) {
        headers['x-user-id'] = currentUser.id;
      }
      const token = typeof window !== 'undefined' ? localStorage.getItem('devconnect_token') : null;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status, userId: currentUser?.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId || t.id === data.task.id || t.messageId === data.task.messageId
                ? data.task
                : t
            )
          );
        }
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const createBug = async (data: Partial<Bug>): Promise<Bug | null> => {
    if (!activeProjectId) return null;
    try {
      const res = await fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          projectId: activeProjectId,
          createdBy: currentUser?.id || '',
        }),
      });
      if (res.ok) {
        const created = await res.json();
        const createdBugObj = created.bug;
        const assignedUser =
          (createdBugObj.assignedTo && createdBugObj.assigneeUser?.id === createdBugObj.assignedTo ? createdBugObj.assigneeUser : null) ||
          usersRef.current.find((u) => u.id === createdBugObj.assignedTo) ||
          createdBugObj.assigneeUser;

        const bugWithAssignee: Bug = {
          ...createdBugObj,
          assigneeUser: assignedUser || createdBugObj.assigneeUser,
        };

        setBugs((prev) => [bugWithAssignee, ...prev]);
        setIsCreateBugOpen(false);
        setPrefillBug(null);
        fetchActiveDetails();
        return bugWithAssignee;
      }
    } catch (err) {
      console.error('Failed to create bug:', err);
    }
    return null;
  };

  const updateBugStatus = async (bugId: string, status: BugStatus) => {
    // 1. Optimistically update bugs state immediately
    setBugs((prev) => {
      const exists = prev.some(
        (b) =>
          b.id === bugId ||
          b.messageId === bugId ||
          `bug_${b.messageId}` === bugId ||
          b.id.replace(/^bug_/, '') === bugId
      );
      if (exists) {
        return prev.map((b) =>
          b.id === bugId ||
          b.messageId === bugId ||
          `bug_${b.messageId}` === bugId ||
          b.id.replace(/^bug_/, '') === bugId
            ? { ...b, status }
            : b
        );
      }
      return prev;
    });

    // 2. Optimistically update messages state immediately
    setMessages((prev) =>
      prev.map((m) => {
        const matches =
          m.bugData?.id === bugId ||
          m.id === bugId ||
          `bug_${m.id}` === bugId ||
          m.id === bugId.replace(/^bug_/, '') ||
          (m.metadata && m.metadata.includes(bugId));

        if (matches) {
          const updatedBugData = m.bugData ? { ...m.bugData, status } : undefined;
          let updatedMeta = m.metadata;
          try {
            const metaObj = JSON.parse(m.metadata || '{}');
            metaObj.status = status;
            updatedMeta = JSON.stringify(metaObj);
          } catch {}
          return {
            ...m,
            metadata: updatedMeta,
            bugData: updatedBugData,
          };
        }
        return m;
      })
    );

    if (status === 'FIXED') {
      try {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
      } catch {}
    }

    try {
      const res = await fetch(`/api/bugs/${bugId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.bug) {
          setBugs((prev) =>
            prev.map((b) =>
              b.id === bugId || b.id === data.bug.id || b.messageId === data.bug.messageId
                ? data.bug
                : b
            )
          );
        }
      }
    } catch (err) {
      console.error('Failed to update bug:', err);
    }
  };

  const uploadFile = async (file: File) => {
    if (!activeProjectId && !activeConversation) return;
    try {
      // 1. Get presigned upload URL or fallback endpoint
      const presignRes = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          projectId: activeProjectId || undefined,
          conversationId: activeConversation?.id || undefined,
        }),
      });

      if (!presignRes.ok) throw new Error('Failed to get upload authorization');
      const presign = await presignRes.json();

      // 2. Upload file binary to Backblaze B2 (or local fallback)
      if (presign.isCloudB2) {
        try {
          await fetch(presign.uploadUrl, {
            method: 'PUT',
            headers: presign.headers || { 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
          });
        } catch (directErr) {
          console.warn('Direct B2 upload error, falling back to server-side relay:', directErr);
          const formData = new FormData();
          formData.append('file', file);
          formData.append('storageKey', presign.storageKey);
          if (activeProjectId) formData.append('projectId', activeProjectId);
          if (activeConversation?.id) formData.append('conversationId', activeConversation.id);
          await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
          });
        }
      } else {
        const formData = new FormData();
        formData.append('file', file);
        if (activeProjectId) formData.append('projectId', activeProjectId);
        if (activeConversation?.id) formData.append('conversationId', activeConversation.id);
        await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
      }

      // 3. Confirm upload and link metadata in TiDB
      const confirmRes = await fetch('/api/files/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachmentId: presign.attachmentId || presign.attachment?.id,
          storageKey: presign.storageKey,
          projectId: activeProjectId || undefined,
          conversationId: activeConversation?.id || undefined,
        }),
      });

      const confirmData = await confirmRes.json().catch(() => ({}));
      const resolvedAttachment: Attachment = confirmData.attachment || presign.attachment || {
        id: presign.attachmentId || `att_${Date.now()}`,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        storageProvider: presign.isCloudB2 ? 'BACKBLAZE_B2' : 'LOCAL',
        storageKey: presign.storageKey,
        fileUrl: `/api/files/download-fallback?key=${encodeURIComponent(presign.storageKey)}`,
        createdAt: new Date().toISOString(),
      };

      // 4. Update attachments in local state
      setAttachments((prev) => [resolvedAttachment, ...prev.filter((a) => a.id !== resolvedAttachment.id)]);

      // 5. Post to chat message
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isImage = ext && ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext);

      await sendMessage({
        content: `Uploaded file: ${file.name}`,
        messageType: isImage ? 'IMAGE' : 'FILE',
        attachmentData: resolvedAttachment,
      });

      confetti({ particleCount: 40, spread: 50, origin: { y: 0.9 } });
    } catch (err) {
      console.error('File upload error:', err);
    }
  };

  const askAi = async (prompt: string) => {
    if (!activeProjectId || !prompt.trim()) return;
    const userMsg = { role: 'user' as const, text: prompt, timestamp: 'Just now' };
    setAiMessages((prev) => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProjectId,
          prompt,
          userId: currentUser?.id || '',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiMessages((prev) => [
          ...prev,
          { role: 'assistant', text: data.answer, timestamp: 'Just now' },
        ]);
      }
    } catch (err) {
      console.error('AI assistant error:', err);
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Sorry, I encountered an issue analyzing the project context. Please try again.',
          timestamp: 'Just now',
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const openConvertModal = (msg: Message, defaultType: 'TASK' | 'BUG' = 'TASK') => {
    setConvertingMessage(msg);
    setIsConvertModalOpen(true);
  };

  const convertMessageToBug = (msg: Message) => {
    openConvertModal(msg, 'BUG');
  };

  const convertMessageToTask = (msg: Message) => {
    openConvertModal(msg, 'TASK');
  };

  const convertMessage = async (messageId: string, payload: ConvertMessageRequest) => {
    try {
      const res = await fetch(`/api/messages/${messageId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.type === 'TASK' && result.task) {
          setTasks((prev) => [result.task, ...prev.filter((t) => t.id !== result.task.id)]);
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, messageType: 'TASK', taskData: result.task } : m))
          );
        } else if (result.type === 'BUG' && result.bug) {
          setBugs((prev) => [result.bug, ...prev.filter((b) => b.id !== result.bug.id)]);
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, messageType: 'BUG', bugData: result.bug } : m))
          );
        }
        setIsConvertModalOpen(false);
        setConvertingMessage(null);
        fetchActiveDetails();
      }
    } catch (err) {
      console.error('Failed to convert message:', err);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('devconnect_token');
    localStorage.removeItem('devconnect_user_id');
    localStorage.removeItem('devconnect_active_conv_id');
    setCurrentUser(null);
    setConversations([]);
    setActiveConversation(null);
    setIsProfileOpen(false);
    setIsAuthModalOpen(true);
  };

  // ── Phase 6: Notification actions ─────────────────────────────────────────

  const markNotifRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const markAllNotifsRead = async () => {
    try {
      const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const fetchNotifPreferences = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/notifications/preferences');
      if (res.ok) {
        const data = await res.json();
        setNotifPreferences(data.preferences);
      }
    } catch (err) {
      console.error('Failed to fetch notification preferences:', err);
    }
  }, [currentUser?.id]);

  const saveNotifPreferences = async (prefs: Partial<NotificationPreferences>) => {
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (res.ok) {
        const data = await res.json();
        setNotifPreferences(data.preferences);
      }
    } catch (err) {
      console.error('Failed to save notification preferences:', err);
    }
  };

  // Fetch notifications after user loads
  useEffect(() => {
    if (currentUser?.id) {
      fetchNotifications();
      fetchNotifPreferences();
    }
  }, [currentUser?.id, fetchNotifications, fetchNotifPreferences]);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        projects,
        activeProjectId,
        activeProject,
        activeChannel,
        activeConversation,
        conversations,
        messages,
        tasks,
        bugs,
        attachments,
        activity,
        members,
        typingUsers,
        triggerTyping,
        isSocketConnected,
        selectProject,
        deleteProject,
        selectChannel,
        selectConversation,
        sendMessage,
        toggleReaction,
        editMessage,
        deleteMessage,
        createTask,
        updateTaskStatus,
        createBug,
        updateBugStatus,
        uploadFile,
        aiMessages,
        isAiLoading,
        askAi,
        isSearchOpen,
        setIsSearchOpen,
        isCreateBugOpen,
        setIsCreateBugOpen,
        isCreateTaskOpen,
        setIsCreateTaskOpen,
        isProfileOpen,
        setIsProfileOpen,
        isCreateProjectOpen,
        setIsCreateProjectOpen,
        isDeleteProjectOpen,
        setIsDeleteProjectOpen,
        projectToDelete,
        setProjectToDelete,
        isProjectMembersOpen,
        setIsProjectMembersOpen,
        userRole,
        isStatusOpen,
        setIsStatusOpen,
        isRightPanelOpen,
        setIsRightPanelOpen,
        activeRightTab,
        setActiveRightTab,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        isAuthModalOpen,
        setIsAuthModalOpen,
        logout,
        convertMessageToBug,
        convertMessageToTask,
        prefillBug,
        prefillTask,
        isConvertModalOpen,
        setIsConvertModalOpen,
        convertingMessage,
        setConvertingMessage,
        convertMessage,
        openConvertModal,
        refreshData,
        isAutoSyncActive: true,
        lastSyncedAt,
        // Phase 6 – Notifications
        notifications,
        unreadCount,
        isNotifOpen,
        setIsNotifOpen,
        notifPreferences,
        fetchNotifications,
        markNotifRead,
        markAllNotifsRead,
        fetchNotifPreferences,
        saveNotifPreferences,
        isNotifSettingsOpen,
        setIsNotifSettingsOpen,
        // Realtime Notification Toasts
        toasts,
        dismissToast,
        triggerToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}


export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
}
