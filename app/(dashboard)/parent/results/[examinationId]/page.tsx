import { requireParent, getParentStudentId } from "@/lib/auth/helpers";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeft, FileText } from "lucide-react";
import Link from "next/link";
import { getPublishedResultsForStudent } from "@/lib/exams/parent-results";

const TRACK_LABEL = { school: "School", madrasa: "Madrasa", hifz: "Hifz" } as const;

export default async function ParentResultDetailPage({
  params,
}: {
  params: Promise<{ examinationId: string }>;
}) {
  await requireParent();
  // Always the logged-in parent's own child; the URL cannot select another student.
  const studentId = await getParentStudentId();
  const { examinationId } = await params;

  const result = await getPublishedResultsForStudent(examinationId, studentId);
  // Unknown exam, or nothing published for this student → indistinguishable 404.
  if (!result || result.tracks.length === 0) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/parent/results" className={buttonVariants({ variant: "outline", size: "icon" })}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <PageHeader title={result.examName} description="Published examination results" />
      </div>

      {result.tracks.map((t) => (
        <div key={t.track} className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2 font-semibold">
            <FileText size={15} /> {TRACK_LABEL[t.track]}
          </div>
          {t.subjects.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-5 py-2">Subject</th>
                  <th className="text-right px-5 py-2">Max</th>
                  <th className="text-right px-5 py-2">Marks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {t.subjects.map((s) => (
                  <tr key={s.name}>
                    <td className="px-5 py-2">{s.name}</td>
                    <td className="px-5 py-2 text-right">{s.maxMark}</td>
                    <td className="px-5 py-2 text-right font-medium">{s.scored ?? "—"}</td>
                  </tr>
                ))}
                <tr className="bg-muted/20 font-semibold">
                  <td className="px-5 py-2">Total</td>
                  <td className="px-5 py-2 text-right">{t.totalMax}</td>
                  <td className="px-5 py-2 text-right">{t.totalScored}</td>
                </tr>
              </tbody>
            </table>
          )}
          {t.hifz && (
            <div className="px-5 py-3 text-sm grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-border">
              <div>Juz memorized: <b>{t.hifz.memorizedJuz ?? "—"}</b></div>
              <div>Juz to be obtained: <b>{t.hifz.toBeObtained ?? "—"}</b></div>
              <div>Remarks: <b>{t.hifz.remarks ?? "—"}</b></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
