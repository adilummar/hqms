import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { academicYears, enrollments, students } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { PromoteStudentsClient } from "@/components/academic-year/promote-students-client";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Promote Students" };

interface Props {
  searchParams: Promise<{ yearId?: string }>;
}

export default async function PromoteStudentsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const yearId = params.yearId;

  if (!yearId) {
    redirect("/admin/settings/academic-year");
  }

  const newYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.id, yearId),
  });

  if (!newYear) {
    redirect("/admin/settings/academic-year");
  }

  // Get all active enrollments NOT in the new year (these are the ones needing promotion)
  const activeEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.status, "active"),
      ne(enrollments.academicYearId, yearId)
    ),
    with: {
      student: true,
      class: true,
    },
  });

  // Get students already promoted to this new year
  const alreadyPromoted = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.academicYearId, yearId),
      eq(enrollments.status, "active")
    ),
  });
  const promotedIds = new Set(alreadyPromoted.map((e) => e.studentId));

  // Build the pending list
  const pendingStudents = activeEnrollments
    .filter((e) => !promotedIds.has(e.studentId))
    .map((e) => ({
      id: e.id,
      studentId: e.studentId,
      studentCode: e.student.studentCode,
      name: `${e.student.firstName} ${e.student.lastName ?? ""}`.trim(),
      classId: e.classId,
      className: e.class.name,
      yearOfStudy: e.yearOfStudy,
    }))
    .sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));

  const promotedCount = promotedIds.size;
  const totalStudents = pendingStudents.length + promotedCount;

  return (
    <div>
      <PageHeader
        title="Promote Students"
        description={`Academic Year ${newYear.label} — ${promotedCount} of ${totalStudents} promoted`}
        breadcrumbs={[
          { label: "Admin" },
          { label: "Settings", href: "/admin/settings" },
          { label: "Academic Year", href: "/admin/settings/academic-year" },
          { label: "Promote Students" },
        ]}
      />

      {/* Progress bar */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="font-medium text-foreground">Promotion Progress</span>
          <span className="font-jetbrains text-muted-foreground">
            {promotedCount} / {totalStudents} students
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground rounded-full transition-all"
            style={{
              width: totalStudents > 0 ? `${(promotedCount / totalStudents) * 100}%` : "0%",
            }}
          />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {promotedCount} Promoted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            {pendingStudents.length} Pending
          </span>
        </div>
      </div>

      <PromoteStudentsClient
        pendingStudents={pendingStudents}
        newAcademicYearId={yearId}
        yearLabel={newYear.label}
      />
    </div>
  );
}
