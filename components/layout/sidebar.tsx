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
  Briefcase,
  Star,
  Archive,
  X,
  ChevronLeft,
  ChevronRight,
  Trophy,
  ListChecks,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { MicLogo } from "@/components/ui/mic-logo";

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
  { label: "Staff Meetings",  href: "/admin/staff-meetings",          icon: Briefcase },
  { label: "Exams",           href: "/admin/exams",                   icon: FileText },
  { label: "Bulk Mark Entry", href: "/admin/exams/bulk-mark-entry",   icon: ListChecks },
  { label: "Stars",           href: "/admin/stars",                   icon: Star },
  { label: "Admissions",      href: "/admin/admissions/applications", icon: ClipboardList },
  { label: "Stock Registration", href: "/admin/inventory", icon: Archive },
  { label: "Reports",         href: "/admin/reports",                 icon: BarChart3 },
];

const TUTOR_NAV: NavItem[] = [
  { label: "Dashboard",       href: "/tutor",                icon: LayoutDashboard },
  { label: "Hifz Entry",      href: "/tutor/hifz",           icon: BookOpen },
  { label: "Monthly Targets", href: "/tutor/hifz/targets",   icon: BarChart3 },
  { label: "Attendance",      href: "/tutor/attendance",     icon: CalendarCheck },
  { label: "Parent Meetings", href: "/tutor/parent-meetings",icon: UsersRound },
  { label: "Staff Meetings",  href: "/tutor/staff-meetings", icon: Briefcase },
  { label: "Stars",           href: "/tutor/stars",          icon: Star },
  { label: "Exams",           href: "/tutor/exams",          icon: FileText },
  { label: "Bulk Mark Entry", href: "/tutor/exams/bulk-mark-entry", icon: ListChecks },
];

const PARENT_NAV: NavItem[] = [
  { label: "Dashboard",     href: "/parent",              icon: LayoutDashboard },
  { label: "Progress",      href: "/parent/progress",     icon: BookOpen },
  { label: "Attendance",    href: "/parent/attendance",   icon: CalendarCheck },
  { label: "Leave Tracker", href: "/parent/leave-tracker",icon: CalendarCheck2 },
  { label: "Exam Results",  href: "/parent#exam-results", icon: Trophy },
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
    case "madrasa_admin":
      return [{ label: "Exams", href: "/madrasa-admin", icon: FileText }];
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
    if (href === "/admin/exams" && pathname.startsWith("/admin/exams/bulk-mark-entry")) return false;
    if (href === "/tutor/exams" && pathname.startsWith("/tutor/exams/bulk-mark-entry")) return false;
    if (href === "/tutor/hifz" &&pathname.startsWith("/tutor/hifz/targets")) return false;
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
        // Deep slate background with subtle border
        "bg-[#0F172A] border-r border-white/[0.06]",
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
      <div className="px-4 py-5 border-b border-white/[0.06] flex items-center justify-between lg:px-5 overflow-hidden">
        <Link
          href={homeHref}
          onClick={onClose}
          className="flex items-center gap-3 min-w-0 group"
        >
          {/* Icon mark */}
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <MicLogo className="w-8 h-8" />
          </div>

          {/* Brand text */}
          <div className={cn(
            "overflow-hidden transition-all duration-300",
            isTabletExpanded ? "md:block lg:block" : "md:hidden lg:block"
          )}>
            <p className="font-inter text-[15px] font-700 font-bold text-white tracking-tight leading-none whitespace-nowrap">
              MIC
            </p>
            <p className="text-[10px] text-white/35 mt-0.5 font-dm-sans whitespace-nowrap tracking-wide uppercase">
              Thahfeezul Qur'an
            </p>
          </div>
        </Link>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Tablet toggle */}
          <button
            onClick={onTabletToggle}
            title={isTabletExpanded ? "Collapse sidebar" : "Expand sidebar"}
            className="hidden md:flex lg:hidden items-center justify-center w-6 h-6 rounded-md text-white/30 hover:text-white/70 hover:bg-white/8 transition-all duration-200"
            aria-label={isTabletExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isTabletExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>

          {/* Mobile close */}
          <button
            onClick={onClose}
            className="flex md:hidden text-white/30 hover:text-white/70 transition-colors p-1 rounded-md hover:bg-white/8"
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
          "text-[10px] font-semibold text-white/20 uppercase tracking-widest px-3 pb-2 mb-1 font-dm-sans",
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
                  ? "bg-teal/15 text-teal border border-teal/20"
                  : "text-white/50 hover:text-white/90 hover:bg-white/[0.06] border border-transparent"
              )}
            >
              <item.icon
                size={16}
                className={cn(
                  "flex-shrink-0 transition-colors duration-200",
                  active ? "text-teal" : "text-white/35 group-hover:text-white/70"
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
                  "ml-auto w-1.5 h-1.5 rounded-full bg-teal flex-shrink-0",
                  isTabletExpanded ? "md:flex lg:flex" : "md:hidden lg:flex"
                )} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom Section ──────────────────────────────────────── */}
      <div className={cn(
        "border-t border-white/[0.06] px-2 py-4 space-y-1",
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
                ? "bg-teal/15 text-teal border-teal/20"
                : "text-white/50 hover:text-white/90 hover:bg-white/[0.06] border-transparent"
            )}
          >
            <Settings
              size={16}
              className={cn(
                "flex-shrink-0",
                pathname.startsWith("/admin/settings") ? "text-teal" : "text-white/35 group-hover:text-white/70"
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
          "mt-3 pt-3 border-t border-white/[0.06]",
          isTabletExpanded ? "md:px-1" : "md:px-0",
          "px-1 lg:px-1"
        )}>
          {/* Full user row: mobile + desktop + tablet expanded */}
          <div className={cn(
            "flex items-center gap-3 mb-3",
            isTabletExpanded ? "md:flex lg:flex" : "md:hidden lg:flex"
          )}>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-lg bg-teal/20 ring-1 ring-teal/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-teal font-inter">{avatarLetter}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white/85 truncate font-inter leading-none">{username}</p>
              <p className="text-[11px] text-white/35 capitalize truncate font-dm-sans mt-0.5">{roleLabel}</p>
            </div>
          </div>

          {/* Tablet collapsed: avatar only */}
          <div className={cn(
            "justify-center mb-3",
            isTabletExpanded ? "hidden" : "hidden md:flex lg:hidden"
          )}>
            <div className="w-8 h-8 rounded-lg bg-teal/20 ring-1 ring-teal/30 flex items-center justify-center">
              <span className="text-xs font-bold text-teal font-inter">{avatarLetter}</span>
            </div>
          </div>

          {/* Sign out button */}
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              className={cn(
                "flex items-center gap-2 text-[12px] text-white/30 hover:text-red-400 transition-all duration-200 rounded-md py-1.5 px-2 hover:bg-red-500/8 w-full",
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
