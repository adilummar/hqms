import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apply for Admission | MIC Hifz Portal",
  description: "Submit your application for admission to Markaz Islamic College Hifz Programme",
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header */}
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-foreground rounded-sm flex items-center justify-center">
            <span className="text-background text-xs font-bold font-playfair">MIC</span>
          </div>
          <div>
            <p className="font-playfair text-sm font-semibold text-foreground">MIC Hifz Portal</p>
            <p className="text-xs text-muted-foreground">Markaz Islamic College</p>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
