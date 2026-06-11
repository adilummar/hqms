"use client";

import { Bell, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  username: string;
  role: string;
  onMenuToggle?: () => void;
  isTabletExpanded?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  tutor: "Tutor",
  parent: "Parent",
  student: "Student",
};

export function Header({ username, role, onMenuToggle, isTabletExpanded = false }: HeaderProps) {
  return (
    <header
      className={cn(
        // Always fixed, full right edge
        "fixed top-0 right-0 h-14 border-b border-border bg-background flex items-center justify-between px-4 md:px-6 z-20",
        // Desktop: always offset by w-64
        "lg:left-64",
        // Tablet: offset changes with sidebar state
        isTabletExpanded ? "md:left-64" : "md:left-16",
        // Mobile: full width
        "left-0",
        // Smooth transition when sidebar expands/collapses
        "transition-[left] duration-300 ease-in-out"
      )}
    >
      {/* Left: hamburger on mobile/tablet, nothing on desktop */}
      <div className="flex items-center">
        <button
          onClick={onMenuToggle}
          className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1.5 -ml-1.5 rounded-sm hover:bg-muted"
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Right: notifications + user info */}
      <div className="flex items-center gap-3 md:gap-4">
        <button className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-sm hover:bg-muted">
          <Bell size={18} />
        </button>
        <div className="flex items-center gap-2 md:gap-2.5">
          {/* Username hidden on very small screens */}
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-none">
              {username}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ROLE_LABELS[role] ?? role}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
            <span className="text-xs font-medium text-background uppercase">
              {username.charAt(0)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
