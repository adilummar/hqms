"use server";

import { requireParent, getParentStudentId } from "@/lib/auth/helpers";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeft, FileText, Printer } from "lucide-react";
import Link from "next/link";
import { getProgressCardData } from "@/lib/actions/progress-cards";
import { ProgressReportCard } from "@/components/exams/ProgressReportCard";
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

  // Fetch the unified progress card data using the shared action!
  const res = await getProgressCardData(examinationId, studentId);
  
  if (!res.success || !res.data) {
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

  const { student: studentData, examination, academicYearLabel, hifzResult, madrasaResult, schoolResult } = res.data;

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
      </div>

      <ProgressReportCard
        student={studentData}
        examSessionName={examination.name}
        academicYearLabel={academicYearLabel}
        hifzResult={hifzResult}
        madrasaResult={madrasaResult}
        schoolResult={schoolResult}
      />
    </div>
  );
}
