import { User, Project, ProjectMember, Message, Task, Bug, Attachment, ActivityLog, AppNotification } from './types';

// All dummy users removed — only real registered users exist in the platform
export const INITIAL_USERS: User[] = [];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj_ai_employee',
    name: 'Zetta AI Employee',
    description: 'Autonomous AI engineering assistant with project context memory, PR automation, and bug diagnostics.',
    ownerId: '',
    githubRepo: 'zettaweb/zetta-ai-employee',
    status: 'ACTIVE',
    channels: ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'proj_client_portal',
    name: 'Client Portal',
    description: 'Enterprise client workspace for deliverables tracking, feedback collection, and billing transparency.',
    ownerId: '',
    githubRepo: 'zettaweb/client-portal',
    status: 'ACTIVE',
    channels: ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
    createdAt: '2026-09-15T09:30:00Z',
  },
  {
    id: 'proj_mobile_app',
    name: 'Mobile App',
    description: 'Native mobile companion for iOS and Android built for on-the-go incident triage and quick team chats.',
    ownerId: '',
    githubRepo: 'zettaweb/zettadev-mobile',
    status: 'ACTIVE',
    channels: ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
    createdAt: '2026-09-20T14:15:00Z',
  },
  {
    id: 'proj_internal_tools',
    name: 'Internal Tools',
    description: 'ZettaWeb core build scripts, deployment webhooks, and telemetry aggregator.',
    ownerId: '',
    githubRepo: 'zettaweb/internal-tools',
    status: 'ACTIVE',
    channels: ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
    createdAt: '2026-10-01T08:00:00Z',
  },
];

export const INITIAL_MEMBERS: ProjectMember[] = [];
export const INITIAL_TASKS: Task[] = [];
export const INITIAL_BUGS: Bug[] = [];
export const INITIAL_ATTACHMENTS: Attachment[] = [];
export const INITIAL_ACTIVITY: ActivityLog[] = [];
export const INITIAL_MESSAGES: Message[] = [];
export const INITIAL_NOTIFICATIONS: AppNotification[] = [];
