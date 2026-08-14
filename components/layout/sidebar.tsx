"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarCheck,
  CalendarCheck2,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  GraduationCap,
  FileText,
  UsersRound,
  Star,
  Archive,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard",       href: "/admin",                         icon: LayoutDashboard },
  { label: "Students",        href: "/admin/students",                icon: Users },
  { label: "Hifz Progress",   href: "/admin/hifz/targets",           icon: BookOpen },
  { label: "Attendance",      href: "/admin/attendance",              icon: CalendarCheck },
  { label: "Leave Tracker",   href: "/admin/leave-tracker",          icon: CalendarCheck2 },
  { label: "Parent Meetings", href: "/admin/parent-meetings",         icon: UsersRound },
  { label: "Exams",           href: "/admin/exams",                   icon: FileText },
  { label: "Admissions",      href: "/admin/admissions/applications", icon: ClipboardList },
  { label: "Inventory",       href: "/admin/inventory",               icon: Archive },
  { label: "Reports",         href: "/admin/reports",                 icon: BarChart3 },
];

const TUTOR_NAV: NavItem[] = [
  { label: "Dashboard",       href: "/tutor",                icon: LayoutDashboard },
  { label: "Hifz Entry",      href: "/tutor/hifz",           icon: BookOpen },
  { label: "Monthly Targets", href: "/tutor/hifz/targets",   icon: BarChart3 },
  { label: "Attendance",      href: "/tutor/attendance",     icon: CalendarCheck },
  { label: "Parent Meetings", href: "/tutor/parent-meetings",icon: UsersRound },
  { label: "Stars",           href: "/tutor/stars",          icon: Star },
  { label: "Exams",           href: "/tutor/exams",          icon: FileText },
];

const PARENT_NAV: NavItem[] = [
  { label: "Dashboard",     href: "/parent",              icon: LayoutDashboard },
  { label: "Progress",      href: "/parent/progress",     icon: BookOpen },
  { label: "Attendance",    href: "/parent/attendance",   icon: CalendarCheck },
  { label: "Leave Tracker", href: "/parent/leave-tracker",icon: CalendarCheck2 },
  { label: "Stars",         href: "/parent/stars",        icon: Star },
];

const STUDENT_NAV: NavItem[] = [
  { label: "Dashboard",   href: "/student",          icon: LayoutDashboard },
  { label: "My Progress", href: "/student/progress", icon: BookOpen },
  { label: "My Stars",    href: "/student/stars",    icon: Star },
];

function getNavItems(role: string): NavItem[] {
  switch (role) {
    case "super_admin":
    case "admin":
      return ADMIN_NAV;
    case "tutor":
      return TUTOR_NAV;
    case "school_admin":
      return [{ label: "Exams", href: "/school-admin", icon: FileText }];
    case "parent":
      return PARENT_NAV;
    case "student":
      return STUDENT_NAV;
    default:
      return ADMIN_NAV;
  }
}

interface SidebarProps {
  role: string;
  username: string;
  isOpen?: boolean;
  onClose?: () => void;
  isTabletExpanded?: boolean;
  onTabletToggle?: () => void;
}

