/**
 * Phase 6 – Transactional Email Dispatch Service
 *
 * Uses Resend when RESEND_API_KEY is configured.
 * Falls back to a rich terminal mock log when the key is absent.
 *
 * SPF / DMARC guardrail:
 *   – "From" is always  "Display Name via ZettaDev <notifications@MAIL_FROM_DOMAIN>"
 *   – "Reply-To" is the real sender's email so replies land in their inbox.
 */

import type { Task, Bug, User, Project } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailPayload {
  from: string;     // "Name via ZettaDev <notifications@domain>"
  replyTo: string;  // real sender email
  to: string;
  subject: string;
  html: string;
  text: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MAIL_FROM_DOMAIN =
  process.env.MAIL_FROM_DOMAIN || process.env.RESEND_FROM_DOMAIN || 'resend.dev';
const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ||
  (MAIL_FROM_DOMAIN.includes('resend.dev')
    ? 'onboarding@resend.dev'
    : `notifications@${MAIL_FROM_DOMAIN}`);

function getResendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY?.trim();
}

// ─── Core Dispatcher ──────────────────────────────────────────────────────────

async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = getResendApiKey();
  const isMock =
    !apiKey ||
    apiKey.includes('your_resend_api_key') ||
    apiKey.includes('<your-resend-api-key>') ||
    apiKey === 're_placeholder';

  if (isMock) {
    // ── Mock mode: structured terminal log ──
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  📧  [ZettaDev Email Mock — No RESEND_API_KEY set]   ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  From    : ${payload.from}`);
    console.log(`║  Reply-To: ${payload.replyTo}`);
    console.log(`║  To      : ${payload.to}`);
    console.log(`║  Subject : ${payload.subject}`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(payload.text);
    console.log('╚══════════════════════════════════════════════════════╝\n');
    return;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    let { data, error } = await resend.emails.send({
      from: payload.from,
      replyTo: payload.replyTo,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    // If custom domain is not verified in Resend yet, automatically fallback to onboarding@resend.dev
    if (error && (error.message?.includes('not verified') || error.name === 'validation_error') && !payload.from.includes('onboarding@resend.dev')) {
      console.warn('[Email] Domain unverified on Resend. Falling back to onboarding@resend.dev sandbox...');
      const fallbackFrom = payload.from.includes('<')
        ? payload.from.replace(/<[^>]+>/, '<onboarding@resend.dev>')
        : 'ZettaDev <onboarding@resend.dev>';
      const retryRes = await resend.emails.send({
        from: fallbackFrom,
        replyTo: payload.replyTo,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      console.error('[Email] Resend error dispatching to', payload.to, ':', error);
    } else {
      console.log(`[Email] Transactional email dispatched successfully to ${payload.to} (ID: ${data?.id})`);
    }
  } catch (err) {
    console.error('[Email] Failed to send via Resend:', err);
  }
}

// ─── HTML Template Helpers ────────────────────────────────────────────────────

function wrapEmailHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#0d1117; font-family:'Segoe UI',Arial,sans-serif; color:#e6edf3; }
    .wrapper { max-width:600px; margin:32px auto; background:#161b22; border-radius:12px; overflow:hidden; border:1px solid #30363d; }
    .header { background:linear-gradient(135deg,#1f2f5a 0%,#0f172a 100%); padding:28px 32px; }
    .logo { font-size:18px; font-weight:700; color:#60a5fa; letter-spacing:-0.5px; }
    .badge { display:inline-block; margin-top:4px; font-size:10px; background:#1e3a8a; color:#93c5fd; padding:2px 8px; border-radius:12px; }
    .body { padding:32px; }
    h2 { margin:0 0 16px; font-size:20px; color:#f0f6ff; }
    .meta { background:#0d1117; border-radius:8px; padding:16px; margin:16px 0; font-size:13px; }
    .meta-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #21262d; }
    .meta-row:last-child { border-bottom:none; }
    .label { color:#8b949e; }
    .value { color:#e6edf3; font-weight:600; text-align:right; max-width:70%; }
    .footer { padding:20px 32px; font-size:11px; color:#484f58; border-top:1px solid #21262d; text-align:center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">&#9889; ZettaDev</div>
      <div class="badge">Developer Workspace</div>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      You received this because you are a member of a ZettaDev project.<br />
      Manage your notification preferences inside the app.
    </div>
  </div>
</body>
</html>`;
}

// ─── Public Email Functions ───────────────────────────────────────────────────

export async function sendTaskAssignedEmail(params: {
  task: Partial<Task>;
  creator: Pick<User, 'name' | 'email'>;
  assignee: Pick<User, 'name' | 'email'>;
  project: Pick<Project, 'name'>;
}): Promise<void> {
  const { task, creator, assignee, project } = params;

  const html = wrapEmailHtml(
    `Task Assigned: ${task.title}`,
    `<h2>&#128203; You have a new task assigned</h2>
    <p><strong>${creator.name}</strong> assigned you a task in <strong>${project.name}</strong>.</p>
    <div class="meta">
      <div class="meta-row"><span class="label">Task</span><span class="value">${task.title}</span></div>
      <div class="meta-row"><span class="label">Priority</span><span class="value">${task.priority ?? 'MEDIUM'}</span></div>
      <div class="meta-row"><span class="label">Status</span><span class="value">${task.status ?? 'TODO'}</span></div>
      ${task.dueDate ? `<div class="meta-row"><span class="label">Due</span><span class="value">${task.dueDate}</span></div>` : ''}
      ${task.description ? `<div class="meta-row"><span class="label">Description</span><span class="value">${task.description}</span></div>` : ''}
    </div>
    <p style="color:#8b949e;font-size:13px;">Reply to this email to respond directly to ${creator.name}.</p>`
  );

  const text = `Task Assigned: ${task.title}\n\n${creator.name} assigned you a task in ${project.name}.\n\nTask: ${task.title}\nPriority: ${task.priority ?? 'MEDIUM'}\nStatus: ${task.status ?? 'TODO'}\n${task.description ? `\nDescription: ${task.description}` : ''}\n\nReply to this email to respond directly to ${creator.name}.`;

  await sendEmail({
    from: `"${creator.name} via ZettaDev" <${FROM_ADDRESS}>`,
    replyTo: creator.email,
    to: assignee.email,
    subject: `[ZettaDev] Task Assigned: ${task.title}`,
    html,
    text,
  });
}

