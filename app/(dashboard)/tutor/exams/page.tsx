import { requireTutor } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, classes, examSubjects } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, Lock } from "lucide-react";

export default async function TutorExamsDashboard() {
  const session = await requireTutor();

  // Find ALL classes assigned to this tutor (no year filter — classes may span years)
  const tutorClasses = await db.query.classes.findMany({
    where: eq(classes.tutorId, session.user.id),
  });

  const classIds = tutorClasses.map((c) => c.id);

  if (classIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Exams" description="Manage marks for your classes" />
        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
          <FileText className="mx-auto w-10 h-10 mb-3 opacity-40" />
          <p className="font-medium">No classes assigned</p>
          <p className="text-sm mt-1">You are not assigned as a tutor to any classes yet.</p>
        </div>
      </div>
    );
  }

  // Find subjects assigned to these classes across any exam
  const assignedSubjects = await db.query.examSubjects.findMany({
    where: inArray(examSubjects.classId, classIds),
  });

  const examSessionIds = [...new Set(assignedSubjects.map((s) => s.examSessionId))];

  // Fetch those exams
  let exams: typeof examSessions.$inferSelect[] = [];
  if (examSessionIds.length > 0) {
    exams = await db.query.examSessions.findMany({
      where: inArray(examSessions.id, examSessionIds),
      orderBy: [desc(examSessions.createdAt)],
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Exams" description="Enter and view marks for your classes" />

      {exams.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
          <FileText className="mx-auto w-10 h-10 mb-3 opacity-40" />
          <p className="font-medium">No exams assigned yet</p>
          <p className="text-sm mt-1">Your classes have no subjects assigned to any exam yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exams.map((exam) => {
            // Find which of the tutor's classes have subjects in this exam
            const examClassIds = new Set(
              assignedSubjects
                .filter((s) => s.examSessionId === exam.id)
                .map((s) => s.classId)
            );

            const relevantClasses = tutorClasses.filter((c) => examClassIds.has(c.id));
            const isPublished = exam.resultStatus === "published";

            return (
              <Card key={exam.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{exam.name}</CardTitle>
                      <CardDescription>
                        {exam.startDate
                          ? format(new Date(exam.startDate), "MMM d, yyyy")
                          : "No date set"}{" "}
                        · <span className="capitalize">{exam.track}</span>
                      </CardDescription>
                    </div>
                    <Badge variant={isPublished ? "default" : "secondary"}>
                      {isPublished ? "Published" : "Draft"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col gap-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Your Classes
                  </p>
                  <div className="flex flex-col gap-2">
                    {relevantClasses.map((cls) => (
                      <div
                        key={cls.id}
                        className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                      >
                        <div>
                          <span className="font-medium text-sm">{cls.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground capitalize">
                            {cls.track}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/tutor/exams/${exam.id}/marks/${cls.id}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {isPublished ? "View Marks" : "Enter Marks →"}
                          </Link>
                          {isPublished && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <Link
                                href={`/tutor/exams/${exam.id}/results/${cls.id}`}
                                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                              >
                                Ranking
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {isPublished && (
                    <div className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-amber-600">
                      <Lock className="w-3 h-3" />
                      Results published — mark entry locked
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
