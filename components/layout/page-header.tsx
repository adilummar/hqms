import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/layout/back-button";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  action?: React.ReactNode;
  className?: string;
  /** Set to false to hide the back button. Defaults to true. */
  showBack?: boolean;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  action,
  className,
  showBack = true,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 md:mb-8", className)}>
      {/* Back button — always rendered; BackButton itself hides when no history */}
      {showBack && <BackButton />}

      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center mb-3">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="inline-flex items-center">
              {i > 0 && (
                <ChevronRight
                  size={11}
                  className="text-slate-300 mx-1.5 shrink-0"
                  aria-hidden="true"
                />
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="inline-flex items-center text-[12px] text-slate-400 hover:text-slate-700 transition-colors font-dm-sans"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="inline-flex items-center text-[12px] text-slate-400 font-dm-sans h-[44px]">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-inter text-2xl md:text-[28px] font-bold text-foreground tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <div className="text-[14px] text-muted-foreground mt-1.5 font-dm-sans leading-relaxed">
              {description}
            </div>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {/* Subtle accent underline */}
      <div className="mt-4 flex items-center gap-2">
        <div className="w-8 h-0.5 bg-teal rounded-full" />
        <div className="flex-1 h-px bg-border" />
      </div>
    </div>
  );
}
