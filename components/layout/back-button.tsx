"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show only when there is actual history to go back to
    if (window.history.length > 1) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Go back"
      className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 mb-3"
    >
      <ArrowLeft
        size={14}
        className="transition-transform duration-150 group-hover:-translate-x-0.5"
      />
      Back
    </button>
  );
}

