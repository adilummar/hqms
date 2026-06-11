import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, examSubjects, classes } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ClassResultReport } from "@/components/exams/class-result-report";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function AdminExamResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const exam = await db.query.examSessions.findFirst({
    where: eq(examSessions.id, id),
  });

  if (!exam) notFound();

  // Find all subjects for this exam to know which classes are involved
  const subjects = await db.query.examSubjects.findMany({
    where: eq(examSubjects.examSessionId, id),
  });

  const classIds = [...new Set(subjects.map(s => s.classId))];

  let examClasses: typeof classes.$inferSelect[] = [];
  if (classIds.length > 0) {
    examClasses = await db.query.classes.findMany({
      where: inArray(classes.id, classIds),
    });
    // Sort classes by name
    examClasses.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/exams/${exam.id}`} className={buttonVariants({ variant: "outline", size: "icon" })}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={`Results: ${exam.name}`}
          description={`${exam.track} track`}
        />
      </div>

      {examClasses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
          No classes have subjects assigned to this exam yet.
        </div>
      ) : (
        <Tabs defaultValue={examClasses[0].id} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto w-full justify-start gap-2 bg-transparent p-0">
            {examClasses.map(cls => (
              <TabsTrigger 
                key={cls.id} 
                value={cls.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
              >
                {cls.name}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {examClasses.map(cls => (
            <TabsContent key={cls.id} value={cls.id} className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">{cls.name} — Full Results</h3>
                <Link href={`/admin/exams/${exam.id}/marks/${cls.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  View/Edit Marks
                </Link>
              </div>
              <ClassResultReport examSessionId={exam.id} classId={cls.id} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
