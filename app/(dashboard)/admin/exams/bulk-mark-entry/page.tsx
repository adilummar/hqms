import { requireAdmin } from "@/lib/auth/helpers";
import { PageHeader } from "@/components/layout/page-header";
import { BulkMarkEntry } from "@/components/exams/bulk-mark-entry";
import { loadBulkOptions } from "@/lib/exams/bulk-marks";

export const metadata = { title: "Bulk Mark Entry" };

export default async function AdminBulkMarkEntryPage() {
  const session = await requireAdmin();
  const options = await loadBulkOptions({ id: session.user.id as string, role: session.user.role as string });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Mark Entry"
        description="Enter marks for one subject across a whole class"
        breadcrumbs={[{ label: "Admin" }, { label: "Exams", href: "/admin/exams" }, { label: "Bulk Mark Entry" }]}
      />
      <BulkMarkEntry options={options} />
    </div>
  );
}
