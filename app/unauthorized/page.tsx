import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";

export const metadata: Metadata = { title: "Unauthorized" };

export default async function UnauthorizedPage() {
  const session = await auth();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <p className="font-jetbrains text-6xl font-bold text-muted-foreground/30 mb-4">403</p>
        <h1 className="font-playfair text-2xl font-semibold text-foreground mb-2">
          Access Denied
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          You don&apos;t have permission to access this page.
          <br />
          <span className="text-xs opacity-50">Debug Role: {session?.user?.role || "no role"}</span>
        </p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:bg-primary/90 transition-colors"
        >
          Return to Login
        </Link>
      </div>
    </div>
  );
}
