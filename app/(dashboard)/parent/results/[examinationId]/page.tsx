import { requireParent, getParentStudentId } from "@/lib/auth/helpers";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeft, FileText } from "lucide-react";
import Link from "next/link";
import { buildProgressCardData } from "@/lib/exams/progress-card";
import { ProgressReportCard } from "@/components/exams/ProgressReportCard";
import { PrintButton } from "@/components/ui/print-button";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function ParentResultDetailPage({
  params,
}: {
  params: Promise<{ examinationId: string }>;
}) {
  await requireParent();
  const studentId = await getParentStudentId();
  const { examinationId } = await params;

  // Verify student exists
  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
  });
  if (!student) notFound();

  // Same builder and same card layout as the admin-printed progress card.
  const res = await buildProgressCardData(examinationId, studentId, {}, { publishedOnly: true });

  if (!res.success) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 print:hidden">
          <Link href="/parent" className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <PageHeader
            title="Progress Report"
            description="View and print your child's term progress card"
          />
        </div>
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-3 border border-destructive/20">
          <FileText className="w-5 h-5" />
          <p className="text-sm font-medium">{res.error || "Failed to load progress card."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/parent" className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <PageHeader
            title="Progress Report"
            description="View and print your child's term progress card"
          />
        </div>
        <PrintButton className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90">
          Print Card
        </PrintButton>
      </div>

      <ProgressReportCard data={res.data} />
    </div>
  );
}
