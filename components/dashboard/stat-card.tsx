import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ElementType;
  accentColor?: "teal" | "blue" | "violet" | "amber" | "emerald" | "rose";
  variant?: "default" | "solid";
}

const ACCENT_STYLES = {
  teal:    { icon: "bg-teal-50 text-teal-600",   border: "border-teal-100" },
  blue:    { icon: "bg-blue-50 text-blue-600",   border: "border-blue-100" },
  violet:  { icon: "bg-violet-50 text-violet-600", border: "border-violet-100" },
  amber:   { icon: "bg-amber-50 text-amber-600", border: "border-amber-100" },
  emerald: { icon: "bg-emerald-50 text-emerald-600", border: "border-emerald-100" },
  rose:    { icon: "bg-rose-50 text-rose-600",   border: "border-rose-100" },
};

export function StatCard({
  label,
  value,
  description,
  trend,
  trendValue,
  icon: Icon,
  accentColor = "teal",
  variant = "default",
}: StatCardProps) {
  const accent = ACCENT_STYLES[accentColor];

  const TrendIcon =
    trend === "up" ? TrendingUp :
    trend === "down" ? TrendingDown :
    Minus;

  const trendColor =
    trend === "up" ? "text-emerald-600 bg-emerald-50" :
    trend === "down" ? "text-rose-500 bg-rose-50" :
    "text-slate-500 bg-slate-100";

  return (
    <div className={cn(
      "rounded-xl border p-5 shadow-sm",
      "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
      "group cursor-default",
      variant === "solid"
        ? "bg-primary border-primary text-primary-foreground"
        : "bg-card border-border text-foreground"
    )}>
      {/* Top row: label + icon */}
      <div className="flex items-start justify-between mb-3">
        <p className={cn(
          "text-[13px] font-medium font-dm-sans leading-none",
          variant === "solid" ? "text-primary-foreground/80" : "text-muted-foreground"
        )}>
          {label}
        </p>
        {Icon && (
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            variant === "solid" ? "bg-white/20 text-white" : accent.icon,
            "transition-transform duration-200 group-hover:scale-110"
          )}>
            <Icon size={15} />
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-end justify-between gap-2">
        <p className={cn(
          "font-inter text-3xl font-bold leading-none tracking-tight",
          variant === "solid" ? "text-white" : "text-foreground"
        )}>
          {value}
        </p>

        {/* Trend badge */}
        {trend && trendValue && (
          <span className={cn(
            "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full font-dm-sans",
            trendColor
          )}>
            <TrendIcon size={11} />
            {trendValue}
          </span>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className={cn(
          "text-[12px] mt-2.5 font-dm-sans leading-snug",
          variant === "solid" ? "text-primary-foreground/80" : "text-muted-foreground"
        )}>
          {description}
        </p>
      )}
    </div>
  );
}
