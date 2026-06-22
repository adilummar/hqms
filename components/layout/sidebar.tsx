"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarCheck,
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
import { signOut } from "next-auth/react";
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
  { label: "Students",        href: "/admin/students",       icon: Users },
];

const PARENT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/parent",            icon: LayoutDashboard },
  { label: "Progress",  href: "/parent/progress",   icon: BookOpen },
  { label: "Attendance",href: "/parent/attendance", icon: CalendarCheck },
  { label: "Stars",     href: "/parent/stars",      icon: Star },
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

  // On tablet: show labels when expanded, hide when collapsed
  // "tablet-label" = visible on tablet only when expanded
  const tabletLabelClass = isTabletExpanded
    ? "md:inline lg:inline"   // expanded: show
    : "md:hidden lg:inline";  // collapsed: hide on tablet, show on desktop

  const tabletIconCenterClass = isTabletExpanded
    ? "md:justify-start lg:justify-start" // expanded: left-align like desktop
    : "md:justify-center lg:justify-start"; // collapsed: center on tablet

  const tabletPxClass = isTabletExpanded
    ? "md:px-3 lg:px-3"   // expanded: normal padding
    : "md:px-0 lg:px-3";  // collapsed: no side-pad on tablet

  return (
    <aside
      className={cn(
        // Base layout
        "fixed left-0 top-0 h-full bg-[#111] text-white flex flex-col z-40",
        // Smooth width + position transitions
        "transition-all duration-300 ease-in-out",
        // Desktop: always full width
        "lg:w-64 lg:translate-x-0",
        // Tablet: width depends on expand state
        isTabletExpanded ? "md:w-64" : "md:w-16",
        "md:translate-x-0",
        // Mobile: full-width drawer
        "w-72",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10 flex items-center justify-between lg:px-6 lg:py-6 overflow-hidden">
        <Link
          href={homeHref}
          onClick={onClose}
          className="flex items-center gap-2 min-w-0"
        >
          {/* Book icon — always visible */}
          <div className="w-8 h-8 rounded-sm bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
            <BookOpen size={16} className="text-[#C9A84C]" />
          </div>
          {/* Label: shown on mobile & desktop always; on tablet only when expanded */}
          <div className={cn(
            "overflow-hidden transition-all duration-300",
            isTabletExpanded ? "md:block lg:block" : "md:hidden lg:block"
          )}>
            <h1 className="font-playfair text-xl font-bold text-white tracking-wide leading-none whitespace-nowrap">
              HQMS
            </h1>
            <p className="text-xs text-white/40 mt-0.5 font-dm-sans whitespace-nowrap">
              Hifzul Quran Management
            </p>
          </div>
        </Link>

        {/* Right side of logo bar: tablet toggle OR mobile close */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Tablet expand/collapse — visible only on md (not mobile, not desktop) */}
          <button
            onClick={onTabletToggle}
            title={isTabletExpanded ? "Collapse sidebar" : "Expand sidebar"}
            className="hidden md:flex lg:hidden items-center justify-center w-7 h-7 rounded-sm text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={isTabletExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isTabletExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          {/* Mobile close button — only inside the drawer */}
          <button
            onClick={onClose}
            className="flex md:hidden text-white/40 hover:text-white transition-colors p-1"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden",
        isTabletExpanded ? "md:px-3" : "md:px-2",
        "lg:px-3"
      )}>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={item.label}
              className={cn(
                "flex items-center gap-3 px-2 py-2.5 rounded-sm text-sm transition-colors overflow-hidden",
                tabletIconCenterClass,
                tabletPxClass,
                "lg:justify-start lg:px-3",
                active
                  ? "bg-[#1a1a1a] text-[#C9A84C] border-l-2 border-[#C9A84C]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon
                size={18}
                className={cn("flex-shrink-0", active ? "text-[#C9A84C]" : "text-white/40")}
              />
              <span className={cn(
                "font-dm-sans font-medium whitespace-nowrap transition-all duration-300",
                tabletLabelClass
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className={cn(
        "border-t border-white/10 space-y-0.5",
        "px-2 py-4",
        isTabletExpanded ? "md:px-3" : "md:px-2",
        "lg:px-3"
      )}>



        {/* Settings link */}
        {(role === "super_admin" || role === "admin") && (
          <Link
            href="/admin/settings"
            onClick={onClose}
            title="Settings"
            className={cn(
              "flex items-center gap-3 px-2 py-2.5 rounded-sm text-sm transition-colors overflow-hidden",
              tabletIconCenterClass,
              tabletPxClass,
              "lg:justify-start lg:px-3",
              pathname.startsWith("/admin/settings")
                ? "bg-[#1a1a1a] text-[#C9A84C] border-l-2 border-[#C9A84C]"
                : "text-white/60 hover:text-white hover:bg-white/5"
            )}
          >
            <Settings
              size={18}
              className={cn(
                "flex-shrink-0",
                pathname.startsWith("/admin/settings") ? "text-[#C9A84C]" : "text-white/40"
              )}
            />
            <span className={cn(
              "font-dm-sans font-medium whitespace-nowrap transition-all duration-300",
              tabletLabelClass
            )}>
              Settings
            </span>
          </Link>
        )}

        {/* User info + logout */}
        <div className={cn(
          "py-2 mt-2",
          isTabletExpanded ? "md:px-3" : "md:px-0",
          "px-2 lg:px-3"
        )}>
          {/* Full user info row: shown on mobile + desktop + tablet when expanded */}
          <div className={cn(
            "flex items-center gap-2 mb-2",
            isTabletExpanded ? "md:flex lg:flex" : "md:hidden lg:flex"
          )}>
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <GraduationCap size={14} className="text-white/60" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/80 truncate">{username}</p>
              <p className="text-xs text-white/40 capitalize truncate">{role.replace("_", " ")}</p>
            </div>
          </div>

          {/* Tablet collapsed: just avatar centered */}
          <div className={cn(
            "justify-center mb-2",
            isTabletExpanded ? "hidden" : "hidden md:flex lg:hidden"
          )}>
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              <GraduationCap size={14} className="text-white/60" />
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className={cn(
              "flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors mt-1",
              isTabletExpanded
                ? "md:justify-start md:w-auto"
                : "md:justify-center md:w-full",
              "lg:justify-start lg:w-auto"
            )}
          >
            <LogOut size={14} className="flex-shrink-0" />
            <span className={cn("whitespace-nowrap", tabletLabelClass)}>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
