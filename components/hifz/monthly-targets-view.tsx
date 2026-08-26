import { db } from "@/lib/db";
import { classes, enrollments, juzTracker, monthlyTargets, students } from "@/lib/db/schema";
import { getDefaultMonthlyTarget } from "@/lib/hifz-targets";
import { eq, and, between, asc, inArray } from "drizzle-orm";
import { MonthlyTargetCard } from "@/components/hifz/monthly-target-card";
import { ToppersList } from "@/components/hifz/toppers-list";

interface Props {
  hifzClasses: (typeof classes.$inferSelect)[];
  month: number;
  year: number;
  selectedClassId?: string;
  studentHref?: (studentId: string) => string | undefined;
}

export async function MonthlyTargetsView({
  hifzClasses,
  month,
  year,
  selectedClassId,
  studentHref,
}: Props) {
  const activeClassId = selectedClassId ?? hifzClasses[0]?.id;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  let studentData: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string | null;
    target: number;
    actual: number;
  }[] = [];

  if (activeClassId) {
    const classEnrollments = await db.query.enrollments.findMany({
      where: and(
        eq(enrollments.classId, activeClassId),
        eq(enrollments.status, "active")
      ),
    });

    if (classEnrollments.length > 0) {
      const studentIds = classEnrollments.map((enrollment) => enrollment.studentId);
      const enrollmentMap = new Map(classEnrollments.map((enrollment) => [enrollment.studentId, enrollment]));

      const [studentList, targetsList, completionsList] = await Promise.all([
        db.query.students.findMany({
          where: and(
            eq(students.status, "active"),
            inArray(students.id, studentIds)
          ),
          orderBy: [asc(students.firstName)],
        }),
        db.query.monthlyTargets.findMany({
          where: and(
            eq(monthlyTargets.year, year),
            eq(monthlyTargets.month, month),
            inArray(monthlyTargets.studentId, studentIds)
          ),
        }),
        db.query.juzTracker.findMany({
          where: and(
            inArray(juzTracker.studentId, studentIds),
            between(juzTracker.completionDate!, monthStart, monthEnd)
          ),
        }),
      ]);

      const targetsMap = new Map(targetsList.map((target) => [target.studentId, parseFloat(String(target.targetJuz))]));
      const completionsMap = new Map<string, number>();
      for (const juz of completionsList) {
        completionsMap.set(juz.studentId, (completionsMap.get(juz.studentId) ?? 0) + 1);
      }

      studentData = studentList
        .map((student) => {
          const enrollment = enrollmentMap.get(student.id);
          const defaultTarget = getDefaultMonthlyTarget(enrollment?.yearOfStudy);
          return {
            id: student.id,
            studentCode: student.studentCode,
            firstName: student.firstName,
            lastName: student.lastName,
            target: targetsMap.get(student.id) ?? defaultTarget,
            actual: completionsMap.get(student.id) ?? 0,
          };
        })
        .sort((a, b) => b.actual - a.actual || b.target - a.target || a.firstName.localeCompare(b.firstName));
    }
  }

  const toppers = studentData
    .filter((student) => student.target > 0 && student.actual >= student.target)
    .sort((a, b) => b.actual - a.actual || b.target - a.target || a.firstName.localeCompare(b.firstName));

  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Date(2024, index, 1).toLocaleDateString("en-IN", { month: "long" }),
  }));

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-6">
        <form method="GET" className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Month</label>
            <select
              name="month"
              defaultValue={month}
              className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Year</label>
            <select
              name="year"
              defaultValue={year}
              className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              {[2023, 2024, 2025, 2026].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Class</label>
            <select
              name="classId"
              defaultValue={activeClassId}
              className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              {hifzClasses.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="h-9 px-4 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
          >
            View
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-playfair text-lg font-semibold">
              Student Targets - {monthName}
            </h2>
            <span className="text-xs text-muted-foreground">
              {studentData.length} students
            </span>
          </div>

          {studentData.length === 0 ? (
            <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
              No students in this class or no data for this period
            </div>
          ) : (
            studentData.map((student) => (
              <MonthlyTargetCard
                key={student.id}
                student={student}
                year={year}
                month={month}
                studentHref={studentHref?.(student.id)}
              />
            ))
          )}
        </div>

        <div>
          <ToppersList toppers={toppers} month={monthName} />
        </div>
      </div>
    </>
  );
}
