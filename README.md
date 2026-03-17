# Partnr Execution OS

Internal task tracking, escalation, and follow-through system for leadership decisions.

## What it does

- Converts leadership decisions into tracked tasks with owners, due dates, and WhatsApp numbers
- Dashboard with open/overdue/due-today counts, on-time closure rate, escalation queue, reminder feed
- Owner-wise closure rate tracking
- Overdue task management with 1+/3+/7+ day filters
- Weekly review page with top performers and attention-needed owners
- Full activity log, comments, and reminder history per task
- Escalation levels: L0 (none) → L1 (manager) → L2 (admin/CEO)
- WhatsApp reminders via Twilio or Mock provider
- Inbound WhatsApp reply handling: DONE / DELAYED / NEED HELP
- Meeting notes AI extraction → auto-create tasks (mock regex or OpenAI GPT-4o-mini)
- Automated reminder + escalation engine (cron job endpoint, idempotent)
- Weekly summary automation with WhatsApp-formatted text
- n8n-ready job endpoints for no-code automation

---

## Tech Stack

| Layer    | Technology                    |
|----------|-------------------------------|
| Frontend | Next.js 14 (App Router)       |
| Backend  | Next.js API Routes            |
| Database | SQLite (Prisma ORM)           |
| Styling  | Tailwind CSS                  |
| Icons    | Lucide React                  |
| Dates    | date-fns                      |

> To use **PostgreSQL** instead: change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma` and update `DATABASE_URL` in `.env`.

---

## Setup & Run Locally

### 1. Install dependencies

```bash
cd partnr-execution-os
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Defaults work for local dev — no external services required
```

### 3. Set up the database

```bash
npm run db:push      # creates the SQLite DB and tables
npm run db:seed      # loads 20 realistic sample tasks + 7 users
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Other commands

| Command             | Description                             |
|---------------------|-----------------------------------------|
| `npm run db:studio` | Open Prisma Studio (visual DB browser)  |
| `npm run db:reset`  | Wipe DB and re-seed                     |
| `npm run build`     | Production build                        |

**After any schema change:**
```bash
npx prisma db push
npx prisma generate
# Then restart the dev server
```

---

## Project Structure

```
partnr-execution-os/
├── prisma/
│   ├── schema.prisma          # DB schema (Task, Activity, Comment, Reminder, User, MeetingNote)
│   └── seed.ts                # 20 sample tasks, 7 users with manager hierarchy
├── docs/
│   └── n8n-integration.md     # n8n setup guide for all automation endpoints
├── src/
│   ├── app/
│   │   ├── page.tsx           # Dashboard
│   │   ├── tasks/
│   │   │   ├── page.tsx       # All Tasks with filters + search
│   │   │   ├── new/page.tsx   # Create Task form
│   │   │   └── [id]/page.tsx  # Task detail, comments, status, escalation, WhatsApp history
│   │   ├── overdue/page.tsx   # Overdue tasks with 1+/3+/7+ day filters
│   │   ├── weekly-review/     # Weekly summary page + WhatsApp copy card
│   │   ├── meeting-notes/     # Paste notes → AI extract → review → save tasks
│   │   └── api/
│   │       ├── tasks/         # GET list, POST create, GET/PUT/DELETE by id
│   │       │   └── [id]/
│   │       │       ├── comments/  # POST add comment
│   │       │       └── status/    # POST update status
│   │       ├── dashboard/     # GET dashboard stats
│   │       ├── overdue/       # GET overdue with filters
│   │       ├── weekly-review/ # GET weekly summary (includes whatsappSummaryText)
│   │       ├── meeting-notes/
│   │       │   ├── extract/   # POST: AI extract tasks from raw notes
│   │       │   └── save/      # POST: save approved tasks to DB
│   │       ├── jobs/
│   │       │   ├── process-reminders/  # POST: run reminder + escalation engine
│   │       │   └── weekly-summary/     # GET: full weekly report JSON
│   │       └── webhooks/
│   │           └── whatsapp/  # POST: handle inbound Twilio/mock replies
│   ├── components/
│   │   ├── layout/Sidebar.tsx
│   │   ├── dashboard/
│   │   │   ├── StatsCard.tsx
│   │   │   ├── OwnerStatsTable.tsx
│   │   │   └── WeeklySummaryCard.tsx  # Copy-to-clipboard WhatsApp text
│   │   └── tasks/
│   │       ├── TaskTable.tsx
│   │       ├── TaskForm.tsx
│   │       ├── ActivityLog.tsx
│   │       ├── StatusBadge.tsx
│   │       └── PriorityBadge.tsx
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── utils.ts           # Date helpers, status/priority maps
│   │   ├── ai-extractor.ts    # Mock (regex) + OpenAI task extraction
│   │   ├── reminder-engine.ts # Due-date reminder + escalation logic
│   │   ├── weekly-summary.ts  # Weekly report generator
│   │   └── whatsapp/
│   │       ├── index.ts           # Provider selector + sendWhatsAppMessage()
│   │       ├── templates.ts       # Message templates (6 types + weekly summary)
│   │       ├── mock-provider.ts   # Logs to console, persists to DB
│   │       ├── twilio-provider.ts # Twilio REST API integration
│   │       └── inbound-parser.ts  # Parse DONE / DELAYED / NEED HELP replies
│   └── types/index.ts         # TypeScript interfaces
```

