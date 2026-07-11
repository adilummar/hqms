import { LoginForm } from "@/components/auth/login-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to HQMS — Hifzul Quran Management System",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Branding */}
        <div className="text-center mb-10">
          <h1 className="font-playfair text-5xl font-bold tracking-tight text-foreground mb-2">
            HQMS
          </h1>
          <p className="text-sm text-muted-foreground font-dm-sans tracking-wide">
            Hifzul Quran Management System
          </p>
          <div className="mt-4 mx-auto w-12 h-px bg-border" />
        </div>

        {/* Login Card */}
        <div className="bg-card border border-border rounded-lg p-8 shadow-none">
          <div className="mb-6">
            <h2 className="font-playfair text-xl font-semibold text-foreground">
              Sign In
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your credentials to access your dashboard
            </p>
          </div>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Contact your administrator to reset your password
        </p>

        {/* Parent login hint */}
        <div className="mt-4 bg-muted/50 border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground/70">Parents</p>
          <p>Username → <span className="font-jetbrains">Admission Number</span> (e.g. 150)</p>
          <p>Password → <span className="font-jetbrains">Mobile Number</span></p>
        </div>
      </div>
    </div>

  );
}
