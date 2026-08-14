import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 md:mb-8", className)}>
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
                  className="text-[12px] text-muted-foreground hover:text-foreground transition-colors font-dm-sans"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[12px] text-muted-foreground font-dm-sans">
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

      {/* Subtle bottom border without accent */}
      <div className="mt-4 border-b border-border" />
    </div>
  );
}
