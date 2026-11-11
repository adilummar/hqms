import { requireRole } from "@/lib/auth/helpers";
import { PageHeader } from "@/components/layout/page-header";
import { BulkMarkEntry } from "@/components/exams/bulk-mark-entry";
import { loadBulkOptions } from "@/lib/exams/bulk-marks";

export const metadata = { title: "Bulk Mark Entry" };

// Tutors only ever see subjects of classes they teach (enforced again by every server action).
export default async function TutorBulkMarkEntryPage() {
  const session = await requireRole(["tutor"]);
  const options = await loadBulkOptions({ id: session.user.id as string, role: session.user.role as string });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Mark Entry"
        description="Enter marks for one subject across your class"
        breadcrumbs={[{ label: "Tutor" }, { label: "Exams", href: "/tutor/exams" }, { label: "Bulk Mark Entry" }]}
      />
      <BulkMarkEntry options={options} />
    </div>
  );
}
