/**
 * Sentry — edge runtime
 *
 * Loaded by `instrumentation.ts` when running in middleware or edge routes.
 * Currently we don't use edge runtime, but Next.js requires this file when @sentry/nextjs is wired up.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
  });
}
