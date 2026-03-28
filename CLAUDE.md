# Partnr Execution OS — Project Brief for Claude

## What This Is
Internal task tracking + follow-through system for leadership decisions.
Stack: Next.js 14 App Router, Prisma ORM, PostgreSQL (Railway), Tailwind CSS.
Hosted on Railway. GitHub: `vishdubey-cpu/partnr-execution-os`

---

## Behaviour Rules
- **Always push to GitHub after every task** — never wait for user instruction
- Never break existing functionality when fixing bugs — surgical changes only
- Always run `npx tsc --noEmit` before committing

---

## Environment (Railway has real values; local .env is minimal)
```
DATABASE_URL=postgresql://...railway...   ← Railway PostgreSQL
EMAIL_PROVIDER=RESEND
RESEND_API_KEY=...
EMAIL_FROM=...@claimback.in              ← verified sending domain is claimback.in
ADMIN_EMAIL=...
ADMIN_NAME=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_BASE_URL=https://...railway...
```

---

## Key Architecture

### Database (prisma/schema.prisma)
- **Task** — title, owner, ownerPhone, ownerEmail, function, priority, dueDate, status, escalationLevel, source
- **Activity** — audit log per task
- **Reminder** — every email/WhatsApp sent, with status SENT/FAILED + metadata (error). Also used for CALENDAR_INVITE tracking.
- **MeetingNote** — raw notes + extracted JSON
- **User** — name, phone, role, function (NOTE: no email field — emails stored on Task records)
- **DigestLog** — date (YYYY-MM-DD IST, unique) — DB-level dedup for daily digest

### Email (src/lib/email/index.ts)
- Provider: RESEND (primary), GMAIL fallback, MOCK
- `sendEmail()` — generic send with CC to Chief of Staff
- `sendEmailReminder()` — typed reminder (task_assigned, due_in_2_days, overdue_1_day, escalated_*, etc.) — logs to Reminder table with SENT/FAILED + Resend ID
- `sendDailyDigest()` — rich HTML digest with scorecard, overdue list, people section

### Calendar Invites (src/lib/calendar.ts)
- `generateICS()` — creates .ics file; timed 1-hour event if `startTime` (HH:MM) provided, all-day otherwise
- `sendCalendarInvite()` — sends via Resend/Gmail with .ics attachment; CC's extra attendees; logs to Reminder table as CALENDAR_INVITE

### AI Extraction (src/lib/ai-extractor.ts)
- Priority order: OpenAI GPT-4o → Claude (sonnet-4-5 → 3-5-sonnet → haiku) → regex mock
- Always returns `ownerEmail: ""` — contact backfill happens in the extract API route

### Extract API (src/app/api/meeting-notes/extract/route.ts)
- After AI extraction: queries Task table to backfill ownerPhone + ownerEmail for known owners
- Single DB query, only fills blank fields — never overwrites AI data

### Daily Digest (server.js + src/app/api/jobs/daily-digest/route.ts)
- Cron: `30 2 * * *` UTC = 8:00 AM IST
- Startup catch-up: ONLY fires if server starts between 2:30–3:00 AM UTC (narrow window)
- DB dedup: DigestLog table prevents duplicate sends across Railway restarts (file-based dedup was wiped on every restart — that was the spam bug)
- Force override: `GET /api/jobs/daily-digest?force=1`

---

## API Endpoints
| Endpoint | Purpose |
|---|---|
| `GET /api/dashboard` | stats, ownerStats, recentReminders, needsEscalation |
| `POST /api/tasks` | create task |
| `GET/PUT/DELETE /api/tasks/[id]` | task CRUD |
| `POST /api/tasks/[id]/comments` | add comment |
| `POST /api/tasks/[id]/status` | update status |
| `GET /api/overdue` | overdue tasks with filters |
| `GET /api/weekly-review` | weekly summary data |
| `POST /api/webhooks/whatsapp` | Twilio inbound (DONE/DELAYED/NEED HELP) |
| `POST /api/jobs/process-reminders` | cron, idempotent reminder engine |
| `GET /api/jobs/daily-digest` | send daily digest (supports ?force=1) |
| `GET /api/jobs/weekly-summary` | weekly summary send |
| `POST /api/meeting-notes/extract` | AI extraction + contact backfill |
| `POST /api/meeting-notes/save` | save tasks + send assignment emails + calendar invites |
| `POST /api/email-ingest` | inbound email → auto-extract + create tasks (Resend webhook or Apps Script) |
| `GET /api/test-email?to=email` | debug endpoint — test Resend delivery, returns email ID |

---

