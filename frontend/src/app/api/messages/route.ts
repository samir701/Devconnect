import { NextResponse } from 'next/server';
import {
  getMessages,
  createMessage,
  createBug,
  createTask,
  createAttachment,
  updateAttachment,
  getUserById,
  getProjectById,
} from '@/lib/db';
import { detectSecrets } from '@/lib/secretDetector';
import { prisma } from '@/lib/prisma';
import { createNotification, getUserNotificationPreferences } from '@/lib/notifications';
import { sendMentionEmail, sendTaskAssignedEmail } from '@/lib/email/notifications';
import { getSessionUserId } from '@/lib/auth-guard';
import { emitRealtimeEvent } from '@/lib/activity';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') || undefined;
  const conversationId = searchParams.get('conversationId') || undefined;
  const channel = searchParams.get('channel') || undefined;

  const messages = await getMessages({ projectId, conversationId, channel });
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.content && !body.attachmentData && !body.codeSnippet) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const sessionUserId = getSessionUserId(request);
    const senderId = body.senderId || sessionUserId;
    if (!senderId) {
      return NextResponse.json({ error: 'Authentication required to post messages' }, { status: 401 });
    }

    // Secret check warning indicator
    const secretCheck = detectSecrets(body.content || '');

    let bugData = body.bugData;
    let taskData = body.taskData;
    const attachmentData = body.attachmentData;

    // If message is a bug report, persist to bugs store if not already created
    if (body.messageType === 'BUG' && bugData && body.projectId) {
      if (!bugData.id) {
        bugData = await createBug({
          projectId: body.projectId,
          title: bugData.title || 'Untitled Bug',
          description: bugData.description || body.content,
          endpoint: bugData.endpoint,
          priority: bugData.priority || 'HIGH',
          status: bugData.status || 'OPEN',
          assignedTo: bugData.assignedTo,
          createdBy: senderId,
        });
      }
    }

    // If message is a task, persist to tasks store if not already created
    if (body.messageType === 'TASK' && taskData && body.projectId) {
      if (!taskData.id) {
        taskData = await createTask({
          projectId: body.projectId,
          title: taskData.title || 'Untitled Task',
          description: taskData.description || body.content,
          priority: taskData.priority || 'MEDIUM',
          status: taskData.status || 'TODO',
          assignedTo: taskData.assignedTo,
          createdBy: senderId,
          dueDate: taskData.dueDate || 'Today',
        });
      }

      if (taskData?.assignedTo && taskData.assignedTo !== senderId) {
        try {
          const [creatorUser, assigneeUser, projectData] = await Promise.all([
            getUserById(senderId),
            getUserById(taskData.assignedTo),
            getProjectById(body.projectId),
          ]);
          if (creatorUser && assigneeUser && assigneeUser.email) {
            console.log(`[Messages Task] Dispatching task assigned email from ${creatorUser.email} to ${assigneeUser.email}`);
            await sendTaskAssignedEmail({
              task: taskData,
              creator: { name: creatorUser.name || 'Project Member', email: creatorUser.email },
              assignee: { name: assigneeUser.name || 'Assignee', email: assigneeUser.email },
              project: { name: projectData?.name || 'Devconnect Workspace' },
            });
          }
        } catch (taskEmailErr) {
          console.error('[Messages Task] Email notification error:', taskEmailErr);
        }
      }
    }

    // Attachment persistence handled after message creation to link messageId

    const message = await createMessage({
      projectId: body.projectId,
      conversationId: body.conversationId,
      channel: body.channel || (body.conversationId ? 'direct' : 'general'),
      senderId,
      messageType: body.messageType || 'TEXT',
      content: body.content,
      codeLanguage: body.codeLanguage,
      codeFilename: body.codeFilename,
      metadata: body.metadata || (taskData || bugData ? JSON.stringify({ taskId: taskData?.id, bugId: bugData?.id, ...(taskData || bugData) }) : undefined),
      bugData,
      taskData,
      attachmentData,
      replyToMessageId: body.replyToMessageId,
      replyToMessage: body.replyToMessage,
      isPinned: false,
    });

    if (attachmentData) {
      if (attachmentData.id) {
        await updateAttachment(attachmentData.id, {
          messageId: message.id,
          projectId: body.projectId,
        });
      } else if (body.projectId) {
        await createAttachment({
          projectId: body.projectId,
          messageId: message.id,
          uploaderId: senderId,
          fileName: attachmentData.fileName,
          fileType: attachmentData.fileType || attachmentData.mimeType || 'application/octet-stream',
          mimeType: attachmentData.mimeType || attachmentData.fileType || 'application/octet-stream',
          fileSize: attachmentData.fileSize || 0,
          storageProvider: attachmentData.storageProvider || 'backblaze_b2',
          storageKey: attachmentData.storageKey || `project-files/${body.projectId}/${attachmentData.fileName}`,
          fileUrl: attachmentData.fileUrl,
        });
      }
    }

    // ── Phase 6: Direct Message Notifications ─────────────────────────────────
    if (body.conversationId && senderId) {
      try {
        const parts = body.conversationId.replace('dm_', '').split('_');
        const recipientId = parts.find((p: string) => p !== senderId);

        if (recipientId) {
          const senderUser = await prisma.user.findUnique({
            where: { id: senderId },
            select: { name: true },
          });
          const senderName = senderUser?.name || 'Developer';

          const notif = await createNotification({
            recipientId,
            senderId,
            type: 'DIRECT_MESSAGE',
            priority: 'NORMAL',
            title: `New message from ${senderName}`,
            message: body.content ? body.content.slice(0, 150) : 'Sent an attachment',
            entityId: message.id,
            entityType: 'MESSAGE',
          });

          // Dispatch realtime notification & direct message to recipient
          emitRealtimeEvent('new_notification', {
            userId: recipientId,
            notification: notif,
          }).catch(() => {});

          emitRealtimeEvent('new_message', {
            ...message,
            conversationId: body.conversationId,
            recipientId,
          }).catch(() => {});
        }
      } catch (dmNotifErr) {
        console.error('[Messages] Direct message notification error (non-fatal):', dmNotifErr);
      }
    }

    // ── Phase 6: Project / Channel Notifications for Team Members ───────────
    if (body.projectId && senderId) {
      try {
        const project = await prisma.project.findUnique({
          where: { id: body.projectId },
          include: {
            members: {
              where: { userId: { not: senderId } },
              select: { userId: true },
            },
          },
        });

        if (project && project.members.length > 0) {
          const senderUser = await prisma.user.findUnique({
            where: { id: senderId },
            select: { name: true },
          });
          const senderName = senderUser?.name || 'Developer';
          const channelName = body.channel || 'general';

          for (const member of project.members) {
            const notif = await createNotification({
              recipientId: member.userId,
              senderId,
              projectId: body.projectId,
              type: 'REPLY',
              priority: 'NORMAL',
              title: `#${channelName} • ${senderName}`,
              message: body.content ? body.content.slice(0, 150) : 'Sent an attachment',
              entityId: message.id,
              entityType: 'MESSAGE',
            });

            // Deliver notification to member's personal socket room
            emitRealtimeEvent('new_notification', {
              userId: member.userId,
              notification: notif,
            }).catch(() => {});
          }
        }
      } catch (projNotifErr) {
        console.error('[Messages] Project notification error (non-fatal):', projNotifErr);
      }
    }

    // ── Phase 6: Parse @mentions and dispatch MENTION notifications ───────────
    if (body.projectId && body.senderId && body.content) {
      try {
        const mentionMatches = body.content.match(/@([a-zA-Z0-9_.-]+)/g);
        if (mentionMatches && mentionMatches.length > 0) {
          const mentionedNames: string[] = Array.from(new Set(mentionMatches.map((m: string) => m.slice(1))));

          // Look up mentioned users by name (partial match)
          const mentionedUsers = await prisma.user.findMany({
            where: {
              OR: mentionedNames.map((name: string) => ({
                name: { contains: name },
              })),
              NOT: { id: body.senderId },
            },
            select: { id: true, name: true, email: true },
          });

          if (mentionedUsers.length > 0) {
            const sender = await prisma.user.findUnique({
              where: { id: body.senderId },
              select: { name: true, email: true },
            });
            const project = await prisma.project.findUnique({
              where: { id: body.projectId },
              select: { name: true },
            });

            for (const mentioned of mentionedUsers) {
              const prefs = await getUserNotificationPreferences(mentioned.id);
              if (prefs.inAppAll) {
                await createNotification({
                  recipientId: mentioned.id,
                  senderId: body.senderId,
                  projectId: body.projectId,
                  type: 'MENTION',
                  priority: 'HIGH',
                  title: `${sender?.name ?? 'Someone'} mentioned you`,
                  message: body.content.slice(0, 200),
                  entityId: message.id,
                  entityType: 'MESSAGE',
                });
              }
              if (prefs.emailOnMention && sender && project) {
                sendMentionEmail({
                  mentioner: sender,
                  mentioned,
                  project,
                  messageContent: body.content,
                }).catch(console.error);
              }
            }
          }
        }
      } catch (mentionErr) {
        console.error('[Messages] Mention notification error (non-fatal):', mentionErr);
      }
    }

    return NextResponse.json({
      message,
      secretDetected: secretCheck.hasSecret ? secretCheck : undefined,
    }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

