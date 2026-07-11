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
    <div className={cn("mb-4 md:mb-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center mb-2">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="inline-flex items-center">
              {i > 0 && (
                <ChevronRight
                  size={12}
                  className="text-muted-foreground/60 mx-1 shrink-0"
                  aria-hidden="true"
                />
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors font-dm-sans"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="inline-flex items-center text-xs text-muted-foreground font-dm-sans">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Stack vertically on mobile, row on sm+ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-playfair text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            {title}
          </h1>
          {description && (
            <div className="text-sm text-muted-foreground mt-1 font-dm-sans">
              {description}
            </div>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div className="mt-3 md:mt-4 h-px bg-border" />
    </div>
  );
}
