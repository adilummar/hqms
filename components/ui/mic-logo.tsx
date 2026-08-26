"use client";

import { cn } from "@/lib/utils";

interface MicLogoProps {
  className?: string;
}

export function MicLogo({ className }: MicLogoProps) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={cn("w-full h-full", className)} 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left Wing */}
      <path d="M5 25 Q30 25 50 45 L50 95 L5 95 Z" fill="#4ade80" />
      {/* Right Wing */}
      <path d="M95 25 Q70 25 50 45 L50 95 L95 95 Z" fill="#86efac" />
      {/* Center Arch */}
      <path d="M25 95 Q50 35 75 95 Z" fill="#166534" />
    </svg>
  );
}
