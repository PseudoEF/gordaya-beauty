import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loginSchema } from "@/lib/validators";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// In dev, req.url/req.nextUrl can resolve to the server's own bind address
// (e.g. "localhost:3210") instead of whatever host the client actually
// connected to (e.g. a LAN IP) — building a redirect from that stranded a
// phone on the same Wi-Fi at "localhost", which means the phone itself.
// The Host header always reflects what the client really requested.
function requestOrigin(req: NextRequest): string {
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// Submitted as a native HTML form (not fetch/JSON) on purpose: a real
// browser navigation guarantees the Set-Cookie from this response is
// applied before the redirect is followed. A JS fetch + separate
// client-side navigation left a window where some mobile browsers
// (observed on iOS Safari) hadn't yet persisted the cookie, bouncing the
// user straight back to the login page.
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const raw = contentType.includes("application/json")
    ? await req.json().catch(() => null)
    : Object.fromEntries((await req.formData().catch(() => new FormData())).entries());

  const parsed = loginSchema.safeParse(raw);
  const isForm = !contentType.includes("application/json");

  function fail(status: number, reason: string) {
    if (isForm) {
      return NextResponse.redirect(
        new URL(`/admin/login?error=${reason}`, requestOrigin(req)),
        { status: 303 }
      );
    }
    return NextResponse.json({ error: reason }, { status });
  }

  if (!parsed.success) {
    return fail(400, "invalid");
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return fail(500, "not_configured");
  }

  if (!safeEqual(parsed.data.password, adminPassword)) {
    return fail(401, "wrong_password");
  }

  const session = await getSession();
  session.isAdmin = true;
  await session.save();

  if (isForm) {
    return NextResponse.redirect(new URL("/admin/dashboard", requestOrigin(req)), {
      status: 303,
    });
  }
  return NextResponse.json({ ok: true });
}
