import { requireTutor } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { classes, enrollments, students, studentStars } from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { AwardStarForm } from "@/components/stars/award-star-form";
import { StarSummary } from "@/components/stars/star-summary";
import { Star } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Stars | Tutor" };

interface Props {
  searchParams: Promise<{ classId?: string }>;
}

interface StudentStar {
  id: string;
  type: "blue" | "black";
  reason: string;
  awardedAt: Date;
  awardedBy: string;
  awardedByUser: { username: string } | null;
}

export default async function TutorStarsPage({ searchParams }: Props) {
  const session = await requireTutor();
  const params = await searchParams;
  const isAdmin =
    session.user.role === "admin" || session.user.role === "super_admin";

  const tutorClasses = await db.query.classes.findMany({
    where: isAdmin
      ? eq(classes.isActive, true)
      : and(eq(classes.tutorId, session.user.id), eq(classes.isActive, true)),
    orderBy: [classes.displayOrder, classes.name],
  });

  const selectedClassId =
    tutorClasses.find((classItem) => classItem.id === params.classId)?.id ??
    tutorClasses[0]?.id;

  let studentList: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string | null;
  }[] = [];
  let starsMap: Record<string, StudentStar[]> = {};

  if (selectedClassId) {
    const classEnrollments = await db.query.enrollments.findMany({
      where: and(
        eq(enrollments.classId, selectedClassId),
        eq(enrollments.status, "active")
      ),
    });

    if (classEnrollments.length > 0) {
      const studentIds = classEnrollments.map(
        (enrollment) => enrollment.studentId
      );
      const [studentsData, allStars] = await Promise.all([
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
        db.query.studentStars.findMany({
          where: inArray(studentStars.studentId, studentIds),
          with: { awardedByUser: { columns: { username: true } } },
          orderBy: [desc(studentStars.awardedAt)],
        }),
      ]);

      studentList = studentsData.sort((first, second) =>
        first.firstName.localeCompare(second.firstName)
      );
      starsMap = Object.fromEntries(
        studentList.map((student) => [student.id, []])
      );
      for (const star of allStars) {
        starsMap[star.studentId]?.push(star);
      }
    }
  }

  const allVisibleStars = Object.values(starsMap).flat();
  const totalBlue = allVisibleStars.filter(
    (star) => star.type === "blue"
  ).length;
  const totalBlack = allVisibleStars.filter(
    (star) => star.type === "black"
  ).length;

  return (
    <div>
      <PageHeader
        title="Stars"
        description="Award blue or black stars to students for behaviour and performance"
        breadcrumbs={[{ label: "Tutor" }, { label: "Stars" }]}
      />

      {tutorClasses.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {tutorClasses.map((classItem) => (
            <a
              key={classItem.id}
              href={`/tutor/stars?classId=${classItem.id}`}
              className={`rounded-sm border px-3 py-1.5 text-sm transition-colors ${
                selectedClassId === classItem.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted"
              }`}
            >
              {classItem.name}
            </a>
          ))}
        </div>
      )}

      {studentList.length > 0 && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              Class Star Summary
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {studentList.length} students
            </p>
          </div>
          <StarSummary blue={totalBlue} black={totalBlack} size="md" />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Star size={14} fill="currentColor" className="text-blue-600" />
          <span>
            <strong className="text-blue-700">Blue Star</strong> - Good
            behaviour or performance
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <Star size={14} fill="currentColor" className="text-black" />
          <span>
            <strong className="text-gray-800">Black Star</strong> - Bad
            behaviour or warning
          </span>
        </span>
      </div>

      {tutorClasses.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center text-sm text-muted-foreground">
          No class assigned. Contact admin.
        </div>
      ) : studentList.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center text-sm text-muted-foreground">
          No active students in this class.
        </div>
      ) : (
        <div className="space-y-3">
          {studentList.map((student) => (
            <AwardStarForm
              key={student.id}
              student={student}
              existingStars={starsMap[student.id] ?? []}
              currentUserId={session.user.id}
              canRemoveAny={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
