import { User, Project, ProjectMember, Message, Task, Bug, Attachment, ActivityLog } from '../types';

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
];

export const INITIAL_MEMBERS: ProjectMember[] = [];
export const INITIAL_TASKS: Task[] = [];
export const INITIAL_BUGS: Bug[] = [];
export const INITIAL_ATTACHMENTS: Attachment[] = [];
export const INITIAL_ACTIVITY: ActivityLog[] = [];
export const INITIAL_MESSAGES: Message[] = [];
