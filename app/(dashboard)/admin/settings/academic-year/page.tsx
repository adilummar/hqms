import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { academicYears, batches, classes, enrollments, students } from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { NewAcademicYearForm } from "@/components/academic-year/new-year-form";
import { NewBatchForm } from "@/components/academic-year/new-batch-form";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Batch & Year Management" };

export default async function AcademicYearPage() {
  const session = await requireRole(["admin", "super_admin"]);

  // ── Academic Years ──────────────────────────────────────────
  const allYears = await db.query.academicYears.findMany({
    orderBy: (ay, { desc }) => [desc(ay.createdAt)],
  });

  const classCounts = await db
    .select({ yearId: classes.academicYearId, count: count() })
    .from(classes)
    .where(eq(classes.isActive, true))
    .groupBy(classes.academicYearId);
  const classCountMap = new Map(classCounts.map((c) => [c.yearId, c.count]));

  const enrollmentCounts = await db
    .select({ yearId: enrollments.academicYearId, count: count() })
    .from(enrollments)
    .where(eq(enrollments.status, "active"))
    .groupBy(enrollments.academicYearId);
  const enrollmentCountMap = new Map(enrollmentCounts.map((e) => [e.yearId, e.count]));

  const currentYear = allYears.find((y) => y.isCurrent);
  const isSuperAdmin = session.user.role === "super_admin" || session.user.role === "admin";

  // ── Batches ─────────────────────────────────────────────────
  const allBatches = await db.query.batches.findMany({
    orderBy: (b, { asc }) => [asc(b.batchNumber)],
  });

  // Active student counts per batch
  const activeStudentCounts = await db
    .select({
      batchId: students.batchId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(students)
    .where(eq(students.status, "active"))
    .groupBy(students.batchId);

  // Total student counts per batch
  const totalStudentCounts = await db
    .select({
      batchId: students.batchId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(students)
    .groupBy(students.batchId);

  const activeStudentMap = new Map(activeStudentCounts.map((r) => [r.batchId, r.count]));
  const totalStudentMap  = new Map(totalStudentCounts.map((r) => [r.batchId, r.count]));

  const maxBatchNumber = allBatches.reduce((max, b) => Math.max(max, b.batchNumber), 0);
  const nextBatchNumber = maxBatchNumber + 1;
  const nextYearNumber  = allYears.length + 1;

  function formatDate(d: Date | string | null | undefined): string {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div>
      <PageHeader
        title="Batch & Year Management"
        description="Manage academic years (time periods) and student batches (cohorts)"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Settings", href: "/admin/settings" },
          { label: "Batch & Year Management" },
        ]}
      />

      {/* ── Current Year Banner ─────────────────────────────── */}
      {currentYear && (
        <div className="bg-card border border-border rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Current Academic Year</p>
              <p className="font-playfair text-2xl font-bold text-foreground">
                {currentYear.label}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDate(currentYear.startDate)}
                {currentYear.startDate ? " → " : ""}
                {formatDate(currentYear.endDate)}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="text-center px-4 py-2 border border-border rounded-sm">
                <p className="font-jetbrains font-semibold text-lg text-foreground">
                  {classCountMap.get(currentYear.id) ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Active Classes</p>
              </div>
              <div className="text-center px-4 py-2 border border-border rounded-sm">
                <p className="font-jetbrains font-semibold text-lg text-foreground">
                  {enrollmentCountMap.get(currentYear.id) ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Enrollments</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <Link
              href={`/admin/settings/academic-year/promote?yearId=${currentYear.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 border border-foreground text-sm font-medium rounded-sm hover:bg-foreground hover:text-background transition-colors"
            >
              🎓 Promote Students to Next Year
            </Link>
          </div>
        </div>
      )}

      {/* ── SECTION 1: Academic Years ───────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-playfair text-base font-semibold text-foreground">
              📅 Academic Years
            </h2>
            <p className="text-xs text-muted-foreground">
              Time periods used for classes, enrollments, attendance, and exams.
            </p>
          </div>
          {isSuperAdmin && (
            <NewAcademicYearForm nextBatchNumber={nextBatchNumber} />
          )}
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Label</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Start Date</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">End Date</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Classes</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Enrollments</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allYears.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                      No academic years found. Create the first one above.
                    </td>
                  </tr>
                ) : (
                  allYears.map((year) => (
                    <tr key={year.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-jetbrains font-bold text-foreground">
                        {year.label}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {formatDate(year.startDate)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {formatDate(year.endDate)}
                      </td>
                      <td className="px-5 py-3 font-jetbrains">
                        {classCountMap.get(year.id) ?? 0}
                      </td>
                      <td className="px-5 py-3 font-jetbrains">
                        {enrollmentCountMap.get(year.id) ?? 0}
                      </td>
                      <td className="px-5 py-3">
                        {year.isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Current
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                            Past
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {year.isCurrent && (
                          <Link
                            href={`/admin/settings/academic-year/promote?yearId=${year.id}`}
                            className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors"
                          >
                            Promote Students →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Batches ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-playfair text-base font-semibold text-foreground">
              🎓 Batches
            </h2>
            <p className="text-xs text-muted-foreground">
              Permanent student cohorts. A batch is <strong>Current</strong> when it has active students.
            </p>
          </div>
          {isSuperAdmin && (
            <NewBatchForm nextBatchNumber={nextBatchNumber} />
          )}
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Batch</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Active Students</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Total Students</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Notes</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allBatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                      No batches found. Create your first batch using the button above.
                    </td>
                  </tr>
                ) : (
                  allBatches.map((batch) => {
                    const activeCount = activeStudentMap.get(batch.id) ?? 0;
                    const totalCount  = totalStudentMap.get(batch.id)  ?? 0;
                    const isCurrent   = activeCount > 0;

                    return (
                      <tr key={batch.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3 font-jetbrains font-bold text-foreground">
                          {batch.label}
                        </td>
                        <td className="px-5 py-3 font-jetbrains text-foreground">
                          {activeCount}
                        </td>
                        <td className="px-5 py-3 font-jetbrains text-muted-foreground">
                          {totalCount}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          {batch.notes ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              Current
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                              Inactive
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
