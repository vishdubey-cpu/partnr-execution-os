/**
 * Sentry — browser-side runtime
 *
 * Loaded automatically by Next.js when running in the browser.
 * Uses NEXT_PUBLIC_SENTRY_DSN so the DSN is exposed to the client bundle.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",

    // Lower sample rate on client to keep quota-friendly.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    sendDefaultPii: false,
  });
}