## Pages
- `/` (Home) — notes capture box → redirects to /meeting-notes via sessionStorage
- `/meeting-notes` — full extraction UI with rich task cards, calendar invite panel
- `/dashboard` — stats, needs-attention list
- `/tasks` — all tasks
- `/task-view/[id]` — task detail with status update, comments, reminder history
- `/overdue` — overdue tasks
- `/my-tasks/[owner]` — per-person task list
- `/weekly-review` — weekly summary

---

## Known Issues / Decisions Made

### Email
- Sending domain: `claimback.in` (verified on Resend) — NOT partnr.in
- `first@partnr.in` is a group email (8 members). Resend delivers to group; mail server distributes internally.
- If group email doesn't receive: check if `partnr.in` mail server whitelists external senders. Not a code issue.
- All Resend sends now log the email ID: `[Email RESEND] Accepted | id=re_xxx | to=...`
- Calendar invite extra attendees: now CC'd on the actual email (was listed in ICS only — bug fixed)

### Calendar Invites
- Bug fixed: Resend response was not checked (result discarded) — now properly awaited
- Bug fixed: attachment missing `content_type: "text/calendar; method=REQUEST"` — added
- Bug fixed: extra attendees listed in ICS but not emailed — now CC'd
- All calendar invite sends logged to Reminder table as CALENDAR_INVITE type

### Daily Digest Spam (fixed)
- Root cause: Railway filesystem is ephemeral — `.digest-sent` file wiped on every restart
- Fix: DigestLog DB table is the single source of truth for dedup
- Safety net crons removed (were causing 3 extra sends)
- Startup catch-up restricted to 2:30–3:00 AM UTC window only

### Owner Contact Auto-fill (fixed)
- AI always returns `ownerEmail: ""` — this is correct (AI has no contact data)
- After extraction, extract route queries most recent Task per owner name and backfills phone/email
- First time an owner is assigned → fill manually once → auto-filled forever after

### Meeting Notes UI
- Rich task cards: AI description (indigo strip), source quote, priority/function badges, confidence %
- Calendar invite panel: toggle, time picker (HH:MM, defaults 10:00), extra attendees
- Home page redirect: sessionStorage key `pendingNotes` → auto-extracts on /meeting-notes load

---

## Common Commands
```bash
npm run dev                  # local dev
npm run db:push              # sync schema to Railway DB
npm run db:seed              # seed 20 tasks + 7 users
npx prisma generate          # after schema changes (also runs in build now)
git add ... && git commit && git push origin main   # deploy to Railway
```

## Email Ingest (zero-friction MoM → tasks)

### How it works
Forward or BCC any MoM email to `tasks@claimback.in` → tasks auto-created → confirmation email sent to admin.

### Setup: Resend Inbound
1. Resend Dashboard → Inbound → Add domain route
2. Email address: `tasks@claimback.in`
3. Webhook URL: `https://[railway-url]/api/email-ingest?secret=YOUR_SECRET`
4. Add `INBOUND_WEBHOOK_SECRET=YOUR_SECRET` to Railway env vars
5. Add Resend's MX record for `claimback.in` (if no existing MX conflicts)

### Alternative: Google Apps Script (no MX change needed)
1. In Gmail, create a label: **MOM**
2. Create a Gmail filter: subject contains "MOM" → apply label "MOM" (or manually label emails)
3. Open script.google.com → New project → paste the script below → set webhook URL + secret → save
4. Add a time-driven trigger: run `processNewMoMEmails` every 15 minutes

```javascript
function processNewMoMEmails() {
  const WEBHOOK_URL = "https://YOUR-RAILWAY-URL/api/email-ingest";
  const SECRET     = "YOUR_INBOUND_WEBHOOK_SECRET";
  const label = GmailApp.getUserLabelByName("MOM");
  if (!label) { Logger.log("Label 'MOM' not found"); return; }
  const threads = label.getThreads(0, 20);
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      if (!msg.isUnread()) continue;
      const payload = {
        subject: msg.getSubject(),
        text:    msg.getPlainBody(),
        from:    msg.getFrom(),
        date:    msg.getDate().toISOString(),
      };
      UrlFetchApp.fetch(WEBHOOK_URL + "?secret=" + SECRET, {
        method: "post", contentType: "application/json",
        payload: JSON.stringify(payload), muteHttpExceptions: true,
      });
      msg.markRead();
    }
  }
}
```

### Security
- Set `INBOUND_WEBHOOK_SECRET` in Railway env vars
- Pass as `?secret=` query param or `Authorization: Bearer` header

## Gotchas
- `build` script is `prisma generate && next build` — required so Railway gets updated Prisma client
- After schema changes: `npm run db:push` syncs to Railway DB (uses .env DATABASE_URL which points to Railway)
- User model has NO email field — owner emails live on Task.ownerEmail
- Reminder table requires taskId — can't store digest logs there (use DigestLog table)
- next.config.js (not .ts) — Next.js 14.2.x doesn't support TS config
