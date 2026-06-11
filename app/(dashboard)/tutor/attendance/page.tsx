import { requireTutor } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { classes, enrollments, students, attendanceRecords } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { AttendanceRoster } from "@/components/attendance/attendance-roster";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Attendance" };

type Track = "hifz" | "madrasa" | "school";

interface Props {
  searchParams: Promise<{ classId?: string; date?: string; track?: string }>;
}

export default async function TutorAttendancePage({ searchParams }: Props) {
  await requireTutor();
  const params = await searchParams;

  const today = new Date().toISOString().split("T")[0];
  const selectedDate = params.date ?? today;
  const selectedTrack = (params.track ?? "hifz") as Track;

  const allClasses = await db.query.classes.findMany({
    where: and(eq(classes.track, selectedTrack), eq(classes.isActive, true)),
  });

  const selectedClassId = params.classId ?? allClasses[0]?.id;

  let studentList: { id: string; studentCode: string; firstName: string; lastName: string | null }[] = [];
  let existingEntries: { studentId: string; status: "present" | "absent" | "leave"; leaveType?: "sick_leave" | "casual_leave" | "approved_leave" | null; remarks?: string | null }[] = [];

  if (selectedClassId) {
    const classEnrollments = await db.query.enrollments.findMany({
      where: and(eq(enrollments.classId, selectedClassId), eq(enrollments.status, "active")),
    });

    if (classEnrollments.length > 0) {
      const studentIds = classEnrollments.map((e) => e.studentId);

      const [studentsData, attendance] = await Promise.all([
        db.query.students.findMany({
          where: and(eq(students.status, "active"), inArray(students.id, studentIds)),
        }),
        db.query.attendanceRecords.findMany({
          where: and(
            inArray(attendanceRecords.studentId, studentIds),
            eq(attendanceRecords.classId, selectedClassId),
            eq(attendanceRecords.date, selectedDate)
          ),
        }),
      ]);

      studentList = studentsData
        .filter((s) => studentIds.includes(s.id))
        .map((s) => ({ id: s.id, studentCode: s.studentCode, firstName: s.firstName, lastName: s.lastName }))
        .sort((a, b) => a.firstName.localeCompare(b.firstName));

      existingEntries = attendance.map((a) => ({
        studentId: a.studentId,
        status: a.status as "present" | "absent" | "leave",
        leaveType: a.leaveType as "sick_leave" | "casual_leave" | "approved_leave" | null | undefined,
        remarks: a.remarks,
      }));
    }
  }

  const isAlreadyMarked = existingEntries.length > 0;

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={isAlreadyMarked ? `Already marked for ${selectedDate}` : `Mark for ${selectedDate}`}
        breadcrumbs={[{ label: "Tutor" }, { label: "Attendance" }]}
      />
      <form method="GET" className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Date</label>
          <input type="date" name="date" defaultValue={selectedDate} max={today}
            className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Track</label>
          <select name="track" defaultValue={selectedTrack}
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
        <button type="submit" className="h-9 px-4 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors">
          Load
        </button>
      </form>
      {isAlreadyMarked && (
        <div className="mb-4 px-4 py-3 bg-muted border border-border rounded-sm text-sm text-muted-foreground">
          ℹ️ Attendance already marked for this date. Saving again will overwrite.
        </div>
      )}
      {!selectedClassId ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">No classes for this track</div>
      ) : studentList.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">No active students enrolled</div>
      ) : (
        <AttendanceRoster students={studentList} classId={selectedClassId} track={selectedTrack} date={selectedDate} existingEntries={existingEntries} />
      )}
    </div>
  );
}
