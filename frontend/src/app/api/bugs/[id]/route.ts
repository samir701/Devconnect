import { NextResponse } from 'next/server';
import { getSessionUserId, checkProjectPermission } from '@/lib/auth-guard';
import { updateBug, getBugs } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { ProjectRole } from '@/lib/types';

const MUTATION_ROLES: ProjectRole[] = ['OWNER', 'ADMIN', 'DEVELOPER', 'QA'];

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    let bug: any = null;

    try {
      bug = await prisma.bug.findUnique({
        where: { id },
        include: { assignee: true, reporter: true },
      });
    } catch {}

    if (!bug && globalThis.__devconnect_store) {
      bug = globalThis.__devconnect_store.bugs.get(id);
    }

    if (!bug) {
      return NextResponse.json({ error: 'Bug not found' }, { status: 404 });
    }

    const userId = getSessionUserId(request);
    const authCheck = await checkProjectPermission(userId, bug.projectId);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    return NextResponse.json({ bug });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve bug';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const userId = getSessionUserId(request);

    // Look up bug to find its projectId for RBAC check
    let existingBug: any = null;
    try {
      existingBug = await prisma.bug.findUnique({ where: { id } });
    } catch {}

    if (!existingBug && globalThis.__devconnect_store) {
      existingBug = globalThis.__devconnect_store.bugs.get(id);
    }

    if (!existingBug) {
      const stripped = id.replace(/^bug_/, '');
      try {
        existingBug = await prisma.bug.findFirst({
          where: {
            OR: [
              { messageId: id },
              { messageId: stripped },
            ],
          },
          include: { assignee: true, reporter: true },
        });
      } catch {}

      if (!existingBug) {
        try {
          const dbMsg = await prisma.message.findFirst({
            where: { OR: [{ id }, { id: stripped }] },
          });
          if (dbMsg) {
            let meta: any = {};
            try { if (dbMsg.metadata) meta = JSON.parse(dbMsg.metadata); } catch {}
            existingBug = await prisma.bug.create({
              data: {
                id: meta?.bugId || id,
                projectId: dbMsg.projectId || 'proj_ai_employee',
                messageId: dbMsg.id,
                title: meta?.title || dbMsg.content.replace(/^🐛\s*(?:\*\*\[BUG\]\*\*)?:?\s*/i, '').slice(0, 80) || 'Bug Report',
                description: meta?.description || dbMsg.content,
                endpoint: meta?.endpoint || undefined,
                priority: meta?.priority || 'HIGH',
                status: 'OPEN',
                assignedTo: meta?.assignedTo || dbMsg.senderId,
                createdBy: dbMsg.senderId,
              },
              include: { assignee: true, reporter: true },
            });
          }
        } catch {}
      }
    }

    if (!existingBug) {
      return NextResponse.json({ error: 'Bug not found' }, { status: 404 });
    }

    // RBAC: Only non-VIEWER members can modify bugs
    const authCheck = await checkProjectPermission(userId, existingBug.projectId, MUTATION_ROLES);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json();
    const updated = await updateBug(existingBug.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Bug not found' }, { status: 404 });
    }

    return NextResponse.json({ bug: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update bug';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
