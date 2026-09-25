import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The web dashboard has no login of its own (the MAX bot is the only part
// with per-employee access control, via phone-number verification), so
// without this, anyone who finds the site's URL can see every house,
// employee's name/phone, and work record. This puts one shared
// username/password in front of the whole site with plain HTTP Basic
// Auth — simple, no new dependencies, and the browser remembers it for the
// rest of the visit.
//
// Credentials live only in the DASHBOARD_USERNAME/DASHBOARD_PASSWORD env
// vars (set in Timeweb, never committed to git — same pattern as
// DB_PASSWORD/MAX_BOT_TOKEN). If they aren't set, requests are allowed
// through rather than locking everyone out by mistake — but they should
// always be set on the deployed app.
//
// The MAX-bot webhook and the one-off admin seed endpoint are deliberately
// left out of this (see the matcher below): MAX's own servers call the
// webhook directly and can't supply this password, and the seed endpoint
// already checks its own secret.
export function proxy(request: NextRequest) {
  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;

  if (!username || !password) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
    const separatorIndex = decoded.indexOf(":");
    const providedUser = decoded.slice(0, separatorIndex);
    const providedPass = decoded.slice(separatorIndex + 1);

    if (providedUser === username && providedPass === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Требуется авторизация.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="L-City"' },
  });
}

export const config = {
  matcher: [
    "/((?!api/max-webhook|api/admin/seed|_next/static|_next/image|favicon.ico).*)",
  ],
};
