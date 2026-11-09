import { requireAdmin } from "@/lib/auth/helpers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { examinations, examSessions, classes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SubjectManager, GradeRulesManager, PublishControls } from "@/components/exams/exam-detail-panels";
import { getTrackSubjectCatalogue } from "@/lib/exams/track-subjects";
import Link from "next/link";
import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { EditSessionDatesModal } from "@/components/exams/edit-session-dates-modal";

interface Props { 
  params: Promise<{ id: string }>;
  searchParams: Promise<{ track?: string }>;
}

export default async function ExamDetailPage({ params, searchParams }: Props) {
  await requireAdmin();
  const session = await auth();
  const { id } = await params;
  const { track: urlTrack } = await searchParams;

  const examination = await db.query.examinations.findFirst({
    where: eq(examinations.id, id),
    with: {
      academicYear: true,
      examSessions: {
        with: {
          subjects: { with: { class: true } },
          gradeRules: { orderBy: (r, { asc }) => [asc(r.displayOrder)] },
        },
      },
    },
  });

  if (!examination) notFound();

  const isSuperAdmin = session?.user?.role === "super_admin";

  const TRACK_COLOR: Record<string, string> = {
    school:  "bg-blue-500/10 text-blue-600 border-blue-500/20",
    madrasa: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    hifz:    "bg-purple-500/10 text-purple-600 border-purple-500/20",
  };

  const activeTrackName = urlTrack || (examination.examSessions.length > 0 ? examination.examSessions[0].track : null);
  const activeSession = examination.examSessions.find(s => s.track === activeTrackName);

  let trackClasses: any[] = [];
  let catalogue: Awaited<ReturnType<typeof getTrackSubjectCatalogue>> = { ready: true, subjects: [] };
  if (activeSession) {
    catalogue = await getTrackSubjectCatalogue(activeSession.track);
    trackClasses = await db.query.classes.findMany({
      where: and(eq(classes.track, activeSession.track as "school" | "madrasa" | "hifz"), eq(classes.isActive, true)),
      orderBy: (c, { asc }) => [asc(c.displayOrder)],
    });
  }

  return (
    <div>
      <PageHeader
        title={examination.name}
        description={`${examination.academicYear?.label} · ${examination.examSessions.length} tracks included`}
        breadcrumbs={[
          { label: "Admin" },
          { label: "Exams", href: "/admin/exams" },
          { label: examination.name },
        ]}
        action={
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/exams/${id}/progress-cards`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors shadow-sm"
            >
              <FileText size={14} /> Generate Progress Cards
            </Link>
          </div>
        }
      />

      {/* Info bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Status</p>
          <p className="font-medium text-sm capitalize">{examination.status}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Academic Year</p>
          <p className="font-medium text-sm">{examination.academicYear?.label ?? "—"}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Overall Examination Period</p>
          <p className="font-medium text-sm">{examination.startDate ?? "—"} → {examination.endDate ?? "—"}</p>
        </div>
      </div>

      {examination.examSessions.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          No tracks initialized for this examination.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-border mb-6">
            {examination.examSessions.map(session => {
              const isActive = session.track === activeTrackName;
              return (
                <Link
                  key={session.id}
                  href={`/admin/exams/${id}?track=${session.track}`}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <span className="capitalize">{session.track}</span>
                </Link>
              );
            })}
          </div>

          {activeSession && (
            <>
              {/* Toolbar for active track */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between bg-muted/30 p-4 rounded-lg border border-border gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${TRACK_COLOR[activeSession.track]}`}>
                      {activeSession.track}
                    </span>
                    <p className="text-sm font-medium whitespace-nowrap">{activeSession.name}</p>
                  </div>
                  <div className="h-4 w-px bg-border hidden sm:block"></div>
                  <div className="flex items-center gap-3 bg-background border border-border px-3 py-1.5 rounded-md">
                    <div className="text-sm whitespace-nowrap">
                      <span className="text-muted-foreground text-xs mr-2">Examination Period:</span>
                      <span className="font-medium">{activeSession.startDate || "Not scheduled"} → {activeSession.endDate || "Not scheduled"}</span>
                    </div>
                    <div className="h-4 w-px bg-border"></div>
                    <EditSessionDatesModal 
                      sessionId={activeSession.id} 
                      initialStart={activeSession.startDate} 
                      initialEnd={activeSession.endDate} 
                      trackName={activeSession.track} 
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PublishControls
                    examSessionId={activeSession.id}
                    resultStatus={activeSession.resultStatus}
                    isSuperAdmin={isSuperAdmin}
                  />
                  {activeSession.track === "school" && (
                    <Link
                      href={`/admin/exams/${activeSession.id}/halltickets`}
                      className="px-3 py-1.5 border border-border bg-background text-xs font-medium rounded hover:bg-muted transition-colors"
                    >
                      🎫 Hall Tickets
                    </Link>
                  )}
                  <Link
                    href={`/admin/exams/${activeSession.id}/results`}
                    className="px-3 py-1.5 border border-border bg-background text-xs font-medium rounded hover:bg-muted transition-colors"
                  >
                    View Results
                  </Link>
                  <Link
                    href={`/admin/exams/${activeSession.id}/marks`}
                    className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors"
                  >
                    Enter Marks →
                  </Link>
                </div>
              </div>

              {trackClasses.length === 0 ? (
                <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
                  No active {activeSession.track} classes found. Create classes first in Settings.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Subjects section */}
                  <div className="bg-card border border-border rounded-lg">
                    <div className="px-6 py-4 border-b border-border">
                      <h2 className="font-playfair text-base font-semibold">Subjects per Class</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Select a class to manage its subjects for this exam</p>
                    </div>
                    <div className="p-6">
                      <SubjectManager
                        key={activeSession.id}
                        examSessionId={activeSession.id}
                        track={activeSession.track}
                        catalogue={catalogue.subjects}
                        catalogueReady={catalogue.ready}
                        classes={trackClasses.map(c => ({ id: c.id, name: c.name, track: c.track }))}
                        initialSubjects={activeSession.subjects.map(s => ({
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
                      <p className="text-xs text-muted-foreground mt-0.5">Define how marks convert to grades for this track</p>
                    </div>
                    <div className="p-6">
                      <GradeRulesManager
                        key={activeSession.id}
                        examSessionId={activeSession.id}
                        initialRules={activeSession.gradeRules.map(r => ({
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
