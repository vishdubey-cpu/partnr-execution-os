import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public paths — no login required
const PUBLIC_PREFIXES = [
  "/login",
  "/task-view",
  "/api/",        // all API routes — pages are protected, server components need cookie-free access
  "/_next",
  "/favicon.ico",
];

async function computeToken(password: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(password));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.cookies.get("session")?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const password = process.env.ADMIN_PASSWORD || "";
  const secret = process.env.AUTH_SECRET || "partnr-internal-secret";
  const expected = await computeToken(password, secret);

  if (session !== expected) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete("session");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
