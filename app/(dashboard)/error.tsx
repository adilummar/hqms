"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";

// DB connection error codes from pg / node
const DB_ERROR_CODES = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "connection"];

function isDbError(msg: string) {
  return DB_ERROR_CODES.some((code) => msg.toUpperCase().includes(code.toUpperCase()));
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const isConnection = isDbError(error.message ?? "");

  useEffect(() => {
    // Only auto-redirect for session/auth errors, NOT for DB errors
    if (!isConnection) {
      const timer = setTimeout(() => {
        router.replace("/login");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [router, error, isConnection]);

  // DB / connection error — show retry UI
  if (isConnection) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-5 p-8 max-w-sm">
          <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Connection Problem</h2>
            <p className="text-sm text-muted-foreground">
              Could not reach the database. This sometimes happens on the Supabase free tier.
              Please wait a moment and try again.
            </p>
          </div>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Auth / session error — redirect to login
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
          <LogIn className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Redirecting to login…</p>
      </div>
    </div>
  );
}
