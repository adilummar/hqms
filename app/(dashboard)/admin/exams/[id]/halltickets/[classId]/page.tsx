import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, classes, examSubjects, enrollments } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { HallTicket } from "@/components/exams/hall-ticket";
import { HallTicketPrintBar } from "@/components/exams/hall-ticket-print-bar";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hall Tickets — Print" };

export default async function HallTicketsPrintPage({
  params,
}: {
  params: Promise<{ id: string; classId: string }>;
}) {
  await requireAdmin();
  const { id, classId } = await params;

  const [exam, cls] = await Promise.all([
    db.query.examSessions.findFirst({
      where: eq(examSessions.id, id),
      with: { academicYear: true },
    }),
    db.query.classes.findFirst({ where: eq(classes.id, classId) }),
  ]);

  if (!exam || !cls) notFound();
  if (exam.track !== "school") notFound();

  // Fetch subjects for this class
  const subjects = await db.query.examSubjects.findMany({
    where: and(
      eq(examSubjects.examSessionId, id),
      eq(examSubjects.classId, classId)
    ),
    orderBy: [asc(examSubjects.displayOrder)],
  });

  // Fetch enrolled students for this class/academic year
  const classEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.classId, classId),
      eq(enrollments.status, "active"),
      eq(enrollments.academicYearId, exam.academicYearId)
    ),
    with: { student: true },
  });

  const students = classEnrollments
    .map((e) => e.student)
    .sort((a, b) => a.firstName.localeCompare(b.firstName));

  const subjectData = subjects.map((s) => ({
    name: s.name,
    examDate: s.examDate ?? null,
    displayOrder: s.displayOrder ?? 0,
  }));

  return (
    <>
      {/* Print control bar — hidden during print */}
      <HallTicketPrintBar
        examName={exam.name}
        className={cls.name}
        studentCount={students.length}
        backHref={`/admin/exams/${id}/halltickets`}
      />

      {/* Print styles injected globally */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .hall-ticket-page {
            page-break-after: always;
            border: none !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Hall ticket cards */}
      <div className="no-print mb-4 text-sm text-muted-foreground px-1">
        Showing {students.length} hall ticket{students.length !== 1 ? "s" : ""} for <strong>{cls.name}</strong>
      </div>

      <div>
        {students.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl no-print">
            <p className="font-medium">No enrolled students found</p>
            <p className="text-sm mt-1">Make sure students are enrolled in {cls.name} for {exam.academicYear?.label}.</p>
          </div>
        ) : (
          students.map((student, index) => (
            <HallTicket
              key={student.id}
              examName={exam.name}
              academicYear={exam.academicYear?.label ?? ""}
              student={{
                firstName: student.firstName,
                lastName: student.lastName ?? null,
                admissionNumber: student.admissionNumber ?? null,
                studentCode: student.studentCode,
                photoUrl: student.photoUrl ?? null,
              }}
              className={cls.name}
              subjects={subjectData}
              index={index}
            />
          ))
        )}
      </div>
    </>
  );
}
