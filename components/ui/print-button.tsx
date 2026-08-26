"use client";

import { Printer } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  className?: string;
  children?: ReactNode;
}

export function PrintButton({ className, children }: Props) {
  return (
    <button
      onClick={() => window.print()}
      className={className || "flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"}
    >
      <Printer size={16} />
      {children || "Print"}
    </button>
  );
}
