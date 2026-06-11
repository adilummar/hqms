interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export function StatCard({
  label,
  value,
  description,
  trend,
  trendValue,
}: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-none">
      <p className="text-sm text-muted-foreground font-dm-sans mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <p className="font-playfair text-4xl font-semibold text-foreground leading-none">
          {value}
        </p>
        {trend && trendValue && (
          <span
            className={`text-xs font-medium ${
              trend === "up"
                ? "text-green-600"
                : trend === "down"
                ? "text-red-500"
                : "text-muted-foreground"
            }`}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"} {trendValue}
          </span>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground mt-2 font-dm-sans">
          {description}
        </p>
      )}
    </div>
  );
}
