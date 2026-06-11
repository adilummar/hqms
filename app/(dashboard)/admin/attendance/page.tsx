import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { classes, enrollments, students, attendanceRecords } from "@/lib/db/schema";
import { eq, and, between, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Attendance Reports" };

interface Props {
  searchParams: Promise<{ classId?: string; month?: string; year?: string; track?: string }>;
}

type AttStatus = "present" | "absent" | "leave";

export default async function AdminAttendancePage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const now = new Date();
  const year = parseInt(params.year ?? String(now.getFullYear()), 10);
  const month = parseInt(params.month ?? String(now.getMonth() + 1), 10);
  const track = (params.track ?? "hifz") as "hifz" | "madrasa" | "school";

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const days = Array.from({ length: lastDay }, (_, i) => i + 1);

  const allClasses = await db.query.classes.findMany({
    where: and(eq(classes.track, track), eq(classes.isActive, true)),
  });

  const selectedClassId = params.classId ?? allClasses[0]?.id;

  let studentRows: {
    id: string;
    firstName: string;
    lastName: string | null;
    studentCode: string;
    attendanceMap: Record<number, AttStatus>;
    presentCount: number;
    percentage: number;
  }[] = [];

  if (selectedClassId) {
    const classEnrollments = await db.query.enrollments.findMany({
      where: and(eq(enrollments.classId, selectedClassId), eq(enrollments.status, "active")),
    });

    if (classEnrollments.length > 0) {
      const studentIds = classEnrollments.map((e) => e.studentId);

      const [studentsData, allAttendance] = await Promise.all([
        db.query.students.findMany({
          where: and(eq(students.status, "active"), inArray(students.id, studentIds)),
        }),
        db.query.attendanceRecords.findMany({
          where: and(
            inArray(attendanceRecords.studentId, studentIds),
            eq(attendanceRecords.classId, selectedClassId),
            between(attendanceRecords.date, monthStart, monthEnd)
          ),
        }),
      ]);

      // Group attendance by studentId -> day -> status
      const attByStudent = new Map<string, Map<number, AttStatus>>();
      for (const rec of allAttendance) {
        const day = parseInt(rec.date.split("-")[2], 10);
        if (!attByStudent.has(rec.studentId)) {
          attByStudent.set(rec.studentId, new Map());
        }
        attByStudent.get(rec.studentId)!.set(day, rec.status as AttStatus);
      }

      studentRows = studentsData
        .filter((s) => studentIds.includes(s.id))
        .map((s) => {
          const dayMap = attByStudent.get(s.id) ?? new Map();
          const attendanceMap: Record<number, AttStatus> = {};
          let presentCount = 0;
          for (const d of days) {
            const status = dayMap.get(d);
            if (status) {
              attendanceMap[d] = status;
              if (status === "present") presentCount++;
            }
          }
          const markedDays = dayMap.size;
          const percentage = markedDays > 0 ? Math.round((presentCount / markedDays) * 100) : 0;
          return { id: s.id, firstName: s.firstName, lastName: s.lastName, studentCode: s.studentCode, attendanceMap, presentCount, percentage };
        })
        .sort((a, b) => a.firstName.localeCompare(b.firstName));
    }
  }

  const monthName = new Date(year, month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const threshold = 75;

  const CELL: Record<AttStatus, string> = {
    present: "bg-foreground",
    absent: "bg-red-200 border border-red-300",
    leave: "bg-gray-100 border border-gray-200",
  };

  return (
    <div>
      <PageHeader
        title="Attendance Reports"
        description={`Monthly grid for ${monthName}`}
        breadcrumbs={[{ label: "Admin" }, { label: "Attendance" }]}
      />

      {/* Controls */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Track</label>
          <select name="track" defaultValue={track}
            className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground">
            <option value="hifz">Hifz</option>
            <option value="madrasa">Madrasa</option>
            <option value="school">School</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Class</label>
          <select name="classId" defaultValue={selectedClassId}
            className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground">
            {allClasses.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Month</label>
          <select name="month" defaultValue={month}
            className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2024, i).toLocaleDateString("en-IN", { month: "long" })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Year</label>
          <select name="year" defaultValue={year}
            className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground">
            {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="submit" className="h-9 px-4 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors">
          View
        </button>
      </form>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 bg-foreground rounded-xs inline-block" /> Present</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 bg-red-200 border border-red-300 rounded-xs inline-block" /> Absent</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 bg-gray-100 border border-gray-200 rounded-xs inline-block" /> Leave</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 bg-muted border border-border rounded-xs inline-block" /> Not marked</span>
      </div>

      {/* Grid */}
      {studentRows.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
          No attendance data for this selection
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground sticky left-0 bg-muted/50 min-w-[140px]">Student</th>
                {days.map((d) => (
                  <th key={d} className="text-center font-medium text-muted-foreground py-2.5 min-w-[24px]">{d}</th>
                ))}
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground min-w-[60px]">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {studentRows.map((student) => {
                const isLow = student.percentage < threshold && student.percentage > 0;
                return (
                  <tr key={student.id} className={isLow ? "bg-red-50/50" : "hover:bg-muted/20"}>
                    <td className="px-3 py-1.5 sticky left-0 bg-background border-r border-border">
                      <p className="font-medium text-foreground truncate max-w-[130px]">
                        {student.firstName} {student.lastName ?? ""}
                      </p>
                    </td>
                    {days.map((d) => {
                      const status = student.attendanceMap[d];
                      return (
                        <td key={d} className="py-1 px-0.5">
                          <div className={`w-6 h-6 rounded-sm mx-auto ${status ? CELL[status] : "bg-muted/30"}`} />
                        </td>
                      );
                    })}
                    <td className={`px-3 py-1.5 text-center font-jetbrains font-medium ${isLow ? "text-red-600" : "text-foreground"}`}>
                      {student.percentage > 0 ? `${student.percentage}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {studentRows.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          Rows highlighted in red are below {threshold}% attendance threshold.
        </p>
      )}
    </div>
  );
}
