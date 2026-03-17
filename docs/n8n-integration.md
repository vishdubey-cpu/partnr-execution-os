# n8n Integration Guide — Partnr Execution OS

This document explains how to wire up n8n to automate reminders, escalations, and weekly summaries.

---

## 1. Reminder Processing (Daily Cron)

### Endpoint
```
POST /api/jobs/process-reminders
```

### What it does
- Scans all active tasks (OPEN / DELAYED)
- Sends WhatsApp reminders based on due-date proximity
- Escalates overdue tasks to manager / admin
- Deduplicates — safe to run multiple times per day

### n8n Setup

1. Add a **Schedule Trigger** node → Every day at 9:00 AM
2. Add an **HTTP Request** node:
   - Method: `POST`
   - URL: `http://your-domain.com/api/jobs/process-reminders`
   - Headers: `x-job-secret: YOUR_REMINDER_JOB_SECRET` (if configured)
3. Optionally add a **Slack / Email** node to notify on errors

### Sample Response
```json
{
  "ok": true,
  "tasks_checked": 12,
  "reminders_sent": 4,
  "escalations_sent": 1,
  "errors": [],
  "detail": [
    "[due_in_2_days] Finalize Q2 hiring → Priya Sharma",
    "[overdue_1_day] Submit pricing deck → Arjun Patel",
    "[escalated_to_manager] Conduct P&L review → Kabir Singh"
  ]
}
```

### Retry Strategy
- If the response status is not 200, retry after 30 minutes
- Max 3 retries per day
- Log all failures to a Google Sheet or Slack channel

---

## 2. Weekly Summary (Monday 8 AM)

### Endpoint
```
GET /api/jobs/weekly-summary
```

### What it does
- Returns a complete weekly review JSON
- Includes `whatsappSummaryText` — pre-formatted message ready to send

### n8n Setup

1. Add a **Schedule Trigger** → Every Monday at 8:00 AM
2. Add an **HTTP Request** node:
   - Method: `GET`
   - URL: `http://your-domain.com/api/jobs/weekly-summary`
3. Add a **Function** node to extract `body.whatsappSummaryText`
4. Add a **Twilio** or **WhatsApp Business** node to send the summary to CEO/leadership group

### Sample Response (abbreviated)
```json
{
  "periodStart": "2026-03-16T00:00:00.000Z",
  "periodEnd": "2026-03-22T23:59:59.999Z",
  "summary": {
    "totalTasks": 20,
    "tasksCreatedThisWeek": 2,
    "tasksClosedThisWeek": 1,
    "overdueTasks": 7,
    "onTimeClosureRate": 25,
    "escalationsThisWeek": 2
  },
  "topPerformers": [
    { "owner": "Arjun Patel", "function": "Sales", "closureRate": 33 }
  ],
  "attentionNeededOwners": [
    { "owner": "Priya Sharma", "overdue": 2, "closureRate": 20 }
  ],
  "whatsappSummaryText": "*Partnr Execution OS — Weekly Summary*\n_16 Mar – 22 Mar 2026_\n..."
}
```

---

## 3. WhatsApp Inbound Webhook

### Endpoint
```
POST /api/webhooks/whatsapp
```

### Twilio Configuration

In your Twilio Console:
1. Go to **Messaging → WhatsApp Sandbox** (or your approved sender)
2. Set **When a message comes in** to:
   `https://your-domain.com/api/webhooks/whatsapp`
3. Method: `HTTP POST`

### Supported Reply Commands

| Reply Text | Action |
|------------|--------|
| `DONE` | Marks the task as Done, logs activity |
| `DELAYED` | Marks task as Delayed, sends follow-up asking for revised date |
| `NEED HELP` | Keeps task open, escalates to manager |

### How Task Matching Works
The webhook matches the sender's phone number to the most recent active task (OPEN / DELAYED / OVERDUE) assigned to that owner.

### Inbound Payload (from Twilio)
```
POST /api/webhooks/whatsapp
Content-Type: application/x-www-form-urlencoded

AccountSid=ACxxxxx&From=whatsapp%3A%2B919876543212&Body=DONE&...
```

### Mock/Test Payload (for local testing)
```json
POST /api/webhooks/whatsapp
Content-Type: application/json

{
  "from": "+919876543212",
  "body": "DONE"
}
```

### Sample Response
```json
{
  "received": true,
  "action": "marked_done",
  "taskId": "cm1abc123"
}
```

---

## 4. Idempotency

- The reminder engine checks `Reminder` table for same `(taskId, type, date)` before sending
- Safe to call `process-reminders` multiple times per day — no duplicate messages
- Weekly summary is read-only — safe to call any number of times

---

## 5. Polling Schedule Recommendations

| Job | Schedule | Notes |
|-----|----------|-------|
| `process-reminders` | Daily 9:00 AM | Can also run at 6 PM for evening nudge |
| `weekly-summary` | Monday 8:00 AM | Send to leadership WhatsApp group |
| Health check | Every 5 min | `GET /api/jobs/process-reminders` returns `{status: "ready"}` |

---

## 6. Environment Variables Required

| Variable | Description |
|----------|-------------|
| `WHATSAPP_PROVIDER` | `MOCK` or `TWILIO` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | Sender number e.g. `whatsapp:+14155238886` |
| `AI_PROVIDER` | `MOCK` or `OPENAI` |
| `OPENAI_API_KEY` | Required if `AI_PROVIDER=OPENAI` |
| `ADMIN_NAME` | Name for Level-2 escalation recipient |
| `ADMIN_PHONE` | Phone for Level-2 escalation |
| `REMINDER_JOB_SECRET` | Optional auth header value for job endpoints |
| `NEXT_PUBLIC_BASE_URL` | App base URL |
