"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // If the error looks like an auth/session error, redirect to login
    const msg = error?.message?.toLowerCase() ?? "";
    const digest = error?.digest?.toLowerCase() ?? "";
    const isAuthError =
      msg.includes("unauthorized") ||
      msg.includes("unauthenticated") ||
      msg.includes("session") ||
      msg.includes("redirect") ||
      digest.includes("redirect");

    if (isAuthError) {
      router.replace("/login");
    }
  }, [error, router]);

  return (
    <html>
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fafafa",
          color: "#111",
          padding: "2rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
            {error?.message || "An unexpected error occurred."}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={() => router.replace("/login")}
              style={{
                padding: "0.5rem 1.25rem",
                background: "#111",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Go to Login
            </button>
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1.25rem",
                background: "transparent",
                color: "#111",
                border: "1px solid #ddd",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
