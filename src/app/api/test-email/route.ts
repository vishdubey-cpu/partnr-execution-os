import { NextResponse } from "next/server";

/**
 * GET /api/test-email?to=someone@example.com
 *
 * Sends a test email and returns the Resend response body (including the
 * email ID you can look up in the Resend dashboard).
 * Use this to verify delivery is working for any recipient address.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to");

  if (!to) {
    return NextResponse.json({ error: "Pass ?to=email@example.com" }, { status: 400 });
  }

  const emailProvider = process.env.EMAIL_PROVIDER?.toUpperCase();
  const provider =
    emailProvider === "GMAIL" && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
      ? "GMAIL"
      : emailProvider === "RESEND" && process.env.RESEND_API_KEY
      ? "RESEND"
      : "MOCK";

  if (provider === "MOCK") {
    return NextResponse.json({
      provider: "MOCK",
      note: "No EMAIL_PROVIDER configured. Set EMAIL_PROVIDER=RESEND + RESEND_API_KEY in Railway env vars.",
    });
  }

  if (provider === "RESEND") {
    const from = process.env.EMAIL_FROM || "Partnr OS <noreply@partnr.app>";
    const body = JSON.stringify({
      from,
      to,
      subject: "✅ Partnr test email — delivery check",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="color:#4F46E5;">Test email received ✅</h2>
          <p>If you're reading this, email delivery to <strong>${to}</strong> is working correctly.</p>
          <p style="color:#888;font-size:12px;">Sent via Resend · from: ${from} · Partnr Execution OS</p>
        </div>`,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body,
    });

    const resBody = await res.json().catch(() => ({}));

    return NextResponse.json({
      provider: "RESEND",
      from,
      to,
      status: res.status,
      ok: res.ok,
      resend_response: resBody,
      // If ok=true but email doesn't arrive:
      // 1. Check Resend dashboard → Emails → find this ID → see delivery status
      // 2. Likely cause: sending domain not verified OR recipient address blocked
      // Fix: Go to resend.com → Domains → verify your domain
      diagnosis: res.ok
        ? `Resend accepted the request (id=${resBody.id}). If email doesn't arrive: open resend.com/emails, find id=${resBody.id}, check delivery status. Most common cause: domain not verified — go to resend.com/domains.`
        : `Resend REJECTED the request: ${JSON.stringify(resBody)}. Fix the API key or from-address.`,
    });
  }

  // Gmail
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  await transporter.sendMail({
    from: `Partnr Reminders <${process.env.GMAIL_USER}>`,
    to,
    subject: "✅ Partnr test email — delivery check",
    html: `<p>Test email delivered successfully to ${to}.</p>`,
  });
  return NextResponse.json({ provider: "GMAIL", to, sent: true });
}
