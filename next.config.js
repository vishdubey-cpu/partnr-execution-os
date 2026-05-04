// IMPORTANT: This file MUST stay as `.js` — Next.js 14.2.x does not support
// TypeScript config files. Do not migrate to next.config.ts.

const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
    // Required for Sentry to find instrumentation.ts in Next 14
    instrumentationHook: true,
  },
};

// Wrap config with Sentry. If SENTRY_AUTH_TOKEN is not set, source-map upload
// is skipped — runtime error capture still works without it.
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN, // suppress "no auth token" warnings in CI
  widenClientFileUpload: false,
  hideSourceMaps: true,
  disableLogger: true,
};

module.exports = process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
