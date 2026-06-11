import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as string;
  const username = session.user.name ?? "User";

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar + Header wired together via MobileNav client component */}
      <div className="print:hidden">
        <MobileNav role={role} username={username} />
      </div>

      {/*
        Content offset:
        - Mobile (<md): no margin — sidebar overlays as a drawer
        - Tablet (md): ml-16 — icon-only sidebar width
        - Desktop (lg+): ml-64 — full sidebar width
      */}
      <div className="sidebar-content-area md:ml-16 lg:ml-64 flex flex-col min-h-screen print:ml-0 print:block transition-[margin] duration-300 ease-in-out">
        {/* Header rendered inside MobileNav above for state sharing */}
        {/* Spacer so content sits below the fixed header */}
        <div className="h-14 print:hidden" />
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-7xl mx-auto w-full print:p-0 print:max-w-none print:mx-0">
          {children}
        </main>
      </div>
    </div>
  );
}
