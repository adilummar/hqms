import { requireTutor, getSession } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, hifzDailyEntries, juzTracker } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { HifzEntryForm } from "@/components/hifz/hifz-entry-form";
import { HafizModeToggle } from "@/components/hifz/hafiz-mode-toggle";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Daily Hifz Entry Form" };

interface Props {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ date?: string }>;
}

export default async function HifzEntryPage({ params, searchParams }: Props) {
  await requireTutor();
  const { studentId } = await params;
  const { date } = await searchParams;

  const today = new Date().toISOString().split("T")[0];
  const targetDate = date ?? today;

  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
  });

  if (!student) return notFound();

  const session = await getSession();
  const canRevert =
    session?.user.role === "admin" || session?.user.role === "super_admin";

  const [existingEntry, activeJuz, allRemarks, completedJuz] = await Promise.all([
    db.query.hifzDailyEntries.findFirst({
      where: and(
        eq(hifzDailyEntries.studentId, studentId),
        eq(hifzDailyEntries.date, targetDate)
      ),
    }),
    db.query.juzTracker.findFirst({
      where: and(
        eq(juzTracker.studentId, studentId),
        eq(juzTracker.status, "in_progress")
      ),
    }),
    db.query.remarksOptions.findMany(),
    db
      .select({ value: count() })
      .from(juzTracker)
      .where(
        and(eq(juzTracker.studentId, studentId), eq(juzTracker.status, "completed"))
      ),
  ]);

  const completedJuzCount = completedJuz[0]?.value ?? 0;

  const sabaqRemarks = allRemarks.filter(r => r.category === "sabaq").sort((a,b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const sabaqJuzRemarks = allRemarks.filter(r => r.category === "sabaq_juz").sort((a,b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const dauraRemarks = allRemarks.filter(r => r.category === "daura").sort((a,b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={`Entry for ${student.firstName} ${student.lastName ?? ""}`}
        description={`Date: ${targetDate} | ID: ${student.studentCode}`}
        breadcrumbs={[
          { label: "Tutor" },
          { label: "Hifz Entry", href: "/tutor/hifz" },
          { label: "Form" },
        ]}
      />
      
      <HafizModeToggle
        studentId={student.id}
        isHafiz={student.isHafiz}
        completedJuzCount={completedJuzCount}
        canRevert={canRevert}
      />

      <HifzEntryForm
        studentId={student.id}
        date={targetDate}
        existingEntry={existingEntry}
        activeJuz={activeJuz}
        sabaqRemarks={sabaqRemarks}
        sabaqJuzRemarks={sabaqJuzRemarks}
        dauraRemarks={dauraRemarks}
        isHafiz={student.isHafiz}
      />
    </div>
  );
}
