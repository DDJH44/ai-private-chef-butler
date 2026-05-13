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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtected) {
    const authCookie = request.cookies.get("auth_status");
    if (!authCookie || authCookie.value !== "1") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect logged-in users away from login/register
  if (pathname === "/login" || pathname === "/register") {
    const authCookie = request.cookies.get("auth_status");
    if (authCookie?.value === "1") {
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
