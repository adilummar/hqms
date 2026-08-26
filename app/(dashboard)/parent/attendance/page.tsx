import { requireParent, getParentStudentId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, attendanceRecords, parentMeetingAttendance, parentMeetings } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { AttendanceCalendar } from "./attendance-calendar";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Attendance | Parent Portal" };

export default async function ParentAttendancePage() {
  await requireParent();
  const studentId = await getParentStudentId();

  const [student, attendance, meetingHistory] = await Promise.all([
    db.query.students.findFirst({
      where: eq(students.id, studentId),
    }),
    db.query.attendanceRecords.findMany({
      where: eq(attendanceRecords.studentId, studentId),
      orderBy: [desc(attendanceRecords.date)],
    }),
    db.query.parentMeetingAttendance.findMany({
      where: eq(parentMeetingAttendance.studentId, studentId),
      with: {
        meeting: { columns: { title: true, meetingDate: true } },
      },
      orderBy: [desc(parentMeetingAttendance.createdAt)],
    }),
  ]);

  if (!student) {
    return <div className="text-muted-foreground">Student not found.</div>;
  }

  let presentCount = 0;
  let absentCount = 0;
  let leaveCount = 0;

  const presentDates: string[] = [];
  const absentDates: string[] = [];
  const leaveDates: string[] = [];

  for (const record of attendance) {
    if (record.status === "present") {
      presentCount++;
      presentDates.push(record.date);
    } else if (record.status === "absent") {
      absentCount++;
      absentDates.push(record.date);
    } else if (record.status === "leave") {
      leaveCount++;
      leaveDates.push(record.date);
    }
  }

  const total = presentCount + absentCount + leaveCount;
  const percentage = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Attendance Record" 
        description="View your child's attendance history" 
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-5 rounded-lg flex flex-col justify-center">
          <p className="text-sm text-muted-foreground font-medium mb-1">Total Attendance</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-playfair font-bold text-foreground">{percentage}%</span>
          </div>
          <div className="w-full bg-muted h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-foreground h-full rounded-full" style={{ width: `${percentage}%` }} />
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-lg flex flex-col justify-center">
          <p className="text-sm text-muted-foreground font-medium mb-1">Present Days</p>
          <span className="text-3xl font-jetbrains font-bold text-emerald-600">{presentCount}</span>
        </div>

        <div className="bg-card border border-border p-5 rounded-lg flex flex-col justify-center">
          <p className="text-sm text-muted-foreground font-medium mb-1">Absent Days</p>
          <span className="text-3xl font-jetbrains font-bold text-red-600">{absentCount}</span>
        </div>

        <div className="bg-card border border-border p-5 rounded-lg flex flex-col justify-center">
          <p className="text-sm text-muted-foreground font-medium mb-1">Leave Days</p>
          <span className="text-3xl font-jetbrains font-bold text-yellow-600">{leaveCount}</span>
        </div>
      </div>

      {/* ── Big Calendar ─────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6">
        <AttendanceCalendar
          presentDates={presentDates}
          absentDates={absentDates}
          leaveDates={leaveDates}
        />
      </div>

      {/* ── Recent History ───────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-inter text-[15px] font-semibold text-foreground tracking-tight">Recent History</h3>
          <p className="text-[12px] text-muted-foreground font-dm-sans mt-0.5">Last {Math.min(attendance.length, 15)} attendance records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left font-medium text-muted-foreground px-5 py-3 text-[12px] uppercase tracking-wide">Date</th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3 text-[12px] uppercase tracking-wide">Status</th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3 text-[12px] uppercase tracking-wide">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-[13px] text-muted-foreground font-dm-sans">
                    No attendance records yet
                  </td>
                </tr>
              ) : (
                attendance.slice(0, 15).map((record) => (
                  <tr key={record.id} className="hover:bg-muted/30 transition-colors duration-100">
                    <td className="px-5 py-3.5 font-jetbrains text-[13px] text-muted-foreground">
                      {new Date(record.date + "T00:00:00").toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${
                        record.status === "present" ? "bg-emerald-100 text-emerald-800" :
                        record.status === "absent"  ? "bg-red-100 text-red-800" :
                                                      "bg-amber-100 text-amber-800"
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-muted-foreground font-dm-sans">
                      {record.remarks || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parent Meeting Attendance */}
      {meetingHistory.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-playfair text-lg font-semibold mb-1">Parent Meeting Attendance</h3>
          <p className="text-xs text-muted-foreground mb-4">Record of parent attendance at school meetings</p>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Meeting</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Date</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {meetingHistory.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {record.meeting.title}
                    </td>
                    <td className="px-4 py-3 font-jetbrains text-muted-foreground">
                      {new Date(record.meeting.meetingDate + "T00:00:00").toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        record.attended
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}>
                        {record.attended ? "Attended" : "Absent"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">
                      {record.remarks || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
