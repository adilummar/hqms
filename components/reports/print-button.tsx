"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-9 px-4 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors flex items-center gap-2 print:hidden"
    >
      🖨 Print
    </button>
  );
}
