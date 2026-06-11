import { requireSchoolAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, academicYears } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default async function SchoolAdminDashboard() {
  await requireSchoolAdmin();

  // Fetch active academic year
  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isCurrent, true),
  });

  // Fetch school exams for the active year
  const exams = await db.query.examSessions.findMany({
    where: activeYear
      ? and(eq(examSessions.track, "school"), eq(examSessions.academicYearId, activeYear.id))
      : eq(examSessions.track, "school"),
    orderBy: [desc(examSessions.createdAt)],
    with: {
      subjects: {
        with: {
          class: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="School Admin Dashboard"
        description={activeYear ? `Exams for ${activeYear.label}` : "Manage school exams and mark entry"}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exams.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
            No school exams found for the current academic year.
          </div>
        ) : (
          exams.map((exam) => {
            // Get unique classes for this exam based on assigned subjects
            const classIds = new Set<string>();
            const uniqueClasses: { id: string; name: string }[] = [];
            
            exam.subjects.forEach((sub) => {
              if (sub.class && !classIds.has(sub.class.id)) {
                classIds.add(sub.class.id);
                uniqueClasses.push({ id: sub.class.id, name: sub.class.name });
              }
            });

            // Sort classes by name
            uniqueClasses.sort((a, b) => a.name.localeCompare(b.name));

            return (
              <Card key={exam.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{exam.name}</CardTitle>
                      <CardDescription>
                        {exam.startDate ? format(new Date(exam.startDate), "MMM d, yyyy") : "No date set"}
                      </CardDescription>
                    </div>
                    <Badge variant={exam.resultStatus === "published" ? "default" : "secondary"}>
                      {exam.resultStatus === "published" ? "Published" : "Draft"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Classes:</h4>
                    {uniqueClasses.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No subjects assigned yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {uniqueClasses.map((cls) => (
                          <Link key={cls.id} href={`/school-admin/exams/${exam.id}/marks/${cls.id}`}>
                            <Badge variant="outline" className="hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors">
                              {cls.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {exam.resultStatus === "draft" && uniqueClasses.length > 0 && (
                    <div className="mt-auto pt-4 text-sm text-muted-foreground border-t">
                      Select a class above to enter marks.
                    </div>
                  )}
                  {exam.resultStatus === "published" && (
                    <div className="mt-auto pt-4 text-sm text-amber-600 border-t flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Results published. Marks are locked.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
