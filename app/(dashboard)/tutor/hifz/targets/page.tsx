import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { classes } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { MonthlyTargetsView } from "@/components/hifz/monthly-targets-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Monthly Targets & Toppers" };

interface Props {
  searchParams: Promise<{ month?: string; year?: string; classId?: string }>;
}

export default async function TutorHifzTargetsPage({ searchParams }: Props) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const params = await searchParams;

  const now = new Date();
  const year = parseInt(params.year ?? String(now.getFullYear()), 10);
  const month = parseInt(params.month ?? String(now.getMonth() + 1), 10);
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const hifzClasses = await db.query.classes.findMany({
    where: and(
      eq(classes.track, "hifz"),
      eq(classes.isActive, true),
      eq(classes.tutorId, session.user.id)
    ),
    orderBy: [asc(classes.displayOrder), asc(classes.name)],
  });

  return (
    <div>
      <PageHeader
        title="Monthly Targets & Toppers"
        description={`Hifz progress for ${monthName}`}
        breadcrumbs={[{ label: "Tutor" }, { label: "Hifz" }, { label: "Targets" }]}
      />
      <MonthlyTargetsView
        hifzClasses={hifzClasses}
        year={year}
        month={month}
        selectedClassId={params.classId}
      />
    </div>
  );
}
