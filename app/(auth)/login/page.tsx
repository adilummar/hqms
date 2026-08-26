import { LoginForm } from "@/components/auth/login-form";
import type { Metadata } from "next";
import { Shield } from "lucide-react";
import { MicLogo } from "@/components/ui/mic-logo";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to MIC — Thahfeezul Qur'an College",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* ── Left Panel — Brand ────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] xl:w-[480px] flex-shrink-0 bg-[#0F172A] p-10 relative overflow-hidden">
        {/* Subtle radial glow */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 30% 20%, rgba(20,184,166,0.12) 0%, transparent 70%)",
          }}
        />
        {/* Grid pattern */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 flex items-center justify-center">
              <MicLogo className="w-10 h-10" />
            </div>
            <div>
              <p className="font-inter text-xl font-bold text-white tracking-tight leading-none">MIC</p>
              <p className="text-[11px] text-white/35 font-dm-sans tracking-widest uppercase mt-0.5">Thahfeezul Qur'an College</p>
            </div>
          </div>

          {/* Headline */}
          <h1 className="font-inter text-4xl xl:text-5xl font-bold text-white leading-[1.1] tracking-tight">
            Manage your
            <br />
            <span className="text-teal">Quran journey.</span>
          </h1>
          <p className="text-white/45 text-[15px] font-dm-sans mt-5 leading-relaxed max-w-sm">
            Track Hifz progress, attendance, admissions, and student milestones — all in one place.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-4">
          {[
            "Hifz progress tracking by Juz & Surah",
            "Attendance & leave management",
            "Admissions & parent communication",
            "Role-based access for staff & parents",
          ].map((feat) => (
            <div key={feat} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-teal/20 flex items-center justify-center flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-teal" />
              </div>
              <p className="text-[13px] text-white/55 font-dm-sans">{feat}</p>
            </div>
          ))}
        </div>

        {/* Bottom trust badge */}
        <div className="relative z-10 flex items-center gap-2 pt-6 border-t border-white/[0.08]">
          <Shield size={13} className="text-white/25" />
          <p className="text-[11px] text-white/25 font-dm-sans">Secure, role-based access control</p>
        </div>
      </div>

      {/* ── Right Panel — Form ────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        {/* Mobile logo — only visible below lg */}
        <div className="lg:hidden mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <MicLogo className="w-10 h-10" />
            </div>
            <p className="font-inter text-2xl font-bold text-foreground tracking-tight">MIC</p>
          </div>
          <p className="text-[13px] text-muted-foreground font-dm-sans">Thahfeezul Qur'an College</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-[400px]">
          {/* Heading */}
          <div className="mb-7">
            <h2 className="font-inter text-[26px] font-bold text-foreground tracking-tight leading-tight">
              Welcome
            </h2>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-7">
            <LoginForm />
          </div>

          {/* Help text */}
          <p className="text-center text-[12px] text-muted-foreground mt-5 font-dm-sans">
            Forgot your password? Contact your administrator
          </p>
        </div>
      </div>
    </div>
  );
}
