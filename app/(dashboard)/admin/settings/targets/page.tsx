import { requireRole } from "@/lib/auth/helpers";
import { PageHeader } from "@/components/layout/page-header";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Monthly Targets | Settings" };

export default async function TargetsSettingsPage() {
  await requireRole(["super_admin", "admin"]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Monthly Targets Configuration"
        description="Configure default Hifz targets based on year of study"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Settings", href: "/admin/settings" },
          { label: "Targets" },
        ]}
      />

      <div className="mt-6 p-12 bg-card border border-border rounded-lg shadow-sm text-center">
        <h3 className="text-xl font-playfair font-semibold mb-2">Coming Soon</h3>
        <p className="text-muted-foreground">The Monthly Targets configuration interface is currently under development.</p>
      </div>
    </div>
  );
}
