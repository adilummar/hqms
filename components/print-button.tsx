"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-sm bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90 print:hidden"
    >
      <Printer size={16} />
      Print
    </button>
  );
}
