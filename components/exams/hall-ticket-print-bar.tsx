"use client";

import Link from "next/link";
import { Printer, ChevronLeft, Ticket } from "lucide-react";

interface Props {
  examName: string;
  className: string;
  studentCount: number;
  backHref: string;
}

export function HallTicketPrintBar({ examName, className, studentCount, backHref }: Props) {
  return (
    <div className="no-print sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
          Back
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Ticket size={16} className="text-primary" />
          <div>
            <span className="text-sm font-semibold">{examName}</span>
            <span className="text-sm text-muted-foreground"> · {className}</span>
            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {studentCount} ticket{studentCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
      >
        <Printer size={15} />
        Print All Hall Tickets
      </button>
    </div>
  );
}
