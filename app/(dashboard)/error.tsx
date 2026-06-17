"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Always redirect to login from dashboard errors —
    // most errors here are caused by an expired/cleared session after logout.
    const timer = setTimeout(() => {
      router.replace("/login");
    }, 100);
    return () => clearTimeout(timer);
  }, [router, error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        <div className="w-12 h-12 border-4 border-foreground border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Redirecting to login…</p>
      </div>
    </div>
  );
}
