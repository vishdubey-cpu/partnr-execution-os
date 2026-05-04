/**
 * Structured logger
 *
 * Wraps pino with sensible defaults for Next.js + Railway:
 * - Production: single-line JSON (Railway log explorer parses this)
 * - Development: pretty-printed colourised output
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ taskId, provider: "RESEND" }, "email sent");
 *   logger.error({ err, taskId }, "email failed");
 *
 * Always pass structured fields as the first arg (object), then the message.
 * Never interpolate variables into the message — log them as fields.
 */

import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

export const logger = pino({
  level,
  base: {
    env: process.env.NODE_ENV || "development",
    service: "partnr-execution-os",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // In production, output raw JSON. In dev, pretty-print.
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss",
            ignore: "pid,hostname,service,env",
          },
        },
      }),
});

/**
 * Create a child logger bound to a context (request, job, workspace).
 * Useful for adding workspaceId/requestId/jobId to every log line in a handler.
 *
 * Example:
 *   const log = childLogger({ route: "email-ingest", from });
 *   log.info({ subject }, "received email");
 *   log.warn({ skipped: true }, "body too short");
 */
export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
