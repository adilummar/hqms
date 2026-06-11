import { requireTutor } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, classes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ClassResultReport } from "@/components/exams/class-result-report";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function TutorExamResultPage({
  params,
}: {
  params: Promise<{ id: string; classId: string }>;
}) {
  const session = await requireTutor();
  const { id, classId } = await params;

  const exam = await db.query.examSessions.findFirst({
    where: eq(examSessions.id, id),
  });

  const cls = await db.query.classes.findFirst({
    where: eq(classes.id, classId),
  });

  if (!exam || !cls) notFound();

  // Verify access: tutor can only access their own class
  const isTutor = session.user.role === "tutor";
  if (isTutor && cls.tutorId !== session.user.id) {
    redirect("/unauthorized");
  }

  // Must be published to view ranking
  if (exam.resultStatus !== "published") {
    return (
      <div className="space-y-6">
        <PageHeader title="Results Not Available" />
        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
          These exam results have not been published yet.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tutor/exams" className={buttonVariants({ variant: "outline", size: "icon" })}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={`Class Ranking: ${cls.name}`}
          description={`${exam.name} • ${exam.track} track`}
        />
      </div>

      <ClassResultReport examSessionId={exam.id} classId={cls.id} />
    </div>
  );
}
