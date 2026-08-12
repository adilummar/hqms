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
      "bg-white rounded-xl border border-border p-5 shadow-sm",
      "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
      "group cursor-default"
    )}>
      {/* Top row: label + icon */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-[13px] font-medium text-muted-foreground font-dm-sans leading-none">
          {label}
        </p>
        {Icon && (
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            accent.icon,
            "transition-transform duration-200 group-hover:scale-110"
          )}>
            <Icon size={15} />
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-end justify-between gap-2">
        <p className="font-inter text-3xl font-bold text-foreground leading-none tracking-tight">
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
        <p className="text-[12px] text-muted-foreground mt-2.5 font-dm-sans leading-snug">
          {description}
        </p>
      )}
    </div>
  );
}
