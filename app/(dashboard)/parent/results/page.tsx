import { requireParent, getParentStudentId } from "@/lib/auth/helpers";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { Trophy, FileText } from "lucide-react";
import { format } from "date-fns";
import { listPublishedExamsForStudent } from "@/lib/exams/parent-results";

export const metadata = { title: "Exam Results" };

export default async function ParentResultsPage() {
  await requireParent();
  const studentId = await getParentStudentId();

  // Only examinations with at least one published track for this child's classes.
  const exams = await listPublishedExamsForStudent(studentId);

  return (
    <div className="space-y-6">
      <PageHeader title="Exam Results" description="View your child's published examination results" />

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
                  <h4 className="font-semibold text-base text-foreground leading-tight">{exam.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {exam.startDate ? format(new Date(exam.startDate), "MMMM yyyy") : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4 pt-3 border-t border-border/50">
                  <FileText size={13} />
                  View published results
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
