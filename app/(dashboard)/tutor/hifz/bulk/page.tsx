import { requireTutor } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import {
  classes,
  enrollments,
  students,
  hifzDailyEntries,
  juzTracker,
  leavePeriods,
  remarksOptions,
} from "@/lib/db/schema";
import {
  eq,
  and,
  asc,
  inArray,
  desc,
  lte,
  gte,
  isNull,
  or,
} from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { HifzBulkEntry } from "@/components/hifz/hifz-bulk-entry";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bulk Hifz Entry" };

interface Props {
  searchParams: Promise<{ classId?: string; date?: string }>;
}

export default async function HifzBulkPage({ searchParams }: Props) {
  await requireTutor();
  const params = await searchParams;

  const today = new Date().toISOString().split("T")[0];
  const selectedDate = params.date ?? today;

  // ── Leave period check ─────────────────────────────────────────────────────
  const activeLeave = await db.query.leavePeriods.findFirst({
    where: eq(leavePeriods.isActive, true),
  });

  if (activeLeave) {
    return (
      <div>
        <PageHeader
          title="Bulk Hifz Entry"
          breadcrumbs={[
            { label: "Tutor" },
            { label: "Hifz Entry", href: "/tutor/hifz" },
            { label: "Bulk" },
          ]}
        />
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-6 py-8 text-center space-y-3">
          <span className="text-4xl block">🌙</span>
          <p className="font-playfair text-lg font-semibold text-amber-900">
            Hifz Tracker is paused
          </p>
          <p className="text-sm text-amber-700">
            <span className="font-medium">{activeLeave.name}</span> (
            {activeLeave.startDate} → {activeLeave.endDate}) is currently
            active. Entries are disabled during leave periods.
          </p>
          <Link
            href="/tutor/hifz"
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-amber-800 underline underline-offset-2"
          >
            ← Back to Hifz List
          </Link>
        </div>
      </div>
    );
  }

  // ── Classes ────────────────────────────────────────────────────────────────
  const hifzClasses = await db.query.classes.findMany({
    where: and(eq(classes.track, "hifz"), eq(classes.isActive, true)),
  });

  const selectedClassId = params.classId ?? hifzClasses[0]?.id;

  // ── Remarks ────────────────────────────────────────────────────────────────
  const allRemarks = await db.query.remarksOptions.findMany({
    where: eq(remarksOptions.isActive, true),
    orderBy: [asc(remarksOptions.displayOrder)],
  });
  const sabaqRemarks = allRemarks.filter((r) => r.category === "sabaq");
  const sabaqJuzRemarks = allRemarks.filter((r) => r.category === "sabaq_juz");
  const dauraRemarks = allRemarks.filter((r) => r.category === "daura");

  // ── Students + entries ─────────────────────────────────────────────────────
  type StudentRow = {
    id: string;
    firstName: string;
    lastName: string | null;
    studentCode: string;
    currentJuzNumber: number | null;
    existingEntry: {
      id: string;
      sabaqFromPage: string | null;
      sabaqToPage: string | null;
      sabaqPages: string | null;
      sabaqRemarksId: string | null;
      sabaqJuzGiven: boolean;
      sabaqJuzRemarksId: string | null;
      dauraJuzNumbers: number[] | null;
      dauraRemarksId: string | null;
    } | null;
  };

  let studentRows: StudentRow[] = [];

  if (selectedClassId) {
    const classEnrollments = await db.query.enrollments.findMany({
      where: and(
        eq(enrollments.classId, selectedClassId),
        eq(enrollments.status, "active")
      ),
    });

    if (classEnrollments.length > 0) {
      const studentIds = classEnrollments.map((e) => e.studentId);

      const [studentsList, existingEntries, currentJuzList] = await Promise.all([
        db.query.students.findMany({
          where: and(
            inArray(students.id, studentIds),
            eq(students.isHafiz, false) // Hafiz students don't do Sabaq/SJ
          ),
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
            or(
              and(
                lte(juzTracker.startDate, selectedDate),
                or(
                  isNull(juzTracker.completionDate),
                  gte(juzTracker.completionDate, selectedDate)
                )
              ),
              and(
                isNull(juzTracker.startDate),
                eq(juzTracker.status, "in_progress")
              )
            )
          ),
          orderBy: [desc(juzTracker.startDate)],
        }),
      ]);

      const entryMap = new Map(existingEntries.map((e) => [e.studentId, e]));
      // Keep only the first (most recent) juz per student
      const juzMap = new Map<string, number>();
      for (const j of currentJuzList) {
        if (!juzMap.has(j.studentId)) juzMap.set(j.studentId, j.juzNumber);
      }

      studentRows = studentsList.map((s) => {
        const entry = entryMap.get(s.id);
        return {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          studentCode: s.studentCode,
          currentJuzNumber: juzMap.get(s.id) ?? null,
          existingEntry: entry
            ? {
                id: entry.id,
                sabaqFromPage: entry.sabaqFromPage,
                sabaqToPage: entry.sabaqToPage,
                sabaqPages: entry.sabaqPages,
                sabaqRemarksId: entry.sabaqRemarksId,
                sabaqJuzGiven: entry.sabaqJuzGiven,
                sabaqJuzRemarksId: entry.sabaqJuzRemarksId,
                dauraJuzNumbers: entry.dauraJuzNumbers,
                dauraRemarksId: entry.dauraRemarksId,
              }
            : null,
        };
      });
    }
  }

  const enteredCount = studentRows.filter((r) => r.existingEntry).length;

  return (
    <div>
      <PageHeader
        title="Bulk Hifz Entry"
        description={`${enteredCount} entered · ${studentRows.length - enteredCount} pending · ${selectedDate}`}
        breadcrumbs={[
          { label: "Tutor" },
          { label: "Hifz Entry", href: "/tutor/hifz" },
          { label: "Bulk" },
        ]}
      />

      {/* ── Controls ──────────────────────────────────────────────────────── */}
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
        <Link
          href={`/tutor/hifz?classId=${selectedClassId ?? ""}&date=${selectedDate}`}
          className="h-9 px-4 flex items-center text-sm border border-border rounded-sm hover:bg-muted transition-colors gap-1.5"
        >
          ← Individual View
        </Link>
      </form>

      {/* ── Bulk entry form ────────────────────────────────────────────────── */}
      <HifzBulkEntry
        date={selectedDate}
        students={studentRows}
        sabaqRemarks={sabaqRemarks}
        sabaqJuzRemarks={sabaqJuzRemarks}
        dauraRemarks={dauraRemarks}
      />
    </div>
  );
}
