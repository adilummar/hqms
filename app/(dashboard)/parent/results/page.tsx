import { requireParent, getParentStudentId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, examSubjects, enrollments, examinations } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { Trophy, FileText } from "lucide-react";
import { format } from "date-fns";

export const metadata = { title: "Exam Results" };

export default async function ParentResultsPage() {
  await requireParent();
  const studentId = await getParentStudentId();

  // Find classes the student is enrolled in
  const studentEnrollments = await db.query.enrollments.findMany({
    where: eq(enrollments.studentId, studentId),
  });
  const enrolledClassIds = studentEnrollments.map((e) => e.classId);

  // Find subjects assigned to these classes
  let relevantSubjects: any[] = [];
  if (enrolledClassIds.length > 0) {
    relevantSubjects = await db.query.examSubjects.findMany({
      where: inArray(examSubjects.classId, enrolledClassIds),
    });
  }
  const examSessionIds = [...new Set(relevantSubjects.map((s) => s.examSessionId))];

  let relevantPublishedSessions: any[] = [];
  if (examSessionIds.length > 0) {
    relevantPublishedSessions = await db.query.examSessions.findMany({
      where: and(
        inArray(examSessions.id, examSessionIds),
        eq(examSessions.resultStatus, "published")
      ),
      columns: { examinationId: true }
    });
  }
  const publishedExaminationIds = [...new Set(relevantPublishedSessions.map((s) => s.examinationId))];

  const exams = publishedExaminationIds.length > 0
    ? await db.query.examinations.findMany({
        where: inArray(examinations.id, publishedExaminationIds),
        orderBy: [desc(examinations.createdAt)],
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Exam Results" 
        description="View your child's published term progress cards" 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exams.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed text-sm">
            <Trophy className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            No exam results have been published yet.
          </div>
        ) : (
          exams.map((exam) => (
            <Link key={exam.id} href={`/parent/results/${exam.id}`}>
              <div className="bg-card border border-border hover:border-foreground/30 transition-all rounded-lg p-5 cursor-pointer h-full shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-base text-foreground leading-tight">{exam.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {exam.startDate ? format(new Date(exam.startDate), "MMMM yyyy") : ""}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4 pt-3 border-t border-border/50">
                  <FileText size={13} />
                  View term progress card
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
