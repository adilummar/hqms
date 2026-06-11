import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

const ROLE_REDIRECT: Record<string, string> = {
  super_admin: "/admin",
  admin: "/admin",
  tutor: "/tutor",
  parent: "/parent",
  student: "/student",
};

export async function proxy(req: NextRequest) {
  const session = await auth();
  const { nextUrl } = req;
  const isLoggedIn = !!session?.user;
  const role = session?.user?.role;

  const isDashboardRoute =
    nextUrl.pathname.startsWith("/admin") ||
    nextUrl.pathname.startsWith("/tutor") ||
    nextUrl.pathname.startsWith("/parent") ||
    nextUrl.pathname.startsWith("/student");

  // Redirect unauthenticated users trying to access dashboard
  if (isDashboardRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Redirect authenticated users away from login page
  if (nextUrl.pathname === "/login" && isLoggedIn && role) {
    const destination = ROLE_REDIRECT[role] ?? "/admin";
    return NextResponse.redirect(new URL(destination, nextUrl));
  }

  // Role-based access control for dashboard routes
  if (isDashboardRoute && isLoggedIn && role) {
    if (
      nextUrl.pathname.startsWith("/admin") &&
      !["admin", "super_admin"].includes(role)
    ) {
      return NextResponse.redirect(new URL("/unauthorized", nextUrl));
    }
    if (
      nextUrl.pathname.startsWith("/tutor") &&
      !["tutor", "admin", "super_admin"].includes(role)
    ) {
      return NextResponse.redirect(new URL("/unauthorized", nextUrl));
    }
    if (nextUrl.pathname.startsWith("/parent") && role !== "parent") {
      return NextResponse.redirect(new URL("/unauthorized", nextUrl));
    }
    if (nextUrl.pathname.startsWith("/student") && role !== "student") {
      return NextResponse.redirect(new URL("/unauthorized", nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json).*)",
  ],
};
