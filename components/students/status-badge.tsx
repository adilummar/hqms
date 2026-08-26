import { cn } from "@/lib/utils";

type StudentStatus = "active" | "completed" | "discontinued";

interface StatusBadgeProps {
  status: StudentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-sm font-medium font-dm-sans",
        status === "active" && "bg-foreground text-background",
        status === "completed" && "border border-foreground text-foreground bg-background",
        status === "discontinued" && "bg-muted text-muted-foreground border border-muted-foreground/20",
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === "active" && "bg-green-400",
          status === "completed" && "bg-foreground",
          status === "discontinued" && "bg-muted-foreground"
        )}
      />
      {status === "active" ? "Active" : status === "completed" ? "Completed" : "Discontinued"}
    </span>
  );
}
