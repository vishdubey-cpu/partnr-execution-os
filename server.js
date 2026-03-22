const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const cron = require("node-cron");

const dev = process.env.NODE_ENV !== "production";
const port = process.env.PORT || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

async function triggerDailyDigest(reason) {
  console.log(`[Digest] Triggering daily digest — reason: ${reason}`);
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${port}`;
    const res = await fetch(`${baseUrl}/api/jobs/daily-digest`);
    const text = await res.text();
    if (res.ok) {
      console.log("[Digest] API response:", text);
    } else {
      console.error(`[Digest] API returned ${res.status}:`, text);
    }
  } catch (e) {
    console.error("[Digest] Fetch failed:", e.message);
  }
  // NOTE: No file-based dedup here — the API route handles dedup via DigestLog DB table.
  // The DB persists across Railway restarts, so it is the single source of truth.
}

app.prepare().then(() => {
  // Daily digest: 8:00 AM IST = 2:30 AM UTC
  cron.schedule("30 2 * * *", () => {
    triggerDailyDigest("scheduled cron 2:30 AM UTC");
  }, { timezone: "UTC" });

  console.log("[Cron] Daily digest scheduled: 8:00 AM IST (2:30 AM UTC) every day");

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on port ${port}`);

    // Startup catch-up: ONLY fire if server starts within the 30-minute window
    // after 2:30 AM UTC (i.e., between 2:30–3:00 AM UTC).
    // This covers Railway restarts right around the scheduled time.
    // Outside this window, we do nothing — the DB dedup handles any stray calls.
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin  = now.getUTCMinutes();
    const inCatchUpWindow = utcHour === 2 && utcMin >= 30 && utcMin <= 59;

    if (inCatchUpWindow) {
      console.log(`[Digest] Server started at ${now.toUTCString()} — within catch-up window (2:30–3:00 AM UTC). Firing in 15s...`);
      setTimeout(() => triggerDailyDigest("startup catch-up (2:30–3:00 AM UTC window)"), 15000);
    } else {
      console.log(`[Digest] Server started at ${now.toUTCString()} — outside catch-up window, no startup send.`);
    }
  });
});
