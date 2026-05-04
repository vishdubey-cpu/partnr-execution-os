# Partnr Execution OS — Complete Project Brief for Claude Cowork

---

## 1. What This Product Is

An **internal leadership execution tool** built for Vishal Dubey (CEO, Partnr — 133 active dark stores, B2B auto parts). 

The core problem it solves: leadership meetings happen, decisions get made, action items get assigned — and then nothing gets followed up. People forget. Tasks slip. No accountability.

This system captures meeting notes (typed or via email), extracts action items using AI, assigns them to team members with due dates, sends email reminders on a schedule, escalates overdue tasks, and gives the CEO a daily morning digest of what's on track and what needs attention.

**It is NOT a project management tool like Jira or Asana.** It is a follow-through engine specifically designed for a CEO's workflow — minimal UI, maximum automation.

---

## 2. Current Status

- **LIVE on Railway** at `https://partnr-execution-os-production.up.railway.app`
- GitHub: `vishdubey-cpu/partnr-execution-os` (auto-deploys on push to `main`)
- Fully functional — Vishal uses it daily
- Daily digest emails arrive at 8:00 AM IST every day
- Email ingest is set up (DNS propagating — see Section 7)

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| ORM | Prisma |
| Database | PostgreSQL (Railway managed) |
| Styling | Tailwind CSS |
| Email sending | Resend (primary), Gmail SMTP (fallback) |
| Email receiving | Resend inbound webhook → `tasks@claimback.in` |
| AI extraction | OpenAI GPT-4o (primary) → Claude (sonnet-4-5 → 3-5-sonnet → haiku) → regex mock |
| Hosting | Railway (Node custom server + PostgreSQL) |
| Sending domain | `claimback.in` (verified on Resend) |

---

## 4. Database Schema (prisma/schema.prisma)

```
Task          — title, owner, ownerPhone, ownerEmail, function, priority,
                dueDate, status (OPEN/IN_PROGRESS/DONE/OVERDUE),
                escalationLevel (0/1/2), source
Activity      — audit log per task (type, actor, message, createdAt)
Comment       — per-task comments
Reminder      — every email/WhatsApp/calendar invite sent
                (type, channel, recipientName, recipientEmail,
                 provider, status SENT/FAILED, metadata, Resend email ID)
MeetingNote   — meetingName, meetingDate, rawNotes, extractedJson
User          — name, phone, role, function
                ⚠️ NO email field — emails are stored on Task.ownerEmail
DigestLog     — date string YYYY-MM-DD IST (unique) — prevents digest spam
```

---

## 5. All Features Built

### 5.1 Meeting Notes → Task Extraction
- User pastes MoM text on homepage → redirected to `/meeting-notes`
- AI extracts every action item: title, owner, due date, priority, function, source quote, confidence score
- Rich task cards: colour-coded by priority, confidence %, source quote strip
- Calendar invite panel: toggle per task, time picker (HH:MM), extra attendees field
- On save: tasks created in DB + assignment emails sent + calendar invites sent

### 5.2 Email Ingest (zero-friction — NEW)
- Forward or BCC any MoM email to **`tasks@claimback.in`**
- Resend inbound webhook → `POST /api/email-ingest`
- Body cleaned (strips quoted text, forwarding headers, signatures)
- AI extracts tasks, contacts auto-filled from task history
- Tasks auto-created, assignment emails sent to owners
- Admin receives a confirmation email: "X tasks created from [subject]"
- **Webhook secret**: `INBOUND_WEBHOOK_SECRET=partnr-ingest-9f4b2e7a1d3c8e5f`

### 5.3 Task Tracking
- Dashboard: scorecard (active/due this week/on time/delayed/no response)
- Overdue list with per-person escalation indicators
- Task detail page: status updates, comments, full reminder history
- Per-person task view: `/my-tasks/[owner]`
- Bulk operations

