'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { io, Socket } from 'socket.io-client';
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

  refreshData: () => Promise<void>;

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
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>('proj_ai_employee');
  const [activeChannel, setActiveChannel] = useState<string>('general');
  const [activeConversation, setActiveConversation] = useState<DirectConversation | null>(null);
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreateBugOpen, setIsCreateBugOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
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

  // Fetch base data
  const refreshData = useCallback(async () => {
    try {
      // 1. Current user
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const uData = await userRes.json();
        setCurrentUser(uData.user);
      }

      // 2. Projects
      const projRes = await fetch('/api/projects');
      if (projRes.ok) {
        const pData = await projRes.json();
        setProjects(pData.projects || []);
      }

      // 3. Conversations
      const convRes = await fetch('/api/conversations?userId=user_samir');
      if (convRes.ok) {
        const cData = await convRes.json();
        setConversations(cData.conversations || []);
        // Extract users from conversations
        const foundUsers: User[] = (cData.conversations || [])
          .map((c: DirectConversation) => c.otherUser)
          .filter(Boolean);
        setUsers(foundUsers);
      }
    } catch (err) {
      console.error('Error fetching base data:', err);
    }
  }, []);

  // Fetch project details when activeProjectId or activeChannel or activeConversation changes
  const fetchActiveDetails = useCallback(async () => {
    try {
      if (activeConversation) {
        // Fetch 1-to-1 messages
        const res = await fetch(`/api/messages?conversationId=${encodeURIComponent(activeConversation.id)}`);
        if (res.ok) {
          const mData = await res.json();
          setMessages(mData.messages || []);
        }
      } else if (activeProjectId) {
        // Fetch project info
        const [projRes, msgRes] = await Promise.all([
          fetch(`/api/projects/${activeProjectId}`),
          fetch(`/api/messages?projectId=${activeProjectId}&channel=${activeChannel}`),
        ]);

        if (projRes.ok) {
          const pData = await projRes.json();
          setMembers(pData.members || []);
          setUserRole(pData.userRole || null);
          setTasks(pData.tasks || []);
          setBugs(pData.bugs || []);
          setAttachments(pData.attachments || []);
          setActivity(pData.activity || []);
        }

        if (msgRes.ok) {
          const mData = await msgRes.json();
          setMessages(mData.messages || []);
        }
      }
    } catch (err) {
      console.error('Error fetching active view details:', err);
    }
  }, [activeProjectId, activeChannel, activeConversation]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    fetchActiveDetails();
  }, [fetchActiveDetails]);

  // Connect to Realtime Socket.IO Server
  useEffect(() => {
    if (!currentUser?.id) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      (typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3001`
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
    });

    socket.on('disconnect', () => {
      setIsSocketConnected(false);
    });

    // 1. Realtime New Message received from another tab or user
    socket.on('new_message', (newMsg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        if (
          newMsg.channel === activeChannel ||
          (activeChannel === 'tasks' && newMsg.messageType === 'TASK') ||
          (activeChannel === 'bugs' && newMsg.messageType === 'BUG')
        ) {
          return [...prev, newMsg];
        }
        return prev;
      });
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
  };

  const selectChannel = (ch: string) => {
    setActiveChannel(ch);
    setActiveConversation(null);
    setIsMobileSidebarOpen(false);
  };

  const selectConversation = (conv: DirectConversation) => {
    setActiveConversation(conv);
    setIsMobileSidebarOpen(false);
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
    try {
      const socket = socketRef.current;
      const roomPayload = activeConversation
        ? { conversationId: activeConversation.id }
        : activeProjectId
        ? { projectId: activeProjectId, channel: activeChannel || 'general' }
        : {};

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          projectId: activeConversation ? undefined : activeProjectId,
          conversationId: activeConversation ? activeConversation.id : undefined,
          channel: activeConversation ? undefined : activeChannel,
          senderId: currentUser?.id || 'user_samir',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const createdMsg = data.message;

        // Add to local state immediately if channel matches or is auto-grouped
        setMessages((prev) => {
          if (prev.some((m) => m.id === createdMsg.id)) return prev;
          if (
            createdMsg.channel === activeChannel ||
            (activeChannel === 'tasks' && createdMsg.messageType === 'TASK') ||
            (activeChannel === 'bugs' && createdMsg.messageType === 'BUG')
          ) {
            return [...prev, createdMsg];
          }
          return prev;
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
      }
    } catch (err) {
      console.error('Failed to send message:', err);
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

      const res = await fetch(`/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, userId: currentUser?.id || 'user_samir' }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === messageId ? data.message : m)));

        if (socket && socket.connected) {
          socket.emit('add_reaction', {
            messageId,
            emoji,
            userId: currentUser?.id || 'user_samir',
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
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, content, isEdited: true } : m))
        );

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
        setMessages((prev) => prev.filter((m) => m.id !== messageId));

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
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          projectId: activeProjectId,
          createdBy: currentUser?.id || 'user_samir',
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTasks((prev) => [created.task, ...prev]);
        setIsCreateTaskOpen(false);
        setPrefillTask(null);
        fetchActiveDetails();
        return created.task;
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
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
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
          createdBy: currentUser?.id || 'user_samir',
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setBugs((prev) => [created.bug, ...prev]);
        setIsCreateBugOpen(false);
        setPrefillBug(null);
        fetchActiveDetails();
        return created.bug;
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
          userId: currentUser?.id || 'user_samir',
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
    setIsProfileOpen(false);
    setIsAuthModalOpen(true);
  };

  // ── Phase 6: Notification actions ─────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/notifications?limit=30');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [currentUser?.id]);

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
