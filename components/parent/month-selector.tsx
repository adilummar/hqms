"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

interface Props {
  currentYear: number;
  currentMonth: number;
  minDate?: string;
}

export function MonthSelector({ currentYear, currentMonth, minDate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(year: number, month: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(year));
    params.set("month", String(month));
    router.push(`${pathname}?${params.toString()}`);
  }

  function goPrev() {
    let y = currentYear;
    let m = currentMonth - 1;
    if (m < 1) { m = 12; y--; }
    navigate(y, m);
  }

  function goNext() {
    let y = currentYear;
    let m = currentMonth + 1;
    if (m > 12) { m = 1; y++; }
    navigate(y, m);
  }

  const now = new Date();
  const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth() + 1;

  let isPrevDisabled = false;
  if (minDate) {
    const min = new Date(minDate);
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    isPrevDisabled = prevYear < min.getFullYear() || (prevYear === min.getFullYear() && prevMonth < min.getMonth() + 1);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon-sm" onClick={goPrev} disabled={isPrevDisabled}>
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-sm font-medium min-w-[140px] text-center">
        {MONTH_NAMES[currentMonth - 1]} {currentYear}
      </span>
      <Button variant="outline" size="icon-sm" onClick={goNext} disabled={isCurrentMonth}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
