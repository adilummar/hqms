"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_ROLES = [
  { value: "super_admin",  label: "Super Admin" },
  { value: "admin",        label: "Admin" },
  { value: "tutor",        label: "Tutor" },
  { value: "school_admin", label: "School Admin" },
  { value: "parent",       label: "Parent" },
  { value: "student",      label: "Student" },
] as const;

interface Props {
  currentRole?:   string;
  currentStatus?: string;
}

export function UserFilters({ currentRole, currentStatus }: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  function updateFilter(key: "role" | "status", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      {/* Role dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium shrink-0">Role</span>
        <Select
          value={currentRole ?? "all"}
          onValueChange={(v) => v && updateFilter("role", v)}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ALL_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium shrink-0">Status</span>
        <Select
          value={currentStatus ?? "all"}
          onValueChange={(v) => v && updateFilter("status", v)}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
