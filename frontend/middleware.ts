import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = [
  "/profile",
  "/preferences",
  "/history",
  "/shopping-list",
  "/fridge",
  "/recipes",
  "/meal-plan",
  "/nutrition",
];

function isValidJwtPayload(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    // Decode the payload (middle part) without verifying signature
    // Full signature verification happens on backend API calls
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0))
      )
    );
    if (!payload.sub || !payload.exp) return false;
    // Check expiry (exp is in seconds since epoch)
    if (Date.now() >= payload.exp * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtected) {
    const authToken = request.cookies.get("auth_token");
    if (!authToken?.value || !isValidJwtPayload(authToken.value)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      loginUrl.searchParams.set("reason", "unauthorized");
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect logged-in users away from login/register
  if (pathname === "/login" || pathname === "/register") {
    const authToken = request.cookies.get("auth_token");
    if (authToken?.value && isValidJwtPayload(authToken.value)) {
      return NextResponse.redirect(new URL("/profile", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)",
  ],
};