export function Sidebar({
  role,
  username,
  isOpen = false,
  onClose,
  isTabletExpanded = false,
  onTabletToggle,
}: SidebarProps) {
  const pathname = usePathname();
  const navItems = getNavItems(role);

  function isActive(href: string) {
    if (pathname === href) return true;
    if (href === "/admin" || href === "/tutor" || href === "/parent" || href === "/student") {
      return false;
    }
    if (href === "/tutor/hifz" && pathname.startsWith("/tutor/hifz/targets")) return false;
    if (href === "/admin/hifz" && pathname.startsWith("/admin/hifz/targets")) return false;
    return pathname.startsWith(`${href}/`);
  }

  const homeHref =
    role === "tutor" ? "/tutor"
    : role === "parent" ? "/parent"
    : role === "student" ? "/student"
    : "/admin";

  const tabletLabelClass = isTabletExpanded
    ? "md:inline lg:inline"
    : "md:hidden lg:inline";

  const tabletIconCenterClass = isTabletExpanded
    ? "md:justify-start lg:justify-start"
    : "md:justify-center lg:justify-start";

  const tabletPxClass = isTabletExpanded
    ? "md:px-3 lg:px-3"
    : "md:px-0 lg:px-3";

  // First letter of username for avatar
  const avatarLetter = username.charAt(0).toUpperCase();
  const roleLabel = role.replace(/_/g, " ");

  return (
    <aside
      className={cn(
        // Base
        "fixed left-0 top-0 h-full flex flex-col z-40",
        // Light sidebar background with subtle border
        "bg-sidebar border-r border-sidebar-border",
        // Transitions
        "transition-all duration-300 ease-in-out",
        // Desktop: always full
        "lg:w-64 lg:translate-x-0",
        // Tablet
        isTabletExpanded ? "md:w-64" : "md:w-16",
        "md:translate-x-0",
        // Mobile drawer
        "w-72",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      {/* ── Logo / Brand ────────────────────────────────────────── */}
      <div className="px-4 py-5 border-b border-sidebar-border flex items-center justify-between lg:px-5 overflow-hidden">
        <Link
          href={homeHref}
          onClick={onClose}
          className="flex items-center gap-3 min-w-0 group"
        >
          {/* Icon mark */}
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary/10 flex items-center justify-center flex-shrink-0 ring-1 ring-sidebar-primary/20 group-hover:bg-sidebar-primary/20 transition-colors duration-200">
            <BookOpen size={15} className="text-sidebar-primary" />
          </div>

          {/* Brand text */}
          <div className={cn(
            "overflow-hidden transition-all duration-300",
            isTabletExpanded ? "md:block lg:block" : "md:hidden lg:block"
          )}>
            <p className="font-inter text-[15px] font-700 font-bold text-sidebar-foreground tracking-tight leading-none whitespace-nowrap">
              MIC Hifz Portal
            </p>
            <p className="text-[10px] text-sidebar-foreground/60 mt-0.5 font-dm-sans whitespace-nowrap tracking-wide uppercase">
              Markaz Islamic College
            </p>
          </div>
        </Link>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Tablet toggle */}
          <button
            onClick={onTabletToggle}
            title={isTabletExpanded ? "Collapse sidebar" : "Expand sidebar"}
            className="hidden md:flex lg:hidden items-center justify-center w-6 h-6 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
            aria-label={isTabletExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isTabletExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>

          {/* Mobile close */}
          <button
            onClick={onClose}
            className="flex md:hidden text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1 rounded-md hover:bg-sidebar-accent"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <nav className={cn(
        "flex-1 px-2 py-4 overflow-y-auto overflow-x-hidden space-y-0.5",
        "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        isTabletExpanded ? "md:px-3" : "md:px-2",
        "lg:px-3"
      )}>
        {/* Section label */}
        <p className={cn(
          "text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-3 pb-2 mb-1 font-dm-sans",
          isTabletExpanded ? "md:block lg:block" : "md:hidden lg:block"
        )}>
          Navigation
        </p>

        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={item.label}
              className={cn(
                // Base
                "flex items-center gap-3 py-2.5 rounded-lg text-sm transition-all duration-200 overflow-hidden group",
                tabletIconCenterClass,
                tabletPxClass,
                "px-3 lg:justify-start lg:px-3",
                active
                  ? "bg-sidebar-primary/10 text-sidebar-primary border-sidebar-primary/20"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent border-transparent"
              )}
            >
              <item.icon
                size={16}
                className={cn(
                  "flex-shrink-0 transition-colors duration-200",
                  active ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                )}
              />
              <span className={cn(
                "font-dm-sans font-medium whitespace-nowrap transition-all duration-300 text-[13px]",
                tabletLabelClass
              )}>
                {item.label}
              </span>
              {/* Active indicator dot */}
              {active && (
                <span className={cn(
                  "ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary flex-shrink-0",
                  isTabletExpanded ? "md:flex lg:flex" : "md:hidden lg:flex"
                )} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom Section ──────────────────────────────────────── */}
      <div className={cn(
        "border-t border-sidebar-border px-2 py-4 space-y-1",
        isTabletExpanded ? "md:px-3" : "md:px-2",
        "lg:px-3"
      )}>

        {/* Settings */}
        {(role === "super_admin" || role === "admin") && (
          <Link
            href="/admin/settings"
            onClick={onClose}
            title="Settings"
            className={cn(
              "flex items-center gap-3 py-2.5 rounded-lg text-sm transition-all duration-200 overflow-hidden group border",
              tabletIconCenterClass,
              tabletPxClass,
              "px-3 lg:justify-start lg:px-3",
              pathname.startsWith("/admin/settings")
                ? "bg-sidebar-primary/10 text-sidebar-primary border-sidebar-primary/20"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent border-transparent"
            )}
          >
            <Settings
              size={16}
              className={cn(
                "flex-shrink-0",
                pathname.startsWith("/admin/settings") ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
              )}
            />
            <span className={cn(
              "font-dm-sans font-medium whitespace-nowrap transition-all duration-300 text-[13px]",
              tabletLabelClass
            )}>
              Settings
            </span>
          </Link>
        )}

        {/* ── User Card ─────────────────────────────────────────── */}
        <div className={cn(
          "mt-3 pt-3 border-t border-sidebar-border",
          isTabletExpanded ? "md:px-1" : "md:px-0",
          "px-1 lg:px-1"
        )}>
          {/* Full user row: mobile + desktop + tablet expanded */}
          <div className={cn(
            "flex items-center gap-3 mb-3",
            isTabletExpanded ? "md:flex lg:flex" : "md:hidden lg:flex"
          )}>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary/10 ring-1 ring-sidebar-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-sidebar-primary font-inter">{avatarLetter}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-sidebar-foreground truncate font-inter leading-none">{username}</p>
              <p className="text-[11px] text-sidebar-foreground/60 capitalize truncate font-dm-sans mt-0.5">{roleLabel}</p>
            </div>
          </div>

          {/* Tablet collapsed: avatar only */}
          <div className={cn(
            "justify-center mb-3",
            isTabletExpanded ? "hidden" : "hidden md:flex lg:hidden"
          )}>
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary/10 ring-1 ring-sidebar-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-sidebar-primary font-inter">{avatarLetter}</span>
            </div>
          </div>

          {/* Sign out button */}
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              className={cn(
                "flex items-center gap-2 text-[12px] text-sidebar-foreground/50 hover:text-destructive transition-all duration-200 rounded-md py-1.5 px-2 hover:bg-destructive/10 w-full",
                isTabletExpanded
                  ? "md:justify-start"
                  : "md:justify-center",
                "lg:justify-start"
              )}
            >
              <LogOut size={13} className="flex-shrink-0" />
              <span className={cn("whitespace-nowrap font-dm-sans", tabletLabelClass)}>Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