export async function sendTaskCompletedEmail(params: {
  task: Partial<Task>;
  completer: Pick<User, 'name' | 'email'>;
  creator: Pick<User, 'name' | 'email'>;
  project: Pick<Project, 'name'>;
}): Promise<void> {
  const { task, completer, creator, project } = params;

  const html = wrapEmailHtml(
    `Task Completed: ${task.title}`,
    `<h2>&#9989; Task Completed!</h2>
    <p><strong>${completer.name}</strong> marked a task as completed in <strong>${project.name}</strong>.</p>
    <div class="meta">
      <div class="meta-row"><span class="label">Task</span><span class="value">${task.title}</span></div>
      <div class="meta-row"><span class="label">Completed by</span><span class="value">${completer.name}</span></div>
      <div class="meta-row"><span class="label">Project</span><span class="value">${project.name}</span></div>
    </div>
    <p style="color:#8b949e;font-size:13px;">Reply to this email to respond directly to ${completer.name}.</p>`
  );

  const text = `Task Completed: ${task.title}\n\n${completer.name} completed a task you created in ${project.name}.\n\nTask: ${task.title}\nProject: ${project.name}\n\nReply to this email to respond directly to ${completer.name}.`;

  await sendEmail({
    from: `"${completer.name} via ZettaDev" <${FROM_ADDRESS}>`,
    replyTo: completer.email,
    to: creator.email,
    subject: `[ZettaDev] Task Completed: ${task.title}`,
    html,
    text,
  });
}

export async function sendBugAssignedEmail(params: {
  bug: Partial<Bug>;
  reporter: Pick<User, 'name' | 'email'>;
  assignee: Pick<User, 'name' | 'email'>;
  project: Pick<Project, 'name'>;
}): Promise<void> {
  const { bug, reporter, assignee, project } = params;

  const html = wrapEmailHtml(
    `Bug Assigned: ${bug.title}`,
    `<h2>&#128027; A bug has been assigned to you</h2>
    <p><strong>${reporter.name}</strong> assigned you a bug in <strong>${project.name}</strong>.</p>
    <div class="meta">
      <div class="meta-row"><span class="label">Bug</span><span class="value">${bug.title}</span></div>
      <div class="meta-row"><span class="label">Priority</span><span class="value">${bug.priority ?? 'HIGH'}</span></div>
      <div class="meta-row"><span class="label">Status</span><span class="value">${bug.status ?? 'OPEN'}</span></div>
      ${bug.endpoint ? `<div class="meta-row"><span class="label">Endpoint</span><span class="value">${bug.endpoint}</span></div>` : ''}
      ${bug.description ? `<div class="meta-row"><span class="label">Description</span><span class="value">${bug.description}</span></div>` : ''}
    </div>
    <p style="color:#8b949e;font-size:13px;">Reply to this email to respond directly to ${reporter.name}.</p>`
  );

  const text = `Bug Assigned: ${bug.title}\n\n${reporter.name} assigned you a bug in ${project.name}.\n\nBug: ${bug.title}\nPriority: ${bug.priority ?? 'HIGH'}\nStatus: ${bug.status ?? 'OPEN'}\n${bug.description ? `\nDescription: ${bug.description}` : ''}\n\nReply to this email to respond directly to ${reporter.name}.`;

  await sendEmail({
    from: `"${reporter.name} via ZettaDev" <${FROM_ADDRESS}>`,
    replyTo: reporter.email,
    to: assignee.email,
    subject: `[ZettaDev] Bug Assigned: ${bug.title}`,
    html,
    text,
  });
}

export async function sendMentionEmail(params: {
  mentioner: Pick<User, 'name' | 'email'>;
  mentioned: Pick<User, 'name' | 'email'>;
  project: Pick<Project, 'name'>;
  messageContent: string;
}): Promise<void> {
  const { mentioner, mentioned, project, messageContent } = params;

  const html = wrapEmailHtml(
    `You were mentioned by ${mentioner.name}`,
    `<h2>&#128172; You were mentioned</h2>
    <p><strong>${mentioner.name}</strong> mentioned you in <strong>${project.name}</strong>.</p>
    <div class="meta" style="margin-top:16px;">
      <p style="color:#e6edf3;font-size:14px;line-height:1.6;margin:0;">${messageContent.slice(0, 300).replace(/</g,'&lt;').replace(/>/g,'&gt;')}${messageContent.length > 300 ? '&hellip;' : ''}</p>
    </div>
    <p style="color:#8b949e;font-size:13px;">Reply to this email to respond directly to ${mentioner.name}.</p>`
  );

  const text = `${mentioner.name} mentioned you in ${project.name}:\n\n"${messageContent.slice(0, 300)}"\n\nReply to this email to respond directly to ${mentioner.name}.`;

  await sendEmail({
    from: `"${mentioner.name} via ZettaDev" <${FROM_ADDRESS}>`,
    replyTo: mentioner.email,
    to: mentioned.email,
    subject: `[ZettaDev] ${mentioner.name} mentioned you in ${project.name}`,
    html,
    text,
  });
}
