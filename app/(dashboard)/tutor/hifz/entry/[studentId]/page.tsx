import { requireTutor, getSession } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, hifzDailyEntries, juzTracker, leavePeriods } from "@/lib/db/schema";
import { eq, and, count, lt, desc, lte, gte, isNull, or } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { HifzEntryForm } from "@/components/hifz/hifz-entry-form";
import { HafizModeToggle } from "@/components/hifz/hafiz-mode-toggle";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Daily Hifz Entry Form" };

interface Props {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ date?: string }>;
}

export default async function HifzEntryPage({ params, searchParams }: Props) {
  await requireTutor();
  const { studentId } = await params;
  const { date } = await searchParams;

  const today = new Date().toISOString().split("T")[0];
  const targetDate = date ?? today;

  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
  });

  if (!student) return notFound();

  // ── Block entry if a leave period is active ───────────────────────────────────
  const activeLeave = await db.query.leavePeriods.findFirst({
    where: eq(leavePeriods.isActive, true),
  });

  if (activeLeave) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader
          title={`Entry for ${student.firstName} ${student.lastName ?? ""}`}
          description={`Date: ${targetDate} | ID: ${student.studentCode}`}
          breadcrumbs={[
            { label: "Tutor" },
            { label: "Hifz Entry", href: "/tutor/hifz" },
            { label: "Form" },
          ]}
        />
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-6 py-8 text-center space-y-3">
          <span className="text-4xl block">🌙</span>
          <p className="font-playfair text-lg font-semibold text-amber-900">
            Hifz Tracker is paused
          </p>
          <p className="text-sm text-amber-700">
            <span className="font-medium">{activeLeave.name}</span> ({activeLeave.startDate} → {activeLeave.endDate}) is currently active.
            New entries cannot be recorded during leave periods.
          </p>
          <Link
            href="/tutor/hifz"
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
          >
            ← Back to Hifz List
          </Link>
        </div>
      </div>
    );
  }

  const session = await getSession();
  const canRevert =
    session?.user.role === "admin" || session?.user.role === "super_admin";

  const [existingEntry, activeJuz, allRemarks, completedJuz, lastEntry] = await Promise.all([
    db.query.hifzDailyEntries.findFirst({
      where: and(
        eq(hifzDailyEntries.studentId, studentId),
        eq(hifzDailyEntries.date, targetDate)
      ),
    }),
    // Date-aware: find the juz that was being memorised ON targetDate
    // (startDate ≤ targetDate) AND (completionDate IS NULL OR completionDate ≥ targetDate)
    // Fallback: in_progress juz with no startDate recorded yet
    db.query.juzTracker.findFirst({
      where: and(
        eq(juzTracker.studentId, studentId),
        or(
          and(
            lte(juzTracker.startDate, targetDate),
            or(
              isNull(juzTracker.completionDate),
              gte(juzTracker.completionDate, targetDate)
            )
          ),
          // fallback for juz that have no startDate but are in_progress
          and(
            isNull(juzTracker.startDate),
            eq(juzTracker.status, "in_progress")
          )
        )
      ),
      orderBy: [desc(juzTracker.startDate)],
    }),
    db.query.remarksOptions.findMany(),
    // Count juz completed on or before targetDate (date-aware Hafiz check)
    db
      .select({ value: count() })
      .from(juzTracker)
      .where(
        and(
          eq(juzTracker.studentId, studentId),
          eq(juzTracker.status, "completed"),
          lte(juzTracker.completionDate, targetDate)
        )
      ),
    // Fetch the most recent entry BEFORE targetDate to auto-fill From Page
    db.query.hifzDailyEntries.findFirst({
      where: and(
        eq(hifzDailyEntries.studentId, studentId),
        lt(hifzDailyEntries.date, targetDate)
      ),
      orderBy: [desc(hifzDailyEntries.date)],
    }),
  ]);

  const completedJuzCount = completedJuz[0]?.value ?? 0;

  const sabaqRemarks = allRemarks.filter(r => r.category === "sabaq").sort((a,b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const sabaqJuzRemarks = allRemarks.filter(r => r.category === "sabaq_juz").sort((a,b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const dauraRemarks = allRemarks.filter(r => r.category === "daura").sort((a,b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={`Entry for ${student.firstName} ${student.lastName ?? ""}`}
        description={`Date: ${targetDate} | ID: ${student.studentCode}`}
        breadcrumbs={[
          { label: "Tutor" },
          { label: "Hifz Entry", href: "/tutor/hifz" },
          { label: "Form" },
        ]}
      />
      
      <HafizModeToggle
        studentId={student.id}
        isHafiz={student.isHafiz}
        completedJuzCount={completedJuzCount}
        canRevert={canRevert}
      />

      <HifzEntryForm
        key={targetDate}
        studentId={student.id}
        date={targetDate}
        existingEntry={existingEntry}
        activeJuz={activeJuz}
        sabaqRemarks={sabaqRemarks}
        sabaqJuzRemarks={sabaqJuzRemarks}
        dauraRemarks={dauraRemarks}
        isHafiz={student.isHafiz}
        lastSabaqToPage={lastEntry?.sabaqToPage ?? undefined}
      />
    </div>
  );
}
