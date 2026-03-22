const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const port = process.env.PORT || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

// File-based dedup: persists across process crashes/restarts within same deployment
const DIGEST_LOG = path.join(__dirname, ".digest-sent");

function getLastDigestDate() {
  try { return fs.readFileSync(DIGEST_LOG, "utf8").trim(); }
  catch { return ""; }
}

function markDigestSent(dateStr) {
  try { fs.writeFileSync(DIGEST_LOG, dateStr, "utf8"); }
  catch (e) { console.error("[Digest] Could not write dedup file:", e.message); }
}

async function triggerDailyDigest(reason) {
  const todayUTC = new Date().toISOString().split("T")[0];

  // Skip if already sent today (file-based persistence — survives process restarts)
  if (getLastDigestDate() === todayUTC) {
    console.log(`[Digest] Already sent for ${todayUTC}, skipping (${reason})`);
    return;
  }

  console.log(`[Digest] Sending daily digest — reason: ${reason}`);
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${port}`;
    const res = await fetch(`${baseUrl}/api/jobs/daily-digest`);
    const text = await res.text();

    if (res.ok) {
      markDigestSent(todayUTC); // Only mark sent if HTTP call succeeded
      console.log("[Digest] Sent successfully:", text);
    } else {
      console.error(`[Digest] API returned ${res.status}:`, text);
    }
  } catch (e) {
    console.error("[Digest] Fetch failed:", e.message);
    // Do NOT mark as sent — next cron tick will retry
  }
}

app.prepare().then(() => {
  // Daily digest at 8:00 AM IST = 2:30 AM UTC every day
  cron.schedule("30 2 * * *", () => {
    triggerDailyDigest("scheduled cron 2:30 AM UTC");
  }, { timezone: "UTC" });

  // Safety net: also check every 15 minutes between 2:25–3:00 AM UTC
  // Handles edge case where the server starts exactly at the cron boundary
  cron.schedule("25,40,55 2 * * *", () => {
    triggerDailyDigest("safety-net cron window");
  }, { timezone: "UTC" });

  console.log("[Cron] Daily digest scheduled for 8:00 AM IST (2:30 AM UTC) every day");

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on port ${port}`);

    // ── Startup catch-up ────────────────────────────────────────────────
    // If Railway restarted the server after 2:30 AM UTC, fire digest now.
    // File-based dedup ensures this only sends once even if server crashes
    // and restarts multiple times in a day.
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin  = now.getUTCMinutes();
    const isPastWindow = utcHour > 2 || (utcHour === 2 && utcMin >= 30);

    if (isPastWindow) {
      const todayUTC = now.toISOString().split("T")[0];
      console.log(`[Digest] Server started at ${now.toUTCString()} — past 2:30 AM UTC.`);
      if (getLastDigestDate() === todayUTC) {
        console.log("[Digest] Catch-up skipped — already sent today.");
      } else {
        console.log("[Digest] Scheduling catch-up in 20s...");
        setTimeout(() => triggerDailyDigest("startup catch-up"), 20000);
      }
    }
  });
});
