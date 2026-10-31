import { redirect } from "next/navigation";

export default function StaffAttendanceReportRedirect() {
  redirect("/admin/attendance/staff");
}
