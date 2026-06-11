import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apply for Admission | HQMS",
  description: "Submit your application for admission to Hifzul Quran Management System",
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header */}
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-foreground rounded-sm flex items-center justify-center">
            <span className="text-background text-xs font-bold font-playfair">HQ</span>
          </div>
          <div>
            <p className="font-playfair text-sm font-semibold text-foreground">HQMS</p>
            <p className="text-xs text-muted-foreground">Hifzul Quran Management System</p>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
