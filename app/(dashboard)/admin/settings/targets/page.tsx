import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { academicYears, enrollments, students, studentAnnualHifzTargets } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { TargetAdminControls } from "@/components/hifz/target-admin-controls";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Annual Targets | Settings" };

export default async function TargetsSettingsPage() {
  await requireRole(["super_admin", "admin"]);

  const currentAcYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isCurrent, true)
  });

  let studentData: any[] = [];
  if (currentAcYear) {
    const activeEnrollments = await db.query.enrollments.findMany({
      where: and(
        eq(enrollments.academicYearId, currentAcYear.id),
        eq(enrollments.status, "active")
      ),
      with: { student: true }
    });

    const targets = await db.query.studentAnnualHifzTargets.findMany({
      where: eq(studentAnnualHifzTargets.academicYearId, currentAcYear.id)
    });

    studentData = activeEnrollments.map(e => {
      const t = targets.find(x => x.studentId === e.studentId);
      return {
        id: e.studentId,
        name: `${e.student.firstName} ${e.student.lastName || ""}`.trim(),
        targetId: t?.id || null,
        targetJuzAmount: t?.targetJuzAmount || null,
        calculatedTotalPages: t?.calculatedTotalPages || null,
        startingJuzNumber: t?.startingJuzNumber || null,
        startingPage: t?.startingPage || null,
        isManualOverride: t?.isManualOverride || false,
      };
    });

    // Sort by name
    studentData.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Annual Targets Configuration"
        description="Configure dynamic Hifz targets based on year of study"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Settings", href: "/admin/settings" },
          { label: "Targets" },
        ]}
      />

      <div className="mt-6">
        {currentAcYear ? (
          <TargetAdminControls academicYearId={currentAcYear.id} students={studentData} />
        ) : (
          <div className="p-8 text-center border rounded-lg bg-card text-muted-foreground">
            No active academic year found. Please configure one in Settings.
          </div>
        )}
      </div>
    </div>
  );
}
