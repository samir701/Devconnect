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

function getSmtpConfig() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST || (user?.endsWith('@gmail.com') ? 'smtp.gmail.com' : undefined);
  const port = Number(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587));

  if (user && pass && host) {
    return { host, port, user, pass, secure: port === 465 };
  }
  return null;
}

function getBrevoApiKey(): string | undefined {
  return process.env.BREVO_API_KEY?.trim();
}

function getResendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY?.trim();
}

// ─── Core Dispatcher ──────────────────────────────────────────────────────────

async function sendEmail(payload: EmailPayload): Promise<void> {
  // 1. PROVIDER 1: SMTP / Gmail via Nodemailer (100% Free, NO custom domain required!)
  const smtp = getSmtpConfig();
  if (smtp) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });

      const senderDisplayName = payload.from.includes('<')
        ? payload.from.split('<')[0].replace(/"/g, '').trim()
        : 'Devconnect';

      const info = await transporter.sendMail({
        from: `"${senderDisplayName}" <${smtp.user}>`,
        replyTo: payload.replyTo,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });

      console.log(`[Email] Transactional email dispatched via SMTP (${smtp.host}) to ${payload.to} (MessageId: ${info.messageId})`);
      return;
    } catch (smtpErr) {
      console.error('[Email] SMTP delivery failed, falling back to alternative provider:', smtpErr);
    }
  }

  // 2. PROVIDER 2: Brevo (Sendinblue) Free API (300 emails/day, NO custom domain required!)
  const brevoKey = getBrevoApiKey();
  if (brevoKey) {
    try {
      const senderDisplayName = payload.from.includes('<')
        ? payload.from.split('<')[0].replace(/"/g, '').trim()
        : 'Devconnect';
      const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'samirbrahma2003@gmail.com';

      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderDisplayName, email: senderEmail },
          to: [{ email: payload.to }],
          replyTo: { email: payload.replyTo },
          subject: payload.subject,
          htmlContent: payload.html,
          textContent: payload.text,
        }),
      });

      if (brevoRes.ok) {
        const brevoData = await brevoRes.json();
        console.log(`[Email] Transactional email dispatched successfully via Brevo to ${payload.to} (MessageId: ${brevoData.messageId})`);
        return;
      } else {
        const errData = await brevoRes.text();
        console.error('[Email] Brevo API error:', errData);
      }
    } catch (brevoErr) {
      console.error('[Email] Brevo request failed, falling back to Resend:', brevoErr);
    }
  }

  // 3. PROVIDER 3: Resend
  const apiKey = getResendApiKey();
  const isMock =
    !apiKey ||
    apiKey.includes('your_resend_api_key') ||
    apiKey.includes('<your-resend-api-key>') ||
    apiKey === 're_placeholder';

  if (isMock) {
    // ── Mock mode: structured terminal log ──
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  📧  [Devconnect Email Mock — No RESEND_API_KEY set]  ║');
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

    // 1. If custom domain is unverified on Resend, retry using verified sandbox sender
    if (error && (error.message?.includes('not verified') || error.name === 'validation_error') && !payload.from.includes('onboarding@resend.dev')) {
      console.warn('[Email] Domain unverified on Resend. Falling back to onboarding@resend.dev sandbox...');
      const fallbackFrom = payload.from.includes('<')
        ? payload.from.replace(/<[^>]+>/, '<onboarding@resend.dev>')
        : 'Devconnect <onboarding@resend.dev>';
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

    // 2. If in Resend free test mode (where emails can only be sent to account owner email, e.g. samirbrahma2003@gmail.com)
    if (error && error.message?.includes('You can only send testing emails to your own email address')) {
      const match = error.message.match(/\(([^)]+)\)/);
      const testOwnerEmail = match ? match[1] : 'samirbrahma2003@gmail.com';
      console.warn(`[Email] Resend free testing tier restriction detected. Intended recipient: "${payload.to}". Routing preview to verified Resend owner "${testOwnerEmail}"...`);

      const sandboxBanner = `
        <div style="background:#1e1b4b; border:1px solid #6366f1; border-radius:8px; padding:12px 16px; margin-bottom:20px; font-size:12px; color:#c7d2fe; font-family:sans-serif;">
          <strong style="color:#a5b4fc; font-size:13px;">📬 Resend Test Sandbox Notification</strong><br />
          <span style="display:inline-block; margin-top:4px;">Target Recipient: <strong>${payload.to}</strong></span><br />
          <span style="color:#94a3b8; font-size:11px; display:inline-block; margin-top:4px;">In Resend test sandbox mode without a verified custom domain, emails are delivered to your verified Resend account (<code>${testOwnerEmail}</code>). Once you verify a custom domain at <a href="https://resend.com/domains" style="color:#818cf8; text-decoration:underline;">resend.com/domains</a>, emails deliver directly to every developer's own inbox!</span>
        </div>
      `;
      const sandboxHtml = payload.html.replace('<div class="body">', `<div class="body">${sandboxBanner}`);
      const sandboxText = `[Resend Sandbox - Intended Recipient: ${payload.to}]\n\n${payload.text}`;

      const retryRes = await resend.emails.send({
        from: 'Devconnect <onboarding@resend.dev>',
        replyTo: payload.replyTo,
        to: [testOwnerEmail],
        subject: `[Devconnect -> ${payload.to}] ${payload.subject}`,
        html: sandboxHtml,
        text: sandboxText,
      });
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      console.error('[Email] Resend error dispatching to', payload.to, ':', error);
    } else {
      console.log(`[Email] Transactional email dispatched successfully via Resend to ${payload.to} (ID: ${data?.id})`);
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
      <div class="logo">&#9889; Devconnect</div>
      <div class="badge">Developer Collaboration Workspace</div>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      You received this notification because you are a project member on Devconnect.<br />
      Track and manage your tasks, bugs, and real-time project updates inside the workspace.
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
      <div class="meta-row"><span class="label">Assigned By</span><span class="value">${creator.name} (${creator.email})</span></div>
      <div class="meta-row"><span class="label">Assigned To</span><span class="value">${assignee.name} (${assignee.email})</span></div>
      <div class="meta-row"><span class="label">Priority</span><span class="value">${task.priority ?? 'MEDIUM'}</span></div>
      <div class="meta-row"><span class="label">Status</span><span class="value">${task.status ?? 'TODO'}</span></div>
      ${task.dueDate ? `<div class="meta-row"><span class="label">Due</span><span class="value">${task.dueDate}</span></div>` : ''}
      ${task.description ? `<div class="meta-row"><span class="label">Description</span><span class="value">${task.description}</span></div>` : ''}
    </div>
    <p style="color:#8b949e;font-size:13px;">Reply directly to this email to contact ${creator.name} (${creator.email}).</p>`
  );

  const text = `Task Assigned: ${task.title}\n\n${creator.name} assigned you a task in ${project.name}.\n\nTask: ${task.title}\nAssigned by: ${creator.name} (${creator.email})\nPriority: ${task.priority ?? 'MEDIUM'}\nStatus: ${task.status ?? 'TODO'}\n${task.description ? `\nDescription: ${task.description}` : ''}\n\nReply to this email to respond directly to ${creator.name}.`;

  await sendEmail({
    from: `"${creator.name} via Devconnect" <${FROM_ADDRESS}>`,
    replyTo: creator.email,
    to: assignee.email,
    subject: `[Devconnect] Task Assigned: ${task.title}`,
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
    <p><strong>${completer.name}</strong> marked your task as completed in <strong>${project.name}</strong>.</p>
    <div class="meta">
      <div class="meta-row"><span class="label">Task</span><span class="value">${task.title}</span></div>
      <div class="meta-row"><span class="label">Completed by</span><span class="value">${completer.name} (${completer.email})</span></div>
      <div class="meta-row"><span class="label">Assigned by</span><span class="value">${creator.name} (${creator.email})</span></div>
      <div class="meta-row"><span class="label">Project</span><span class="value">${project.name}</span></div>
    </div>
    <p style="color:#8b949e;font-size:13px;">Reply directly to this email to contact ${completer.name} (${completer.email}).</p>`
  );

  const text = `Task Completed: ${task.title}\n\n${completer.name} completed a task you created in ${project.name}.\n\nTask: ${task.title}\nProject: ${project.name}\nCompleted by: ${completer.name} (${completer.email})\n\nReply to this email to respond directly to ${completer.name}.`;

  await sendEmail({
    from: `"${completer.name} via Devconnect" <${FROM_ADDRESS}>`,
    replyTo: completer.email,
    to: creator.email,
    subject: `[Devconnect] Task Completed: ${task.title}`,
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