---

## Database Schema

```
User          — id, name, phone, role, function, managerName, managerPhone

Task          — id, title, description, owner, ownerPhone, function,
                priority, dueDate, source, status, escalationLevel,
                escalationStatus, lastEscalatedAt, closedAt, createdAt, updatedAt

Activity      — taskId, type, action, actor, message, notes, metadata, createdAt
Comment       — taskId, author, content, createdAt
Reminder      — taskId, type, channel, recipientName, recipientPhone,
                provider, status, message, metadata, sentAt
MeetingNote   — meetingName, meetingDate, rawNotes, extractedJson, createdAt
```

**Status values:** `OPEN` | `DONE` | `DELAYED` | `OVERDUE`
**Priority values:** `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`
**Escalation levels:** `0` (none) | `1` (manager notified) | `2` (admin/CEO notified)
**Escalation status:** `NONE` | `LEVEL1` | `LEVEL2`

---

## WhatsApp Integration

All tasks store `ownerPhone`. Two modes controlled by `WHATSAPP_PROVIDER`:

| Mode | Behaviour |
|------|-----------|
| `MOCK` (default) | Logs to console, records in Reminder table. No credentials needed. |
| `TWILIO` | Sends real WhatsApp via Twilio REST API. Requires `TWILIO_*` env vars. |

### Inbound reply commands (from owner's WhatsApp)

| Reply | Action |
|-------|--------|
| `DONE` | Marks task Done, logs activity |
| `DELAYED` | Marks task Delayed, sends follow-up asking for new date (deduped — once/day) |
| `NEED HELP` | Keeps task open, escalates to manager |

---

## Reminder & Escalation Engine

Triggered by `POST /api/jobs/process-reminders`. Idempotent — safe to call multiple times per day.

| Days until/past due | Action |
|---------------------|--------|
| 2 days until due | `due_in_2_days` reminder to owner |
| 0 days (due today) | `due_today` reminder to owner |
| 1–2 days overdue | Auto-mark OVERDUE, `overdue_1_day` reminder |
| 3–6 days overdue | Escalate to manager (L1), `escalated_to_manager` message |
| 7+ days overdue | Escalate to admin (L2), `escalated_to_admin` message |

Processes tasks with status `OPEN`, `DELAYED`, or `OVERDUE`.

---

## Meeting Notes AI Extraction

1. Navigate to `/meeting-notes`
2. Enter meeting name, date, and paste raw notes
3. Click **Extract Tasks** → AI extracts action items with owner, due date, priority, function
4. Review + edit extracted tasks inline
5. Click **Save Tasks** → creates Task records in DB

**AI modes** (controlled by `AI_PROVIDER`):
- `MOCK` (default): deterministic regex extraction — no API key needed
- `OPENAI`: GPT-4o-mini with JSON response format — requires `OPENAI_API_KEY`

---

## n8n Integration

See [`docs/n8n-integration.md`](docs/n8n-integration.md) for full setup.

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `POST /api/jobs/process-reminders` | Daily 9 AM | Reminders + escalations |
| `GET /api/jobs/weekly-summary` | Monday 8 AM | Full report + WhatsApp text |
| `POST /api/webhooks/whatsapp` | Twilio webhook | Handle inbound replies |

Optional header auth: `x-job-secret: <REMINDER_JOB_SECRET>`

---

## Environment Variables

See [`.env.example`](.env.example) for full documentation.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite or PostgreSQL URL |
| `WHATSAPP_PROVIDER` | | `MOCK` | `MOCK` or `TWILIO` |
| `TWILIO_ACCOUNT_SID` | Twilio only | — | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio only | — | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | Twilio only | — | e.g. `whatsapp:+14155238886` |
| `AI_PROVIDER` | | `MOCK` | `MOCK` or `OPENAI` |
| `OPENAI_API_KEY` | OpenAI only | — | GPT-4o-mini key |
| `ADMIN_NAME` | | — | Name for L2 escalation recipient |
| `ADMIN_PHONE` | | — | Phone for L2 escalation |
| `REMINDER_JOB_SECRET` | | — | Optional: protect job endpoints |
| `NEXT_PUBLIC_BASE_URL` | | `http://localhost:3000` | App base URL |
