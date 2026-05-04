/**
 * GET /api/healthz
 *
 * Liveness + readiness probe used by Railway healthchecks and uptime monitors.
 *
 * Returns 200 if:
 *   - Process is up
 *   - DB ping succeeds (SELECT 1)
 *
 * Returns 503 if any check fails. Body always includes per-check detail.
 *
 * Public endpoint — does NOT require auth. Do not include sensitive info.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const startedAt = Date.now();

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};
  let allOk = true;

  // ── DB ping ──────────────────────────────────────────────────────────
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    checks.db = {
      ok: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
    allOk = false;
  }

  const body = {
    status: allOk ? "ok" : "degraded",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
    env: process.env.NODE_ENV || "development",
    checks,
  };

  return NextResponse.json(body, { status: allOk ? 200 : 503 });
}