### 5.4 Reminder Engine (src/lib/reminder-engine.ts)
Escalation ladder — runs via cron `POST /api/jobs/process-reminders`:
- **L0**: Assignment email on creation
- **L0**: Midpoint check-in (halfway to due date, no update)
- **L0**: Silence check (3 days before due, no update)
- **L0**: Due today reminder
- **L1**: 1 day overdue → owner reminded + manager notified
- **L2**: 3 days overdue → owner warned (manager escalation notice) + manager notified again
- **L2**: 7+ days overdue → escalated to admin

### 5.5 Daily Digest (8:00 AM IST)
Rich HTML email with:
- Status header: 🔴 Attention / 🟡 Watch Closely / ✅ Clean Execution
- Scorecard pills
- "Needs Your Decision" cards (overdue tasks with action buttons)
- "Drifting This Week" (tasks approaching deadline with no update)
- "People Requiring Attention" (owners with patterns of delays/silence)
- "Completed This Week" chips
- Deduplication via `DigestLog` DB table (Railway restarts don't cause re-sends)
- Force send: `GET /api/jobs/daily-digest?force=1`

### 5.6 WhatsApp Replies (Twilio)
- Owners can reply DONE / DELAYED / NEED HELP via WhatsApp
- `POST /api/webhooks/whatsapp` handles inbound
- Status updated in DB + CEO notified

### 5.7 Calendar Invites
- .ics file generated per task
- Sent as email attachment via Resend
- Timed event (1 hour) if time specified, all-day otherwise
- Extra attendees CC'd on the email
- All logged to Reminder table as CALENDAR_INVITE type

### 5.8 Weekly Summary
- `GET /api/jobs/weekly-summary` — sends weekly report

---

## 6. All Pages

| Route | Purpose |
|---|---|
| `/` | Homepage — paste MoM notes, auto-redirects to /meeting-notes |
| `/meeting-notes` | AI extraction UI with task cards and calendar invite panel |
| `/dashboard` | Stats scorecard + needs-attention list |
| `/tasks` | All tasks with filters |
| `/task-view/[id]` | Task detail: status, comments, reminder history |
| `/overdue` | Overdue tasks |
| `/my-tasks/[owner]` | Per-person task view |
| `/weekly-review` | Weekly summary |

---

## 7. Email Setup (Complete)

### Sending
- Domain: `claimback.in` (verified on Resend, Tokyo region)
- From address set via `EMAIL_FROM` env var
- `first@partnr.in` = group email with 8 members (Resend → group → distributed internally)

### Receiving (Email Ingest)
- **Address**: `tasks@claimback.in`
- **Resend webhook**: `email.received` → `https://partnr-execution-os-production.up.railway.app/api/email-ingest?secret=partnr-ingest-9f4b2e7a1d3c8e5f`
- **Status**: DNS MX record added to GoDaddy via Domain Connect — propagating (can take a few hours)
- Once propagated, forwarding any email to `tasks@claimback.in` creates tasks automatically

### Inbound Email Payload (Resend format)
```json
{
  "type": "email.received",
  "data": {
    "from": "sender@example.com",
    "subject": "MOM - Weekly Leadership Meeting",
    "text": "plain text body",
    "html": "<html>...</html>",
    "date": "2024-03-28T10:00:00.000Z"
  }
}
```

---

## 8. All API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/dashboard` | GET | Stats + scorecard + overdue + escalation list |
| `/api/tasks` | POST | Create task |
| `/api/tasks/[id]` | GET/PUT/DELETE | Task CRUD |
| `/api/tasks/[id]/comments` | POST | Add comment |
| `/api/tasks/[id]/status` | POST | Update status |
| `/api/tasks/[id]/resend-reminder` | POST | Manually resend reminder |
| `/api/tasks/bulk-delete` | POST | Bulk delete |
| `/api/my-tasks/[owner]` | GET | Per-person tasks |
| `/api/overdue` | GET | Overdue tasks with filters |
| `/api/weekly-review` | GET | Weekly summary data |
| `/api/owners` | GET | List all task owners |
| `/api/meeting-notes/extract` | POST | AI extraction + contact backfill |
| `/api/meeting-notes/save` | POST | Save tasks + send emails + calendar invites |
| `/api/email-ingest` | POST | Inbound email → auto-extract + create tasks |
| `/api/jobs/process-reminders` | POST | Cron: run reminder engine |
| `/api/jobs/daily-digest` | GET | Send daily digest (?force=1 to override dedup) |
| `/api/jobs/weekly-summary` | GET | Send weekly summary |
| `/api/jobs/grooming` | GET | Maintenance job |
| `/api/webhooks/whatsapp` | POST | Twilio inbound WhatsApp replies |
| `/api/auth/login` | POST | Login |
| `/api/auth/logout` | POST | Logout |
| `/api/test-email` | GET | Debug: send test email (?to=email) |

---

## 9. Bugs Fixed (History)

| Bug | Root Cause | Fix |
|---|---|---|
| Daily digest sent 3-4x per day | Railway filesystem ephemeral — `.digest-sent` file wiped on restart | Replaced with `DigestLog` DB table for dedup |
| Calendar invites not delivered | Resend response discarded (not awaited) | Properly awaited |
| Calendar invites missing content_type | `.ics` attachment had no MIME type | Added `content_type: "text/calendar; method=REQUEST"` |
| Extra attendees not receiving invites | Listed in ICS file only, not emailed | Now CC'd on the actual email |
| Owner email blank after AI extraction | AI correctly returns `ownerEmail: ""` — no contact data | Extract route queries DB for last known email per owner name, backfills silently |
| Digest startup spam | Catch-up logic fired on every Railway restart | Restricted to 2:30–3:00 AM UTC window only |

---

## 10. Known Gotchas

- `User` model has **NO email field** — owner emails live on `Task.ownerEmail`
- `Reminder` table requires `taskId` — cannot store digest dedup logs there (use `DigestLog`)
- `next.config.js` (not `.ts`) — Next.js 14.2.x does not support TypeScript config
- Build script: `prisma generate && next build` — Railway needs prisma generate at build time
- After schema changes: run `npm run db:push` AND restart dev server
- `first@partnr.in` mail server must whitelist `claimback.in` as external sender — not a code issue

---

## 11. Environment Variables (Railway)

```
DATABASE_URL                 ← Railway PostgreSQL connection string
EMAIL_PROVIDER=RESEND
RESEND_API_KEY               ← Resend API key
EMAIL_FROM                   ← noreply@claimback.in or similar
ADMIN_EMAIL                  ← vishal.dubey@partnr.in
ADMIN_NAME                   ← Vishal Dubey
ADMIN_PHONE                  ← +91...
ADMIN_PASSWORD               ← login password
AUTH_SECRET                  ← JWT/session secret
CHIEF_OF_STAFF_EMAILS        ← comma-separated, CC'd on all reminders
OPENAI_API_KEY               ← GPT-4o for extraction
ANTHROPIC_API_KEY            ← Claude fallback for extraction
NEXT_PUBLIC_BASE_URL         ← https://partnr-execution-os-production.up.railway.app
INBOUND_WEBHOOK_SECRET       ← partnr-ingest-9f4b2e7a1d3c8e5f
WHATSAPP_PROVIDER            ← TWILIO or MOCK
```

---

## 12. Common Commands

```bash
npm run dev                  # local dev server
npm run db:push              # sync Prisma schema to Railway DB
npm run db:seed              # seed 20 tasks + 7 users
npm run db:reset             # wipe + re-seed
npx prisma generate          # regenerate Prisma client after schema changes
npx tsc --noEmit             # type-check before committing (always run this)
git push origin main         # triggers Railway auto-deploy
```

---

## 13. Behaviour Rules for Claude Working on This Project

- **Always push to GitHub after every task** — never wait for Vishal to ask
- **Always run `npx tsc --noEmit` before committing** — zero TypeScript errors
- **Surgical changes only** — never touch working functionality
- **Never break existing features** when fixing bugs
- After schema changes: run `db:push` + remind to restart dev server

---

## 14. Strategic Context — Where the Product Is Heading

### Current limitation
The product has **no multi-tenancy** — all tasks, users, and data are in a single shared bucket. It can only be used by one organisation (Vishal's team) right now. This means it cannot be launched as a SaaS product without architectural changes.

### The problem with adding login
Adding a login wall creates friction that kills trial conversion for a SaaS product. Standard login forms = users drop off before experiencing the value.

### Recommended path to launch

**Short term (next 3–5 pilots):**
- Clone the Railway deployment for each new pilot company (takes 2 min)
- Each gets their own isolated instance — complete data isolation, zero code changes
- Validate product-market fit, pricing, and workflows with real teams
- Do NOT build multi-tenancy yet

**Medium term (10+ paying teams):**
Build proper multi-tenancy:
1. Add `Workspace` table (`id`, `name`, `slug`, `adminEmail`, `plan`, `trialEndsAt`)
2. Add `workspaceId` FK to `Task`, `User`, `MeetingNote`, `DigestLog`, `Reminder`
3. All DB queries scoped to `workspaceId`
4. Magic link auth: email → one-time token → session cookie (no password)
5. Onboarding: one field (work email) → workspace created → magic link sent → in product in 30 seconds
6. Subdomain routing: `acme.execos.app` → workspace resolved from subdomain
7. Email ingest scoped per workspace: `tasks+acme@claimback.in` or custom domain

### Domain name shortlist
Top picks for launch:
- **`followthru.app`** — says exactly what it does
- **`closedloop.app`** — strong ops/leadership connotation
- **`chiefos.app`** — positions as Chief of Staff operating system
- Others: `execos.app`, `actionlog.app`, `loopd.app`, `runroom.app`

---

## 15. AI Extractor Logic

File: `src/lib/ai-extractor.ts`

Priority order:
1. **OpenAI GPT-4o** — primary, fastest, best extraction quality
2. **Claude sonnet-4-5** → `claude-3-5-sonnet-20241022` → `claude-3-haiku-20240307` — fallback chain
3. **Regex mock** — last resort, no API key needed

The AI prompt instructs it to:
- Extract EVERY assignment, no filtering (even "Amit to go to bed at 9 PM" gets extracted)
- Skip only: pure observations with no assignee, background context, exact duplicates
- Return clean 3–8 word titles starting with action verbs
- Resolve all relative dates to YYYY-MM-DD using meeting date as reference
- Always return `ownerEmail: ""` (AI has no contact data — backfilled from DB after extraction)

---

## 16. Email Body Cleaning (for Email Ingest)

File: `src/app/api/email-ingest/route.ts`

The `cleanEmailBody()` function strips:
- Lines starting with `>` (quoted reply text)
- `On [date] X wrote:` patterns
- `From:`, `To:`, `Cc:`, `Sent:`, `Date:` forwarding header lines
- Outlook `____` separator lines
- Signature blocks starting with `Regards,`, `Thanks,`, `Best,` etc.

---

## 17. Repository Structure (Key Files)

```
prisma/
  schema.prisma              ← Full DB schema

src/
  app/
    api/
      email-ingest/route.ts  ← NEW: inbound email → tasks
      meeting-notes/
        extract/route.ts     ← AI extraction + contact backfill
        save/route.ts        ← Save tasks + send emails + calendar
      jobs/
        daily-digest/        ← 8 AM IST digest
        process-reminders/   ← Escalation engine cron
        weekly-summary/      ← Weekly report
      tasks/[id]/            ← Task CRUD + status + comments
      webhooks/whatsapp/     ← Twilio inbound replies
    (pages)/...              ← Next.js pages

  lib/
    ai-extractor.ts          ← GPT-4o → Claude → regex
    email/index.ts           ← Resend/Gmail sender + all templates
    calendar.ts              ← ICS generator + sender
    reminder-engine.ts       ← Escalation logic L0→L1→L2
    weekly-summary.ts        ← Weekly report builder
    prisma.ts                ← Prisma client singleton

server.js                    ← Custom Node server with cron jobs
next.config.js               ← Must be .js not .ts (Next 14.2.x)
```
