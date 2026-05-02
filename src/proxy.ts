import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Edge proxy (Next.js 16+ replaces the old `middleware.ts` convention).
 * Handles role-aware redirects so server components never receive an
 * unauthenticated/unauthorised request body to render against.
 */
export default auth((req) => {
  const { nextUrl } = req;
  const isAuthed = !!req.auth?.user;
  const isAdmin = req.auth?.user?.role === "ADMIN";
  const path = nextUrl.pathname;

  const isAuthPage = path.startsWith("/sign-in") || path.startsWith("/sign-up");
  const isAdminPath = path.startsWith("/admin");
  const isProtected =
    path.startsWith("/challenges") ||
    path.startsWith("/feed") ||
    path.startsWith("/admin");

  if (isAuthPage && isAuthed) {
    return NextResponse.redirect(new URL("/challenges", nextUrl));
  }

  if (isProtected && !isAuthed) {
    const url = new URL("/sign-in", nextUrl);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  if (isAdminPath && !isAdmin) {
    return NextResponse.redirect(new URL("/challenges", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|uploads).*)"],
};
