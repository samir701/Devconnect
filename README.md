# Devconnect (ZettaDev) 🚀

> **Developer Communication & Collaboration Workspace**  
> Developed under **ZettaWeb** • Built for **Vercel Serverless** deployment with **TiDB Cloud** and **Backblaze B2**.

[![Next.js](https://img.shields.io/badge/Next.js-16.4.0-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)](https://react.dev/)
[![Database](https://img.shields.io/badge/Database-TiDB%20Serverless-orange?style=flat)](https://www.pingcap.com/tidb-cloud/)
[![Storage](https://img.shields.io/badge/Storage-Backblaze%20B2%20(S3)-red?style=flat)](https://www.backblaze.com/b2/)
[![Deployment](https://img.shields.io/badge/Deploy-Vercel%20Serverless-black?style=flat&logo=vercel)](https://vercel.com/)

---

## 1. Product Overview & Philosophy

**ZettaDev** is a developer-focused communication and collaboration workspace designed around how software engineering teams actually build.

### Core Philosophy
> **WhatsApp-level simplicity + developer-specific functionality + professional project context.**  
> *Simple like WhatsApp. Clean like Linear. Developer-focused like GitHub.*

Existing platforms (Discord, Slack, MS Teams) are either bloated with channel clutter or gaming-oriented. ZettaDev unifies chat, code snippets, bug triage, tasks, and Git context into one cohesive 3-column workspace.

---

## 2. Architecture & Tech Stack

The architecture is built from the ground up to be **100% Serverless on Vercel** — no heavy daemons, background EC2 instances, or persistent TCP socket bottlenecks.

```
                    ┌───────────────────────────┐
                    │  Devconnect / ZettaDev     │
                    │   Next.js 16 (App Router) │
                    └─────────────┬─────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Frontend UI      │    │ Serverless API   │    │ Realtime Layer   │
│ - React 19 + TS  │    │ - /api/messages  │    │ - Server-Sent    │
│ - Tailwind CSS   │    │ - /api/tasks     │    │   Events (SSE)   │
│ - 3-Column Grid  │    │ - /api/bugs      │    │ - HTTP Broadcast │
│ - Glassmorphism  │    │ - /api/ai        │    │ - Zero daemon    │
└──────────────────┘    └─────────┬────────┘    └──────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│ Database Layer: TiDB Cloud   │              │ Object Storage: Backblaze B2 │
│ - MySQL 8.0 Protocol         │              │ - S3-Compatible API          │
│ - @tidbcloud/serverless HTTP │              │ - Presigned Upload / Get URLs│
│ - DDL Schema (schema.sql)    │              │ - No vendor lock-in          │
└──────────────────────────────┘              └──────────────────────────────┘
```

- **Frontend**: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend (Serverless)**: Next.js API Route Handlers (`/api/*`) executing on Vercel Serverless Functions.
- **Database**: **TiDB Cloud Serverless** via official `@tidbcloud/serverless` HTTP REST driver (with automatic local serverless in-memory fallback out-of-the-box).
- **Object Storage**: **Backblaze B2** S3-compatible client (`@aws-sdk/client-s3`) generating presigned URLs for client-side uploads.
- **Realtime**: Server-Sent Events (`/api/realtime/stream`) and event polling for stateless serverless delivery on Vercel.

---

## 3. High-Quality Separated File Structure

```
devconnect/
├── frontend/                     # Dedicated Frontend Web Application
│   ├── public/                   # Static assets & branding
│   ├── src/
│   │   ├── app/                  # Next.js 16 App Router UI
│   │   │   ├── globals.css       # Obsidian dark theme, glassmorphism
│   │   │   ├── layout.tsx        # HTML document layout & SEO tags
│   │   │   └── page.tsx          # Primary 3-column workspace layout
│   │   ├── components/           # Modular UI & Feature Components
│   │   │   ├── chat/             # Conversation area (messages, code, bugs, tasks, files)
│   │   │   ├── modals/           # Interactive modals (Search, Bug, Task, Profile, Status)
│   │   │   ├── panels/           # Right Project Information drawer (6 tabs)
│   │   │   ├── sidebar/          # Left navigation sidebar (Projects & DMs)
│   │   │   └── ui/               # Atomic components (Avatar, Badge, Icons)
│   │   └── lib/
│   │       ├── store.tsx         # Client state management & reactivity
│   │       ├── types.ts          # Frontend domain interfaces
│   │       └── ...
│   ├── package.json              # Frontend package manifest
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── .env.local
│
├── backend/                      # Dedicated Serverless Backend (Vercel)
│   ├── api/                      # Vercel Serverless Function Endpoints
│   │   ├── activity.ts           # GET /api/activity (Git activity feed)
│   │   ├── ai.ts                 # POST /api/ai (Project-aware AI)
│   │   ├── auth/                 # Developer authentication & session
│   │   ├── bugs.ts               # Bug tickets & status workflow
│   │   ├── conversations.ts      # 1-to-1 direct messaging
│   │   ├── files.ts              # Backblaze B2 presigned uploads
│   │   ├── messages.ts           # Rich messages, reactions & secrets
│   │   ├── projects.ts           # Projects & members API
│   │   ├── search.ts             # Global workspace search (Cmd+K)
│   │   ├── system/status.ts      # Cloud diagnostics (TiDB + B2)
│   │   └── tasks.ts              # Lightweight tasks API
│   ├── src/
│   │   ├── services/
│   │   │   ├── db.service.ts     # TiDB Cloud Serverless client
│   │   │   ├── storage.service.ts# Backblaze B2 S3 storage client
│   │   │   ├── ai.service.ts     # Project context AI engine
│   │   │   └── secret.service.ts # Developer secret detection heuristics
│   │   ├── models/
│   │   │   └── sampleData.ts     # Initial seed dataset
│   │   └── types/
│   │       └── index.ts          # Backend domain types
│   ├── sql/
│   │   └── schema.sql            # TiDB Cloud MySQL 8.0 DDL schema
│   ├── vercel.json               # Vercel Serverless Function config
│   ├── .env.example              # Backend credentials template
│   ├── package.json              # Backend package manifest
│   └── README.md                 # Backend deployment guide
│
├── package.json                  # Root monorepo workspace orchestration
└── README.md                     # Root documentation
```

---

## 4. Key Differentiators & Features

### 🐛 Structured Bug Reports
Turn unstructured complaints into actionable project items:
- Priority levels: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- Lifecycle workflow: `OPEN` ➔ `INVESTIGATING` ➔ `IN PROGRESS` ➔ `FIXED` ➔ `CLOSED`
- Track API endpoints (e.g. `/api/auth/login`) and assignees.

### 📋 Lightweight Task Management
- Convert any chat message directly into a task with 1 click.
- Interactive completion checkboxes with rewarding celebratory micro-animations.

### 🛡️ Developer Secret Detection
- Automatically detects accidental credential pastes (`sk-ant-...`, `sk-...`, `ghp_...`, `AKIA...`, database URLs).
- Intercepts before submission with a modal: **[Remove Secret]** or **[Send Anyway]**.

### 💻 Rich Code Messages
- Code snippets with line numbers, copy button, language badges, and custom filename header (e.g. `auth/verifier.py`).

### 📦 Backblaze B2 Storage Integration
- Private project files (PDFs, ZIPs, logs, images) stored in Backblaze B2 S3 buckets with controlled presigned access.
- Metadata indexed in TiDB for sub-millisecond retrieval.

### 🤖 Project-Aware AI Assistant
- Scoped to active project context (tasks, open bugs, recent commits, PR #42).
- Pre-populated chips: *"Summarize today's development discussion"*, *"What changed in authentication this week?"*.

---

## 5. Getting Started Locally

### Prerequisites
- Node.js `v20+` or `v24+`
- npm `v10+`

### Installation
```bash
git clone <your-repo>
cd devconnect
npm install
```

### Run Dev Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.  
*The app works immediately out-of-the-box with pre-seeded developer data!*

---

## 6. TiDB Cloud Database Setup

1. Create a free serverless cluster at [TiDB Cloud](https://tidbcloud.com/).
2. Open the SQL Editor and execute the schema located in:
   ```bash
   src/sql/schema.sql
   ```
3. Copy your connection URL from TiDB Cloud and set it in your environment:
   ```env
   DATABASE_URL="mysql://<user>:<password>@<gateway>.tidbcloud.com:4000/devconnect?ssl={\"rejectUnauthorized\":true}"
   ```

---

## 7. Backblaze B2 Setup

1. Create a bucket in [Backblaze B2](https://www.backblaze.com/b2/) (e.g. `zettadev-storage`).
2. Generate an **Application Key** with Read and Write permissions.
3. Configure your `.env.local`:
   ```env
   B2_APPLICATION_KEY_ID="<your-b2-key-id>"
   B2_APPLICATION_KEY="<your-b2-application-key>"
   B2_BUCKET_NAME="zettadev-storage"
   B2_ENDPOINT="https://s3.us-east-005.backblazeb2.com"
   B2_REGION="us-east-005"
   ```

---

## 8. Deploying to Vercel (Serverless)

Because this project is built on **Next.js App Router**, deploying to Vercel is completely native:

### Option 1: Via Vercel CLI
```bash
npm i -g vercel
vercel
```

### Option 2: Via GitHub / Vercel Dashboard
1. Push this repository to GitHub.
2. In Vercel, click **Add New Project** and select your repository.
3. In **Environment Variables**, add:
   - `DATABASE_URL` (Your TiDB Cloud connection string)
   - `B2_APPLICATION_KEY_ID` (Your Backblaze B2 Key ID)
   - `B2_APPLICATION_KEY` (Your Backblaze B2 Secret)
   - `B2_BUCKET_NAME` (Your B2 bucket name)
   - `B2_ENDPOINT` (Your B2 S3 endpoint)
4. Click **Deploy**. Vercel will build and host all pages and serverless API endpoints instantly!
