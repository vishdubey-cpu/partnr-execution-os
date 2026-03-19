const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const cron = require("node-cron");

const dev = process.env.NODE_ENV !== "production";
const port = process.env.PORT || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Daily digest at 8:00 AM IST = 2:30 AM UTC, every day
  cron.schedule("30 2 * * *", async () => {
    console.log("[Cron] Triggering daily digest...");
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${port}`;
      const res = await fetch(`${baseUrl}/api/jobs/daily-digest`);
      const text = await res.text();
      console.log("[Cron] Daily digest result:", text);
    } catch (e) {
      console.error("[Cron] Daily digest failed:", e);
    }
  }, { timezone: "UTC" });

  console.log("[Cron] Daily digest scheduled for 8:00 AM IST (2:30 AM UTC) every day");

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on port ${port}`);
  });
});
