import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { academicYears, batches, classes, enrollments, students } from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { NewAcademicYearForm } from "@/components/academic-year/new-year-form";
import { NewBatchForm } from "@/components/academic-year/new-batch-form";
import { SetCurrentYearButton } from "@/components/academic-year/set-current-year-button";
import { DeleteAcademicYearButton } from "@/components/academic-year/delete-academic-year-button";
import Link from "next/link";
import { CalendarDays, GraduationCap, Users, BookOpen, ArrowRight, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Batch & Year Management" };

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AcademicYearPage() {
  const session = await requireRole(["admin", "super_admin"]);
  const isSuperAdmin = session.user.role === "super_admin" || session.user.role === "admin";

  // ── Academic Years ──────────────────────────────────────────────────────────
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
  const pastYears   = allYears.filter((y) => !y.isCurrent);

  // ── Batches ─────────────────────────────────────────────────────────────────
  const allBatches = await db.query.batches.findMany({
    orderBy: (b, { asc }) => [asc(b.batchNumber)],
  });

  const activeStudentCounts = await db
    .select({ batchId: students.batchId, count: sql<number>`COUNT(*)::int` })
    .from(students)
    .where(eq(students.status, "active"))
    .groupBy(students.batchId);

  const totalStudentCounts = await db
    .select({ batchId: students.batchId, count: sql<number>`COUNT(*)::int` })
    .from(students)
    .groupBy(students.batchId);

  const activeStudentMap = new Map(activeStudentCounts.map((r) => [r.batchId, r.count]));
  const totalStudentMap  = new Map(totalStudentCounts.map((r) => [r.batchId, r.count]));

  const maxBatchNumber  = allBatches.reduce((max, b) => Math.max(max, b.batchNumber), 0);
  const nextBatchNumber = maxBatchNumber + 1;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Academic Year Management"
        description="Create new academic years, set the active year, and manage student batch cohorts"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Settings", href: "/admin/settings" },
          { label: "Academic Year" },
        ]}
      />

      {/* ── Current Year Hero Card ───────────────────────────────────────────── */}
      {currentYear ? (
        <div className="relative overflow-hidden bg-gradient-to-br from-teal/10 via-emerald-50/50 to-transparent border border-teal/20 rounded-2xl p-6">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-teal/5 rounded-full -translate-y-10 translate-x-10" />
          <div className="absolute bottom-0 right-16 w-24 h-24 bg-emerald-400/5 rounded-full translate-y-8" />

          <div className="relative">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal/15 border border-teal/25 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
              <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">Active Academic Year</span>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <h2 className="text-4xl font-bold text-foreground font-inter tracking-tight">
                  {currentYear.label}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 font-dm-sans">
                  {formatDate(currentYear.startDate)}
                  {currentYear.startDate ? " → " : ""}
                  {formatDate(currentYear.endDate)}
                </p>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-3">
                <div className="bg-white/70 border border-border rounded-xl px-5 py-3 flex items-center gap-3">
                  <BookOpen size={18} className="text-teal" />
                  <div>
                    <p className="text-xl font-bold text-foreground font-inter leading-none">
                      {classCountMap.get(currentYear.id) ?? 0}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-dm-sans mt-0.5">Active Classes</p>
                  </div>
                </div>
                <div className="bg-white/70 border border-border rounded-xl px-5 py-3 flex items-center gap-3">
                  <Users size={18} className="text-emerald-600" />
                  <div>
                    <p className="text-xl font-bold text-foreground font-inter leading-none">
                      {enrollmentCountMap.get(currentYear.id) ?? 0}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-dm-sans mt-0.5">Enrollments</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-5 border-t border-teal/15 flex flex-wrap gap-3">
              <Link
                href={`/admin/settings/academic-year/promote?yearId=${currentYear.id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal text-white text-sm font-semibold rounded-xl hover:bg-teal/90 transition-colors shadow-sm"
              >
                <GraduationCap size={15} />
                Promote Students to Next Year
                <ArrowRight size={13} />
              </Link>
              {isSuperAdmin && (
                <NewAcademicYearForm nextBatchNumber={nextBatchNumber} />
              )}
            </div>
          </div>
        </div>
      ) : (
        /* No current year — big prompt to create one */
        <div className="border-2 border-dashed border-border rounded-2xl p-10 text-center">
          <CalendarDays size={40} className="text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Active Academic Year</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Create your first academic year to enable classes, enrollments, attendance, and exams.
          </p>
          {isSuperAdmin && (
            <NewAcademicYearForm nextBatchNumber={nextBatchNumber} />
          )}
        </div>
      )}

      {/* ── All Academic Years Table ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground font-inter">All Academic Years</h2>
            <p className="text-xs text-muted-foreground font-dm-sans mt-0.5">
              {allYears.length} year{allYears.length !== 1 ? "s" : ""} total · click &quot;Set as Current&quot; to activate any past year
            </p>
          </div>
          {isSuperAdmin && !currentYear && (
            <NewAcademicYearForm nextBatchNumber={nextBatchNumber} />
          )}
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Label</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Start Date</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">End Date</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Classes</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Enrollments</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {allYears.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                      No academic years yet. Create your first one above.
                    </td>
                  </tr>
                ) : (
                  allYears.map((year) => (
                    <tr
                      key={year.id}
                      className={`hover:bg-muted/20 transition-colors ${year.isCurrent ? "bg-teal/[0.03]" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {year.isCurrent && (
                            <CheckCircle2 size={14} className="text-teal shrink-0" />
                          )}
                          <span className="font-bold font-inter text-foreground">{year.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs font-dm-sans">
                        {formatDate(year.startDate)}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs font-dm-sans">
                        {formatDate(year.endDate)}
                      </td>
                      <td className="px-5 py-3.5 font-jetbrains text-foreground">
                        {classCountMap.get(year.id) ?? 0}
                      </td>
                      <td className="px-5 py-3.5 font-jetbrains text-foreground">
                        {enrollmentCountMap.get(year.id) ?? 0}
                      </td>
                      <td className="px-5 py-3.5">
                        {year.isCurrent ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal/10 text-teal-700 border border-teal/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                            Current
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                            Past
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {year.isCurrent ? (
                            <Link
                              href={`/admin/settings/academic-year/promote?yearId=${year.id}`}
                              className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors font-dm-sans"
                            >
                              Promote Students →
                            </Link>
                          ) : (
                            isSuperAdmin && (
                              <>
                                <SetCurrentYearButton yearId={year.id} yearLabel={year.label} />
                                {/* Only show Delete for empty years (newly created, no data yet) */}
                                {(classCountMap.get(year.id) ?? 0) === 0 &&
                                  (enrollmentCountMap.get(year.id) ?? 0) === 0 && (
                                    <DeleteAcademicYearButton yearId={year.id} yearLabel={year.label} />
                                  )}
                              </>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Batches Section ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground font-inter">Student Batches</h2>
            <p className="text-xs text-muted-foreground font-dm-sans mt-0.5">
              Permanent student cohorts — a batch is <strong>Current</strong> when it has active students
            </p>
          </div>
          {isSuperAdmin && (
            <NewBatchForm nextBatchNumber={nextBatchNumber} />
          )}
        </div>

        {allBatches.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl p-10 text-center">
            <GraduationCap size={36} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No batches yet.</p>
            {isSuperAdmin && (
              <div className="mt-4">
                <NewBatchForm nextBatchNumber={nextBatchNumber} />
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {allBatches.map((batch) => {
              const activeCount = activeStudentMap.get(batch.id) ?? 0;
              const totalCount  = totalStudentMap.get(batch.id)  ?? 0;
              const isCurrent   = activeCount > 0;

              return (
                <div
                  key={batch.id}
                  className={`border rounded-xl p-5 transition-all ${
                    isCurrent
                      ? "border-blue-200 bg-blue-50/30"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-foreground font-inter">{batch.label}</p>
                      {batch.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-dm-sans">{batch.notes}</p>
                      )}
                    </div>
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Current
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border shrink-0">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-center">
                    <div>
                      <p className="text-xl font-bold text-foreground font-inter">{activeCount}</p>
                      <p className="text-[10px] text-muted-foreground font-dm-sans">Active</p>
                    </div>
                    <div className="w-px bg-border" />
                    <div>
                      <p className="text-xl font-bold text-muted-foreground font-inter">{totalCount}</p>
                      <p className="text-[10px] text-muted-foreground font-dm-sans">Total</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
