/**
 * Sentry — server-side runtime
 *
 * Loaded by `instrumentation.ts` when running on Node (API routes, server components).
 * If SENTRY_DSN is not set, init is a no-op — safe to deploy without DSN configured.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.npm_package_version,

    // Capture 100% of errors. Sample 10% of normal traces in prod, 100% in dev.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Don't send PII (email bodies, task content) to Sentry by default.
    sendDefaultPii: false,

    // Filter out known-noisy errors.
    ignoreErrors: [
      // User-cancelled requests are normal.
      "AbortError",
      "ECONNRESET",
    ],
  });
}
