import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { classes, enrollments, students, studentStars } from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { AwardStarForm } from "@/components/stars/award-star-form";
import { StarSummary } from "@/components/stars/star-summary";
import { Star, StarOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Stars | Admin" };

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

export default async function AdminStarsPage({ searchParams }: Props) {
  const session = await requireAdmin();
  const params = await searchParams;

  // Admins see ALL active classes
  const allClasses = await db.query.classes.findMany({
    where: eq(classes.isActive, true),
    orderBy: [classes.displayOrder, classes.name],
  });

  const selectedClassId =
    allClasses.find((c) => c.id === params.classId)?.id ?? allClasses[0]?.id;

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
      const studentIds = classEnrollments.map((e) => e.studentId);

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

      studentList = studentsData.sort((a, b) =>
        a.firstName.localeCompare(b.firstName)
      );
      starsMap = Object.fromEntries(studentList.map((s) => [s.id, []]));
      for (const star of allStars) {
        starsMap[star.studentId]?.push(star);
      }
    }
  }

  const allVisibleStars = Object.values(starsMap).flat();
  const totalBlue  = allVisibleStars.filter((s) => s.type === "blue").length;
  const totalBlack = allVisibleStars.filter((s) => s.type === "black").length;

  const selectedClass = allClasses.find((c) => c.id === selectedClassId);

  return (
    <div>
      <PageHeader
        title="Stars"
        description="Award or remove blue / black stars for any student across all classes"
        breadcrumbs={[{ label: "Admin" }, { label: "Stars" }]}
      />

      {/* ── Legend ──────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Star size={14} fill="currentColor" className="text-blue-600" />
          <span>
            <strong className="text-blue-700">Blue Star</strong> — Good behaviour or performance
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <StarOff size={14} className="text-gray-800" />
          <span>
            <strong className="text-gray-800">Black Star</strong> — Bad behaviour or warning
          </span>
        </span>
      </div>

      {/* ── Class Tabs ──────────────────────────────────────────── */}
      {allClasses.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {allClasses.map((cls) => (
            <a
              key={cls.id}
              href={`/admin/stars?classId=${cls.id}`}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors font-dm-sans ${
                selectedClassId === cls.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cls.name}
            </a>
          ))}
        </div>
      )}

      {/* ── Class Summary Banner ────────────────────────────────── */}
      {studentList.length > 0 && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-foreground font-inter">
              {selectedClass?.name ?? "Class"} — Star Summary
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground font-dm-sans">
              {studentList.length} active student{studentList.length !== 1 ? "s" : ""}
            </p>
          </div>
          <StarSummary blue={totalBlue} black={totalBlack} size="md" />
        </div>
      )}

      {/* ── Student Cards ───────────────────────────────────────── */}
      {allClasses.length === 0 ? (
        <div className="rounded-xl border border-border p-14 text-center text-sm text-muted-foreground">
          No active classes found. Create a class first.
        </div>
      ) : studentList.length === 0 ? (
        <div className="rounded-xl border border-border p-14 text-center text-sm text-muted-foreground">
          No active students enrolled in this class.
        </div>
      ) : (
        <div className="space-y-3">
          {studentList.map((student) => (
            <AwardStarForm
              key={student.id}
              student={student}
              existingStars={starsMap[student.id] ?? []}
              currentUserId={session.user.id}
              canRemoveAny={true}   // admins & super_admins can remove any star
            />
          ))}
        </div>
      )}
    </div>
  );
}
