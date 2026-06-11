import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Unauthorized" };

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <p className="font-jetbrains text-6xl font-bold text-muted-foreground/30 mb-4">403</p>
        <h1 className="font-playfair text-2xl font-semibold text-foreground mb-2">
          Access Denied
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          You don&apos;t have permission to access this page.
        </p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
        >
          Return to Login
        </Link>
      </div>
    </div>
  );
}
