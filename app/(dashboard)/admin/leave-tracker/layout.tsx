import Link from "next/link";
import { requireAdmin } from "@/lib/auth/helpers";
import type { ReactNode } from "react";

const TABS = [
  { label: "Overview",  href: "/admin/leave-tracker/overview" },
  { label: "Students",  href: "/admin/leave-tracker/students" },
  { label: "Analysis",  href: "/admin/leave-tracker/analysis" },
  { label: "Toppers",   href: "/admin/leave-tracker/toppers" },
  { label: "Settings",  href: "/admin/leave-tracker/settings" },
];

export default async function LeaveTrackerLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-0 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="leave-tracker-tab px-4 py-3 text-sm font-medium text-muted-foreground border-b-2 border-transparent hover:text-foreground hover:border-foreground/30 transition-all whitespace-nowrap"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
