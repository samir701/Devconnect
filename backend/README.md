# Devconnect / ZettaDev — Serverless Backend ⚡

> **Stateless Serverless Backend designed for Vercel deployment**  
> Connects directly to **TiDB Cloud (MySQL Serverless)** and **Backblaze B2 (S3 Object Storage)**.

---

## 1. Directory Structure

```
backend/
├── api/                     # Vercel Serverless Function Endpoints
│   ├── activity.ts          # GET /api/activity (Git & project event stream)
│   ├── ai.ts                # POST /api/ai (Project-aware AI analysis)
│   ├── auth/
│   │   ├── login.ts         # POST /api/auth/login
│   │   └── me.ts            # GET/PATCH /api/auth/me
│   ├── bugs.ts              # GET/POST/PATCH /api/bugs (Bug workflow)
│   ├── conversations.ts     # GET /api/conversations (1-to-1 DMs)
│   ├── files.ts             # GET/POST /api/files (Backblaze B2 S3 metadata & presign)
│   ├── messages.ts          # GET/POST /api/messages (Rich messages, reactions, secrets)
│   ├── projects.ts          # GET/POST /api/projects
│   ├── search.ts            # GET /api/search (Cross-entity search)
│   ├── system/
│   │   └── status.ts        # GET /api/system/status (Cloud connectivity diagnostics)
│   └── tasks.ts             # GET/POST/PATCH /api/tasks (Lightweight task tracker)
├── src/
│   ├── services/
│   │   ├── db.service.ts    # TiDB Cloud Serverless client (@tidbcloud/serverless)
│   │   ├── storage.service.ts # Backblaze B2 S3 Client & presigned URLs
│   │   ├── ai.service.ts    # Project context AI engine
│   │   └── secret.service.ts # Developer secret detection heuristics
│   ├── models/
│   │   └── sampleData.ts    # Seed data (Samir, Arun, Debmalya, PR #42)
│   └── types/
│       └── index.ts         # TypeScript Domain Types
├── sql/
│   └── schema.sql           # Full TiDB DDL SQL Schema
├── vercel.json              # Vercel Serverless Function deployment configuration
├── .env.example             # Cloud credentials template
└── package.json
```

---

## 2. Deploying Backend to Vercel

### Step 1: Deploy with Vercel CLI
From inside the `backend/` directory:
```bash
cd backend
vercel
```

### Step 2: Configure Environment Variables in Vercel
In your Vercel Project Settings ➔ **Environment Variables**, configure:
```env
# TiDB Cloud (MySQL 8.0 Serverless)
DATABASE_URL="mysql://<user>:<password>@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/devconnect?ssl={\"rejectUnauthorized\":true}"

# Backblaze B2 Object Storage (S3-Compatible)
B2_APPLICATION_KEY_ID="<your-b2-key-id>"
B2_APPLICATION_KEY="<your-b2-application-key>"
B2_BUCKET_NAME="zettadev-storage"
B2_ENDPOINT="https://s3.us-east-005.backblazeb2.com"
B2_REGION="us-east-005"

# Phase 6: Notifications & Transactional Email (Resend)
RESEND_API_KEY="re_..."
RESEND_FROM_DOMAIN="zettadev.app"
MAIL_FROM_DOMAIN="zettadev.app"
```

---

## 3. Database, Storage & Notification Architecture

1. **TiDB Cloud Serverless**:
   - Queries are dispatched over stateless HTTP REST using `@tidbcloud/serverless` and Prisma ORM.
   - Zero TCP connection limits or connection pool exhaustion during Vercel cold starts.
   - Run `sql/schema.sql` or `npx prisma db push` to synchronize tables.

2. **Backblaze B2 Object Storage**:
   - Files are stored in S3-compatible Backblaze B2 buckets (`zettadev-storage`).
   - Binary files are uploaded directly from client to B2 using presigned URLs, avoiding Vercel payload size limits.
   - File metadata (`file_id`, `message_id`, `storage_key`, `size`) is indexed in TiDB.

3. **Phase 6: Notifications & Transactional Email Engine**:
   - **Real-time Push**: Emits `new_notification` events over Socket.IO to recipient personal channels.
   - **Importance Levels**:
     - `HIGH`: Direct messages, `@mentions`, task assignments, bug assignments.
     - `NORMAL`: Project messages, replies, task completion updates.
     - `LOW`: Reactions and minor activity logs.
   - **Bidirectional Task Email Dispatch**:
     - *Task Assigned*: Automated transactional email to assignee with `From: "{Creator} via ZettaDev" <notifications@domain>` and `Reply-To: {Creator Email}` for SPF/DKIM compliance.
     - *Task Completed*: Notification to creator with `From: "{Completer} via ZettaDev"` and `Reply-To: {Completer Email}`.
   - **Granular User Preferences**: Toggles for in-app and individual email triggers with instant client sync.

