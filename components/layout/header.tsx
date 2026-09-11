"use client";

import { Bell, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/notification-bell";

interface HeaderProps {
  username: string;
  role: string;
  onMenuToggle?: () => void;
  isTabletExpanded?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  tutor: "Tutor",
  school_admin: "School Admin",
  parent: "Parent",
  student: "Student",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  admin: "bg-teal-50 text-teal-700",
  tutor: "bg-blue-50 text-blue-700",
  school_admin: "bg-orange-50 text-orange-700",
  parent: "bg-green-50 text-green-700",
  student: "bg-slate-100 text-slate-600",
};

export function Header({ username, role, onMenuToggle, isTabletExpanded = false }: HeaderProps) {
  const avatarLetter = username.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[role] ?? role;
  const roleBadgeColor = ROLE_COLORS[role] ?? "bg-slate-100 text-slate-600";

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-14 bg-white/95 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 md:px-5 z-20",
        "transition-[left] duration-300 ease-in-out",
        // Desktop
        "lg:left-64",
        // Tablet
        isTabletExpanded ? "md:left-64" : "md:left-16",
        // Mobile
        "left-0",
      )}
    >
      {/* ── Left: Mobile hamburger ──────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-200"
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>

        {/* Search bar — visible on sm+ */}
        <div className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg bg-slate-100 border border-slate-200/80 text-slate-400 text-sm min-w-[180px] md:min-w-[220px] cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all duration-200">
          <Search size={13} className="flex-shrink-0" />
          <span className="text-[13px] font-dm-sans">Quick search…</span>
          <kbd className="ml-auto text-[10px] font-mono bg-slate-200 text-slate-400 px-1.5 py-0.5 rounded hidden md:block">⌘K</kbd>
        </div>
      </div>

      {/* ── Right: Notifications + User ─────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <NotificationBell role={role} />

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* User info */}
        <div className="flex items-center gap-2.5">
          {/* Name + role badge — hidden on xs */}
          <div className="hidden sm:flex flex-col items-end gap-0.5">
            <p className="text-[13px] font-semibold text-foreground leading-none font-inter">{username}</p>
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full font-dm-sans tracking-wide", roleBadgeColor)}>
              {roleLabel}
            </span>
          </div>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center ring-2 ring-offset-1 ring-teal/40 transition-all duration-200 hover:ring-teal/70">
            <span className="text-[12px] font-bold text-teal uppercase font-inter">{avatarLetter}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
