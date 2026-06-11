import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { remarksOptions } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { RemarksManager } from "@/components/settings/remarks-manager";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Remarks | Settings" };

export default async function RemarksSettingsPage() {
  await requireRole(["super_admin", "admin"]);

  const allRemarks = await db.query.remarksOptions.findMany({
    orderBy: [asc(remarksOptions.displayOrder), asc(remarksOptions.createdAt)],
  });

  // Convert the generic types to specific types to match the client component props
  const typedRemarks = allRemarks.map(r => ({
    ...r,
    category: r.category as "sabaq" | "sabaq_juz" | "daura" | "attendance"
  }));

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Remarks Manager"
        description="Manage predefined dropdown options for various remarks"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Settings", href: "/admin/settings" },
          { label: "Remarks" },
        ]}
      />

      <div className="mt-6">
        <RemarksManager initialRemarks={typedRemarks} />
      </div>
    </div>
  );
}
