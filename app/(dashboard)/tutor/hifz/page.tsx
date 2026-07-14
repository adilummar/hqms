import { requireTutor } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import {
  classes,
  enrollments,
  students,
  hifzDailyEntries,
  juzTracker,
  academicYears,
  leavePeriods,
} from "@/lib/db/schema";
import { eq, and, asc, inArray, ne } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Daily Hifz Entry" };

interface Props {
  searchParams: Promise<{ classId?: string; date?: string }>;
}

export default async function TutorHifzPage({ searchParams }: Props) {
  await requireTutor();
  const params = await searchParams;

  const today = new Date().toISOString().split("T")[0];
  const selectedDate = params.date ?? today;

  // ── Check for active leave period — Hifz tracker is paused during leave ──
  const activeLeave = await db.query.leavePeriods.findFirst({
    where: eq(leavePeriods.isActive, true),
  });

  // Get available Hifz classes
  const hifzClasses = await db.query.classes.findMany({
    where: and(eq(classes.track, "hifz"), eq(classes.isActive, true)),
  });

  // Check for pending promotions (students not enrolled in current academic year)
  const currentYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isCurrent, true),
  });

  let pendingPromotionCount = 0;
  if (currentYear) {
    const activeOldEnrollments = await db.query.enrollments.findMany({
      where: and(
        eq(enrollments.status, "active"),
        ne(enrollments.academicYearId, currentYear.id)
      ),
    });
    const promotedIds = new Set(
      (await db.query.enrollments.findMany({
        where: and(
          eq(enrollments.academicYearId, currentYear.id),
          eq(enrollments.status, "active")
        ),
      })).map((e) => e.studentId)
    );
    pendingPromotionCount = activeOldEnrollments.filter(
      (e) => !promotedIds.has(e.studentId)
    ).length;
  }

  const selectedClassId = params.classId ?? hifzClasses[0]?.id;

  // Get enrollments for the selected class
  let studentRows: {
    student: typeof students.$inferSelect;
    entry: typeof hifzDailyEntries.$inferSelect | undefined;
    currentJuz: typeof juzTracker.$inferSelect | undefined;
  }[] = [];

  if (selectedClassId) {
    const classEnrollments = await db.query.enrollments.findMany({
      where: and(
        eq(enrollments.classId, selectedClassId),
        eq(enrollments.status, "active")
      ),
    });

    if (classEnrollments.length > 0) {
      const studentIds = classEnrollments.map((e) => e.studentId);

      const [studentsList, todayEntries, currentJuzList] = await Promise.all([
        db.query.students.findMany({
          where: inArray(students.id, studentIds),
          orderBy: [asc(students.firstName)],
        }),
        db.query.hifzDailyEntries.findMany({
          where: and(
            inArray(hifzDailyEntries.studentId, studentIds),
            eq(hifzDailyEntries.date, selectedDate)
          ),
        }),
        db.query.juzTracker.findMany({
          where: and(
            inArray(juzTracker.studentId, studentIds),
            eq(juzTracker.status, "in_progress")
          ),
        }),
      ]);

      const entryMap = new Map(todayEntries.map((e) => [e.studentId, e]));
      const juzMap = new Map(currentJuzList.map((j) => [j.studentId, j]));

      studentRows = studentsList.map((s) => ({
        student: s,
        entry: entryMap.get(s.id),
        currentJuz: juzMap.get(s.id),
      }));
    }
  }

  const enteredCount = studentRows.filter((r) => !!r.entry).length;
  const pendingCount = studentRows.length - enteredCount;

  return (
    <div>
      <PageHeader
        title="Daily Hifz Entry"
        description={activeLeave ? `Paused — ${activeLeave.name} is active` : `${enteredCount} entered · ${pendingCount} pending`}
        breadcrumbs={[{ label: "Tutor" }, { label: "Hifz Entry" }]}
      />

      {/* ── Leave Period Lock Banner ──────────────────────────────────────── */}
      {activeLeave && (
        <div className="mb-6 border border-amber-300 bg-amber-50 rounded-lg px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">🌙</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-900 text-sm">
                Hifz Tracker paused — Leave period is active
              </p>
              <p className="text-xs text-amber-700 mt-1">
                <span className="font-medium">{activeLeave.name}</span> ({activeLeave.startDate} → {activeLeave.endDate}) is currently active.
                New Hifz entries are disabled until the leave period ends.
              </p>
              <Link
                href="/admin/leave-tracker/overview"
                className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
              >
                View Leave Tracker →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Promotion Banner */}
      {pendingPromotionCount > 0 && currentYear && (
        <div className="mb-5 border border-amber-300 bg-amber-50 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎓</span>
            <div>
              <p className="text-sm font-medium text-amber-900">
                {pendingPromotionCount} student{pendingPromotionCount !== 1 ? "s" : ""} pending promotion to {currentYear.label}
              </p>
              <p className="text-xs text-amber-700">
                Students must be promoted to continue progress tracking in the new academic year.
              </p>
            </div>
          </div>
          <Link
            href={`/admin/settings/academic-year/promote?yearId=${currentYear.id}`}
            className="shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-sm hover:bg-amber-700 transition-colors"
          >
            Promote Now →
          </Link>
        </div>
      )}

      {/* ── View toggle ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-foreground text-background">
          Individual View
        </span>
        <Link
          href={`/tutor/hifz/bulk?classId=${selectedClassId ?? ""}&date=${selectedDate}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border hover:bg-muted transition-colors"
        >
          ⚡ Bulk Entry
        </Link>
      </div>

      {/* Controls */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={selectedDate}
            max={today}
            className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Class</label>
          <select
            name="classId"
            defaultValue={selectedClassId}
            className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          >
            {hifzClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="h-9 px-4 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
        >
          Load
        </button>
      </form>

      {/* Roster Table */}
      {!selectedClassId || studentRows.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
          {!selectedClassId ? "No Hifz classes available" : "No students enrolled in this class"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border" style={{WebkitOverflowScrolling: "touch"}}>
          <div className="min-w-[640px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Student</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Current Juz</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Today&apos;s Sabaq</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Sabaq Juz</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Daura</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                // Pending first
                ...studentRows.filter((r) => !r.entry),
                ...studentRows.filter((r) => !!r.entry),
              ].map(({ student: s, entry, currentJuz }) => {
                const isEntered = !!entry;

                return (
                  <tr
                    key={s.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/students/${s.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {s.firstName} {s.lastName ?? ""}
                      </Link>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground font-jetbrains">{s.studentCode}</p>
                        {s.isHafiz && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            🎓 Hafiz
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-jetbrains text-sm">
                      {s.isHafiz
                        ? <span className="text-emerald-600 font-medium">Hafiz ✓</span>
                        : currentJuz ? `Juz ${currentJuz.juzNumber}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-jetbrains text-sm">
                      {s.isHafiz
                        ? "—"
                        : entry?.sabaqFromPage && entry?.sabaqToPage
                          ? `${entry.sabaqFromPage}→${entry.sabaqToPage}`
                          : entry?.sabaqRemarksId
                          ? "Reason given"
                          : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {s.isHafiz
                        ? "—"
                        : entry
                          ? entry.sabaqJuzGiven
                            ? <span className="text-green-600 font-medium">✓</span>
                            : <span className="text-red-500">✗</span>
                          : "—"}
                    </td>
                    <td className="px-4 py-3 font-jetbrains text-sm">
                      {s.isHafiz && entry
                        ? [
                            entry.dauraJuzNumbers?.length ? `D1: Juz ${entry.dauraJuzNumbers.join(", ")}` : null,
                            entry.daura2JuzNumbers?.length ? `D2: Juz ${entry.daura2JuzNumbers.join(", ")}` : null,
                          ].filter(Boolean).join(" · ") || (entry.dauraRemarksId || entry.daura2RemarksId ? "Reason" : "—")
                        : entry?.dauraJuzNumbers?.length ? `Juz ${entry.dauraJuzNumbers.join(", ")}` : entry?.dauraRemarksId ? "Reason" : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span
                          className={`w-2 h-2 rounded-full ${isEntered ? "bg-green-500" : "bg-gray-300"}`}
                        />
                        {isEntered ? "Entered" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {activeLeave ? (
                        <span className="text-xs px-3 py-1.5 border border-amber-200 text-amber-600 bg-amber-50 rounded-sm cursor-not-allowed select-none">
                          On Leave
                        </span>
                      ) : (
                        <Link
                          href={`/tutor/hifz/entry/${s.id}?date=${selectedDate}`}
                          className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors"
                        >
                          {isEntered ? "Edit" : "Enter"}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
