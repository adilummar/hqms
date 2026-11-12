import { requireParent, getParentStudentId } from "@/lib/auth/helpers";
import { collapseOffSessions } from "@/lib/attendance/status";
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

  let presentSessions = 0;
  let totalRecordedSessions = 0;
  let leaveCount = 0;

  // Group by date -> FN/AN/Legacy
  const attByDate = new Map<string, { FN?: string; AN?: string; Legacy?: string; remarks?: string }>();
  
  for (const record of attendance) {
    if (record.deletedAt) continue;
    if (!attByDate.has(record.date)) attByDate.set(record.date, {});
    const day = attByDate.get(record.date)!;
    
    if (record.session === "FN") day.FN = record.status;
    else if (record.session === "AN") day.AN = record.status;
    else day.Legacy = record.status;

    if (record.remarks) day.remarks = record.remarks;
  }

  const fullPresentDates: string[] = [];
  const halfPresentDates: string[] = [];
  const fullAbsentDates: string[] = [];
  const partialDates: string[] = [];
  const leaveDates: string[] = [];

  const recentHistory: { id: string; date: string; status: string; remarks: string }[] = [];

  // Sort dates descending
  const sortedDates = Array.from(attByDate.keys()).sort((a, b) => b.localeCompare(a));

  for (const date of sortedDates) {
    const { FN, AN, Legacy, remarks } = attByDate.get(date)!;
    
    let uiStatus = "";
    
    if (Legacy) {
      totalRecordedSessions += 2;
      if (Legacy === "present") presentSessions += 2;
      uiStatus = Legacy === "present" ? "full_present" : Legacy === "absent" ? "full_absent" : "leave";
    } else {
      if (FN === "present" || FN === "absent") {
        totalRecordedSessions += 1;
        if (FN === "present") presentSessions += 1;
      }
      if (AN === "present" || AN === "absent") {
        totalRecordedSessions += 1;
        if (AN === "present") presentSessions += 1;
      }

      // Friday/Holiday sessions are off-days: excluded above, and the other session decides the day
      const c = collapseOffSessions(FN ?? "", AN ?? "");
      if (c.offDay) uiStatus = "off_day";
      else if (c.fn === "present" && c.an === "present") uiStatus = "full_present";
      else if (c.fn === "absent" && c.an === "absent") uiStatus = "full_absent";
      else if ((c.fn === "present" && c.an === "absent") || (c.fn === "absent" && c.an === "present")) uiStatus = "half_present";
      else if (FN || AN) uiStatus = "partial";
    }

    if (uiStatus === "full_present") fullPresentDates.push(date);
    else if (uiStatus === "half_present") halfPresentDates.push(date);
    else if (uiStatus === "full_absent") fullAbsentDates.push(date);
    else if (uiStatus === "partial") partialDates.push(date);
    else if (uiStatus === "leave") leaveDates.push(date);

    if (uiStatus === "leave") leaveCount++;

    recentHistory.push({
      id: date,
      date,
      status: uiStatus,
      remarks: remarks || "",
    });
  }

  const percentage = totalRecordedSessions > 0 ? Math.round((presentSessions / totalRecordedSessions) * 100) : 0;

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
          <p className="text-sm text-muted-foreground font-medium mb-1">Present Sessions</p>
          <span className="text-3xl font-jetbrains font-bold text-emerald-600">{presentSessions}</span>
        </div>

        <div className="bg-card border border-border p-5 rounded-lg flex flex-col justify-center">
          <p className="text-sm text-muted-foreground font-medium mb-1">Recorded Sessions</p>
          <span className="text-3xl font-jetbrains font-bold text-foreground">{totalRecordedSessions}</span>
        </div>

        <div className="bg-card border border-border p-5 rounded-lg flex flex-col justify-center">
          <p className="text-sm text-muted-foreground font-medium mb-1">Leave Days</p>
          <span className="text-3xl font-jetbrains font-bold text-yellow-600">{leaveCount}</span>
        </div>
      </div>

      {/* ── Big Calendar ─────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6">
        <AttendanceCalendar
          fullPresentDates={fullPresentDates}
          halfPresentDates={halfPresentDates}
          fullAbsentDates={fullAbsentDates}
          partialDates={partialDates}
          leaveDates={leaveDates}
        />
      </div>

      {/* ── Recent History ───────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-inter text-[15px] font-semibold text-foreground tracking-tight">Recent History</h3>
          <p className="text-[12px] text-muted-foreground font-dm-sans mt-0.5">Last {Math.min(recentHistory.length, 15)} attendance records</p>
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
              {recentHistory.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-[13px] text-muted-foreground font-dm-sans">
                    No attendance records yet
                  </td>
                </tr>
              ) : (
                recentHistory.slice(0, 15).map((record) => (
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
                        record.status === "full_present" ? "bg-emerald-100 text-emerald-800" :
                        record.status === "half_present" ? "bg-amber-100 text-amber-800" :
                        record.status === "full_absent"  ? "bg-red-100 text-red-800" :
                        record.status === "partial" ? "bg-blue-100 text-blue-800" :
                                                      "bg-gray-100 text-gray-800"
                      }`}>
                        {record.status.replace("_", " ")}
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
                {meetingHistory.map((record) => {
                  let uiLabel = "";
                  let uiColor = "";
                  if (record.status === "ON_TIME") {
                    uiLabel = "On Time"; uiColor = "bg-emerald-100 text-emerald-800";
                  } else if (record.status === "LATE") {
                    uiLabel = "Late"; uiColor = "bg-blue-100 text-blue-800";
                  } else if (record.status === "ABSENT_WITH_REASON") {
                    uiLabel = "Absent (Reason)"; uiColor = "bg-yellow-100 text-yellow-800";
                  } else if (record.status === "ABSENT_WITHOUT_VALID_REASON") {
                    uiLabel = "Absent (No Reason)"; uiColor = "bg-red-100 text-red-800";
                  } else if (record.attended !== null) {
                    uiLabel = record.attended ? "Legacy: Attended" : "Legacy: Absent";
                    uiColor = "bg-gray-100 text-gray-800";
                  }

                  return (
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${uiColor}`}>
                          {uiLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {record.remarks || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
