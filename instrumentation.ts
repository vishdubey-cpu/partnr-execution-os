/**
 * Next.js instrumentation hook
 *
 * Runs once at server startup. Loads Sentry's server/edge configs so errors
 * thrown anywhere in the app are captured.
 *
 * If SENTRY_DSN is not set, the configs are no-ops (see sentry.*.config.ts).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Forwards request errors to Sentry.
 * Available in Next.js 15+, but defining it now keeps us forward-compatible.
 */
export async function onRequestError(...args: unknown[]) {
  const Sentry = await import("@sentry/nextjs");
  // @ts-expect-error — captureRequestError signature varies across Sentry versions
  Sentry.captureRequestError?.(...args);
}
