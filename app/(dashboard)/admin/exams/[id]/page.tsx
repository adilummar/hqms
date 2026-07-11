import { requireAdmin } from "@/lib/auth/helpers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { examSessions, classes, enrollments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SubjectManager, GradeRulesManager, PublishControls } from "@/components/exams/exam-detail-panels";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Exam Detail" };

interface Props { params: Promise<{ id: string }>; }

export default async function ExamDetailPage({ params }: Props) {
  await requireAdmin();
  const session = await auth();
  const { id } = await params;

  const exam = await db.query.examSessions.findFirst({
    where: eq(examSessions.id, id),
    with: {
      academicYear: true,
      subjects: { with: { class: true } },
      gradeRules: { orderBy: (r, { asc }) => [asc(r.displayOrder)] },
    },
  });

  if (!exam) notFound();

  // Get all classes that match this exam's track
  const trackClasses = await db.query.classes.findMany({
    where: and(eq(classes.track, exam.track as "school" | "madrasa" | "hifz"), eq(classes.isActive, true)),
    orderBy: (c, { asc }) => [asc(c.displayOrder)],
  });

  const isSuperAdmin = session?.user?.role === "super_admin";

  const TRACK_COLOR: Record<string, string> = {
    school:  "bg-blue-500/10 text-blue-600",
    madrasa: "bg-emerald-500/10 text-emerald-600",
    hifz:    "bg-purple-500/10 text-purple-600",
  };

  return (
    <div>
      <PageHeader
        title={exam.name}
        description={`${exam.academicYear?.label} · ${exam.track} exam`}
        breadcrumbs={[
          { label: "Admin" },
          { label: "Exams", href: "/admin/exams" },
          { label: exam.name },
        ]}
        action={
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${TRACK_COLOR[exam.track]}`}>
              {exam.track}
            </span>
            <Link
              href={`/admin/exams/${id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded hover:bg-muted transition-colors"
            >
              ✎ Edit Exam
            </Link>
            <PublishControls
              examSessionId={exam.id}
              resultStatus={exam.resultStatus}
              isSuperAdmin={isSuperAdmin}
            />
          </div>
        }
      />

      {/* Info bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Track", value: exam.track.charAt(0).toUpperCase() + exam.track.slice(1) },
          { label: "Academic Year", value: exam.academicYear?.label ?? "—" },
          { label: "Start Date", value: exam.startDate ?? "—" },
          { label: "End Date", value: exam.endDate ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-medium text-sm">{value}</p>
          </div>
        ))}
      </div>

      {trackClasses.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          No active {exam.track} classes found. Create classes first in Settings.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subjects section */}
          <div className="bg-card border border-border rounded-lg">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-playfair text-base font-semibold">Subjects per Class</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Select a class to manage its subjects for this exam</p>
              </div>
              <div className="flex items-center gap-2">
                {exam.track === "school" && (
                  <Link
                    href={`/admin/exams/${id}/halltickets`}
                    className="px-3 py-1.5 border border-border text-xs font-medium rounded hover:bg-muted transition-colors flex items-center gap-1.5"
                  >
                    🎫 Hall Tickets
                  </Link>
                )}
                <Link
                  href={`/admin/exams/${id}/results`}
                  className="px-3 py-1.5 border border-border text-xs font-medium rounded hover:bg-muted transition-colors"
                >
                  View Results
                </Link>
                <Link
                  href={`/admin/exams/${id}/marks`}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors"
                >
                  Enter Marks →
                </Link>
              </div>
            </div>
            <div className="p-6">
              <SubjectManager
                examSessionId={exam.id}
                classes={trackClasses.map(c => ({ id: c.id, name: c.name, track: c.track }))}
                initialSubjects={exam.subjects.map(s => ({
                  id: s.id,
                  classId: s.classId,
                  name: s.name,
                  totalMarks: s.totalMarks,
                  passMarks: s.passMarks,
                  displayOrder: s.displayOrder ?? 0,
                  examDate: s.examDate ?? null,
                }))}
              />
            </div>
          </div>

          {/* Grade rules section */}
          <div className="bg-card border border-border rounded-lg">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-playfair text-base font-semibold">Grade Rules</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Define how marks convert to grades for this exam</p>
            </div>
            <div className="p-6">
              <GradeRulesManager
                examSessionId={exam.id}
                initialRules={exam.gradeRules.map(r => ({
                  grade: r.grade,
                  minPercentage: Number(r.minPercentage),
                  label: r.label ?? "",
                  isFailing: r.isFailing,
                  displayOrder: r.displayOrder ?? 0,
                }))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
