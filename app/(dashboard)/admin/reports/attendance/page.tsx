import { requireAdmin } from "@/lib/auth/helpers";
import { collapseOffSessions } from "@/lib/attendance/status";
import { db } from "@/lib/db";
import {
  attendanceRecords,
  students,
  classes,
  enrollments,
} from "@/lib/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { PrintButton } from "@/components/reports/print-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Daily Attendance Report | Admin" };

interface Props {
  searchParams: Promise<{ date?: string; classId?: string; track?: string }>;
}

type AttStatus = "present" | "absent" | "leave";

export default async function AttendanceReportPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const today = new Date().toISOString().split("T")[0];
  const selectedDate = params.date ?? today;
  const track = (params.track ?? "hifz") as "hifz" | "madrasa" | "school";

  // All active classes for the selected track
  const allClasses = await db.query.classes.findMany({
    where: and(eq(classes.track, track), eq(classes.isActive, true)),
    orderBy: [asc(classes.displayOrder), asc(classes.name)],
  });

  const selectedClassId = params.classId ?? allClasses[0]?.id;
  const selectedClass = allClasses.find((c) => c.id === selectedClassId);

  // ── Fetch all enrolled students + their attendance for the day ──────────────
  type StudentRow = {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string | null;
    outcome: string; // "FULL_DAY_PRESENT" | "HALF_DAY_PRESENT" | "FULL_DAY_ABSENT" | "PENDING_PARTIAL" | "NO_RECORD"
  };

  let fullPresent: StudentRow[] = [];
  let halfPresent: StudentRow[] = [];
  let fullAbsent: StudentRow[] = [];
  let pending: StudentRow[] = [];
  let noRecord: StudentRow[] = [];
  let offDay: StudentRow[] = [];

  if (selectedClassId) {
    const classEnrollments = await db.query.enrollments.findMany({
      where: and(
        eq(enrollments.classId, selectedClassId),
        eq(enrollments.status, "active")
      ),
    });

    if (classEnrollments.length > 0) {
      const studentIds = classEnrollments.map((e) => e.studentId);

      const [studentsData, dayAttendance] = await Promise.all([
        db.query.students.findMany({
          where: and(
            eq(students.status, "active"),
            inArray(students.id, studentIds)
          ),
          columns: {
            id: true,
            studentCode: true,
            firstName: true,
            lastName: true,
          },
        }),
        db.query.attendanceRecords.findMany({
          where: and(
            inArray(attendanceRecords.studentId, studentIds),
            eq(attendanceRecords.classId, selectedClassId),
            eq(attendanceRecords.date, selectedDate)
          ),
        }),
      ]);

      const getOutcome = (fnIn: string, anIn: string) => {
        // Friday/Holiday sessions are off-days: not present, absent or pending
        const { fn, an, offDay } = collapseOffSessions(fnIn, anIn);
        if (offDay) return "OFF_DAY";
        if (fn === "unmarked" && an === "unmarked") return fnIn !== anIn ? "PENDING_PARTIAL" : "NO_RECORD";
        if (fn === "unmarked" || an === "unmarked") return "PENDING_PARTIAL";
        
        // Treat leave as absent for daily FN/AN outcome logic or leave it?
        // Let's treat 'leave' as 'absent' logically for present/absent matrix.
        const fnState = (fn === "leave") ? "absent" : fn;
        const anState = (an === "leave") ? "absent" : an;

        if (fnState === "present" && anState === "present") return "FULL_DAY_PRESENT";
        if (fnState === "absent" && anState === "absent") return "FULL_DAY_ABSENT";
        
        return "HALF_DAY_PRESENT";
      };

      const allRows: StudentRow[] = studentsData
        .sort((a, b) => a.firstName.localeCompare(b.firstName))
        .map((s) => {
          const sRecs = dayAttendance.filter(r => r.studentId === s.id);
          const fnRec = sRecs.find(r => r.session === "FN");
          const anRec = sRecs.find(r => r.session === "AN");
          
          const fnStat = fnRec ? fnRec.status : "unmarked";
          const anStat = anRec ? anRec.status : "unmarked";

          return {
            id: s.id,
            studentCode: s.studentCode,
            firstName: s.firstName,
            lastName: s.lastName,
            outcome: getOutcome(fnStat, anStat),
          };
        });

      fullPresent = allRows.filter((r) => r.outcome === "FULL_DAY_PRESENT");
      halfPresent = allRows.filter((r) => r.outcome === "HALF_DAY_PRESENT");
      fullAbsent  = allRows.filter((r) => r.outcome === "FULL_DAY_ABSENT");
      pending     = allRows.filter((r) => r.outcome === "PENDING_PARTIAL");
      noRecord    = allRows.filter((r) => r.outcome === "NO_RECORD");
      offDay      = allRows.filter((r) => r.outcome === "OFF_DAY");
    }
  }

  const total = fullPresent.length + halfPresent.length + fullAbsent.length + pending.length + noRecord.length + offDay.length;
  const markedCount = fullPresent.length + halfPresent.length + fullAbsent.length + pending.length + offDay.length;

  const formattedDate = selectedDate
    ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  function StatusPill({ count, label, color }: { count: number; label: string; color: string }) {
    return (
      <div className={`rounded-lg border px-4 py-3 text-center ${color}`}>
        <p className="font-playfair text-2xl font-bold">{count}</p>
        <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
      </div>
    );
  }

  function StudentList({
    title,
    rows,
    accent,
    dotColor,
    emptyText,
  }: {
    title: string;
    rows: StudentRow[];
    accent: string;
    dotColor: string;
    emptyText: string;
  }) {
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className={`px-4 py-3 border-b border-border flex items-center justify-between ${accent}`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
          <span className="text-xs font-mono font-bold opacity-70">{rows.length}</span>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((s, i) => (
              <li key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono w-5 text-right shrink-0">
                  {i + 1}.
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {s.firstName} {s.lastName ?? ""}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">{s.studentCode}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="print:m-0 print:p-0">
      {/* Page header — hidden on print */}
      <div className="print:hidden">
        <PageHeader
          title="Daily Attendance Report"
          description="View present and absent students for any date and class"
          breadcrumbs={[
            { label: "Admin" },
            { label: "Reports", href: "/admin/reports" },
            { label: "Attendance" },
          ]}
        />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">Daily Attendance Report</h1>
        <p className="text-sm text-gray-600 mt-1">
          {selectedClass?.name} — {formattedDate}
        </p>
      </div>

      {/* ── Controls ── */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6 items-end print:hidden">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Track</label>
          <select
            name="track"
            defaultValue={track}
            className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          >
            <option value="hifz">Hifz</option>
            <option value="madrasa">Madrasa</option>
            <option value="school">School</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Class</label>
          <select
            name="classId"
            defaultValue={selectedClassId}
            className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          >
            {allClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
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
        <button
          type="submit"
          className="h-9 px-4 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
        >
          View
        </button>
        <PrintButton />
      </form>

      {/* ── No class selected ── */}
      {!selectedClassId ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
          <p className="font-medium">Select a class to view attendance</p>
        </div>
      ) : total === 0 && allClasses.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
          <p className="font-medium">No active classes found for this track</p>
        </div>
      ) : (
        <>
          {/* ── Summary pills ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 print:hidden">
            <StatusPill
              count={fullPresent.length}
              label="Full Present"
              color="bg-emerald-50 border-emerald-200 text-emerald-800"
            />
            <StatusPill
              count={halfPresent.length}
              label="Half Present"
              color="bg-blue-50 border-blue-200 text-blue-700"
            />
            <StatusPill
              count={fullAbsent.length}
              label="Full Absent"
              color="bg-red-50 border-red-200 text-red-700"
            />
            {offDay.length > 0 && (
              <StatusPill
                count={offDay.length}
                label="Off Day"
                color="bg-violet-50 border-violet-200 text-violet-700"
              />
            )}
            <StatusPill
              count={noRecord.length}
              label="No Record"
              color="bg-muted border-border text-muted-foreground"
            />
          </div>

          {/* ── Info bar ── */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:mb-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {selectedClass?.name} —{" "}
                <span className="text-muted-foreground font-normal">{formattedDate}</span>
              </p>
              {markedCount > 0 ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {markedCount} of {total} students partially/fully marked •{" "}
                  <span className="text-emerald-700 font-medium">
                    {total > 0 ? Math.round(((fullPresent.length + (halfPresent.length * 0.5)) / total) * 100) : 0}% attendance
                  </span>
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-0.5">
                  Attendance not yet marked for this date
                </p>
              )}
            </div>
          </div>

          {/* ── Four lists grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StudentList
              title="Full Day Present"
              rows={fullPresent}
              accent="bg-emerald-50/60"
              dotColor="bg-emerald-500"
              emptyText="No students marked full present"
            />
            <StudentList
              title="Half Day Present"
              rows={halfPresent}
              accent="bg-blue-50/60"
              dotColor="bg-blue-500"
              emptyText="No students marked half present"
            />
            <StudentList
              title="Full Day Absent"
              rows={fullAbsent}
              accent="bg-red-50/60"
              dotColor="bg-red-500"
              emptyText="No students marked full absent"
            />
            {offDay.length > 0 && (
              <StudentList
                title="Off Day (Friday / Holiday)"
                rows={offDay}
                accent="bg-violet-50/60"
                dotColor="bg-violet-500"
                emptyText="No students on an off day"
              />
            )}
            {(pending.length > 0 || noRecord.length > 0) && (
              <StudentList
                title="Pending / No Record"
                rows={[...pending, ...noRecord]}
                accent="bg-muted/40"
                dotColor="bg-muted-foreground/40"
                emptyText="All students fully marked"
              />
            )}
          </div>

          {/* Print-only compact table */}
          <div className="hidden print:block mt-6">
            <div className="grid grid-cols-2 gap-6">
              {[
                { title: "Full Present", rows: fullPresent, symbol: "✓✓" },
                { title: "Half Present", rows: halfPresent, symbol: "✓" },
                { title: "Full Absent",  rows: fullAbsent,  symbol: "✗✗" },
              ].map(({ title, rows, symbol }) => (
                <div key={title}>
                  <h2 className="font-bold text-sm border-b pb-1 mb-2">
                    {symbol} {title} ({rows.length})
                  </h2>
                  <ol className="space-y-0.5">
                    {rows.map((s, i) => (
                      <li key={s.id} className="text-xs flex gap-2">
                        <span className="w-5 text-gray-500">{i + 1}.</span>
                        <span>{s.firstName} {s.lastName ?? ""}</span>
                        <span className="text-gray-400 font-mono ml-auto">{s.studentCode}</span>
                      </li>
                    ))}
                    {rows.length === 0 && (
                      <li className="text-xs text-gray-400 italic">None</li>
                    )}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
