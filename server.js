const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const cron = require("node-cron");

const dev = process.env.NODE_ENV !== "production";
const port = process.env.PORT || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

// Track which UTC dates the digest has been sent in this process run
const digestSentDates = new Set();

async function triggerDailyDigest(reason) {
  const todayUTC = new Date().toISOString().split("T")[0];
  if (digestSentDates.has(todayUTC)) {
    console.log(`[Digest] Already sent today (${todayUTC}), skipping (${reason})`);
    return;
  }
  digestSentDates.add(todayUTC);
  console.log(`[Digest] Triggering daily digest — reason: ${reason}`);
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${port}`;
    const res = await fetch(`${baseUrl}/api/jobs/daily-digest`);
    const text = await res.text();
    console.log("[Digest] Result:", text);
  } catch (e) {
    // Remove from set so a retry is possible next cron tick
    digestSentDates.delete(todayUTC);
    console.error("[Digest] Failed:", e);
  }
}

app.prepare().then(() => {
  // Daily digest at 8:00 AM IST = 2:30 AM UTC, every day
  cron.schedule("30 2 * * *", () => {
    triggerDailyDigest("scheduled cron");
  }, { timezone: "UTC" });

  console.log("[Cron] Daily digest scheduled for 8:00 AM IST (2:30 AM UTC) every day");

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on port ${port}`);

    // ── Startup catch-up ────────────────────────────────────────────
    // If the server restarted after 2:30 AM UTC and the digest hasn't
    // been sent yet in this process, fire it now (with a 20s delay so
    // Next.js API routes are ready to handle the request).
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    const isPastScheduled = utcHour > 2 || (utcHour === 2 && utcMin >= 30);
    // Only catch up within a 22-hour window (2:30 AM → 00:30 AM next day)
    const isWithinWindow = isPastScheduled && utcHour < 24;

    if (isWithinWindow) {
      console.log(`[Digest] Server started at ${now.toUTCString()} — past 2:30 AM UTC. Scheduling catch-up in 20s.`);
      setTimeout(() => triggerDailyDigest("startup catch-up"), 20000);
    }
  });
});
