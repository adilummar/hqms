import { requireStudent, getStudentProfileId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, enrollments, examSubjects, studentStars } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, Trophy } from "lucide-react";
import { StarSummary } from "@/components/stars/star-summary";

export default async function StudentDashboard() {
  await requireStudent();
  const studentId = await getStudentProfileId();

  // Find classes the student is enrolled in
  const studentEnrollments = await db.query.enrollments.findMany({
    where: eq(enrollments.studentId, studentId),
  });

  const enrolledClassIds = studentEnrollments.map((e) => e.classId);

  // If no enrollments, show empty state
  if (enrolledClassIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Dashboard" description="View your progress and results" />
        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
          You are not currently enrolled in any classes.
        </div>
      </div>
    );
  }

  // Find subjects assigned to these classes
  const relevantSubjects = await db.query.examSubjects.findMany({
    where: inArray(examSubjects.classId, enrolledClassIds),
  });

  const examSessionIds = [...new Set(relevantSubjects.map((s) => s.examSessionId))];

  // Fetch ONLY published exams
  let exams: typeof examSessions.$inferSelect[] = [];
  if (examSessionIds.length > 0) {
    exams = await db.query.examSessions.findMany({
      where: and(
        inArray(examSessions.id, examSessionIds),
        eq(examSessions.resultStatus, "published")
      ),
      orderBy: [desc(examSessions.createdAt)],
    });
  }

  const stars = await db.query.studentStars.findMany({
    where: eq(studentStars.studentId, studentId),
    columns: { type: true },
  });
  const blueStars = stars.filter((s) => s.type === "blue").length;
  const blackStars = stars.filter((s) => s.type === "black").length;

  return (
    <div className="space-y-6">
      <PageHeader title="My Dashboard" description="View your exam results" />

      {/* Stars summary */}
      {(blueStars > 0 || blackStars > 0) && (
        <Link href="/student/stars">
          <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:border-foreground/30 transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground">My Stars</p>
              <p className="text-xs text-muted-foreground mt-0.5">Behaviour & performance awards</p>
            </div>
            <StarSummary blue={blueStars} black={blackStars} size="md" />
          </div>
        </Link>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Exam Results
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              No exam results have been published yet.
            </div>
          ) : (
            exams.map((exam) => (
              <Link key={exam.id} href={`/student/results/${exam.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg text-primary">{exam.name}</CardTitle>
                        <CardDescription>
                          {exam.startDate ? format(new Date(exam.startDate), "MMMM yyyy") : ""}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {exam.track}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      View detailed subject marks & grades
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
