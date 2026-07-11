import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { ExamActions } from "@/components/exams/exam-actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Exams" };

const TRACK_COLORS: Record<string, string> = {
  school:  "bg-blue-500/10 text-blue-600 border-blue-500/20",
  madrasa: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  hifz:    "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-muted text-muted-foreground",
  ongoing:   "bg-yellow-500/10 text-yellow-600",
  completed: "bg-green-500/10 text-green-600",
  cancelled: "bg-red-500/10 text-red-600",
};

export default async function ExamsPage() {
  await requireAdmin();

  const sessions = await db.query.examSessions.findMany({
    with: { academicYear: true },
    orderBy: [desc(examSessions.createdAt)],
  });

  const grouped = {
    school:  sessions.filter(s => s.track === "school"),
    madrasa: sessions.filter(s => s.track === "madrasa"),
    hifz:    sessions.filter(s => s.track === "hifz"),
  };

  return (
    <div>
      <PageHeader
        title="Exams"
        description="Manage exam sessions, subjects, and results"
        breadcrumbs={[{ label: "Admin" }, { label: "Exams" }]}
        action={
          <Link
            href="/admin/exams/new"
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:bg-primary/90 transition-colors"
          >
            + Create Exam
          </Link>
        }
      />

      {sessions.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-16 text-center">
          <p className="text-muted-foreground text-sm mb-4">No exam sessions yet.</p>
          <Link href="/admin/exams/new" className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-sm">
            Create First Exam
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {(["school", "madrasa", "hifz"] as const).map((track) => {
            const items = grouped[track];
            if (items.length === 0) return null;
            return (
              <div key={track}>
                <h2 className="font-playfair text-lg font-semibold capitalize mb-3">{track} Exams</h2>
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Academic Year</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Dates</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Results</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((exam) => (
                        <tr key={exam.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3 font-medium">{exam.name}</td>
                          <td className="px-5 py-3 text-muted-foreground">{exam.academicYear?.label ?? "—"}</td>
                          <td className="px-5 py-3 text-muted-foreground font-jetbrains text-xs">
                            {exam.startDate ?? "—"} {exam.endDate ? `→ ${exam.endDate}` : ""}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[exam.status ?? "scheduled"]}`}>
                              {exam.status}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                              exam.resultStatus === "published"
                                ? "bg-green-500/10 text-green-600 border-green-500/20"
                                : "bg-muted text-muted-foreground border-border"
                            }`}>
                              {exam.resultStatus === "published" ? "Published" : "Draft"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <ExamActions
                              examId={exam.id}
                              examName={exam.name}
                              resultStatus={exam.resultStatus}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
