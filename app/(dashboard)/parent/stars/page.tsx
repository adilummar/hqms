import { requireParent, getParentStudentId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { studentStars } from "@/lib/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { StarSummary } from "@/components/stars/star-summary";
import { Star, StarOff } from "lucide-react";
import { StarHistoryTable } from "@/components/stars/star-history-table";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Stars | Parent Portal" };

export default async function ParentStarsPage() {
  await requireParent();
  const studentId = await getParentStudentId();

  const stars = await db.query.studentStars.findMany({
    where: and(
      eq(studentStars.studentId, studentId),
      isNull(studentStars.deletedAt)
    ),
    with: { awardedByUser: { columns: { username: true } } },
    orderBy: [desc(studentStars.awardedAt)],
  });

  const blueCount = stars
    .filter((s) => s.type === "blue")
    .reduce((sum, s) => sum + (s.value || 1), 0);
  const blackCount = stars
    .filter((s) => s.type === "black")
    .reduce((sum, s) => sum + (s.value || 1), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stars"
        description="Behaviour & performance stars awarded by teachers"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex items-center gap-4">
          <Star className="w-10 h-10 text-blue-600 drop-shadow-sm" fill="currentColor" />
          <div>
            <p className="text-3xl font-playfair font-bold text-blue-700">{blueCount}</p>
            <p className="text-sm text-blue-600 font-medium">Blue Stars</p>
            <p className="text-xs text-blue-500 mt-0.5">Good behaviour & performance</p>
          </div>
        </div>
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-5 flex items-center gap-4">
          <StarOff className="w-10 h-10 text-gray-800 drop-shadow-sm" />
          <div>
            <p className="text-3xl font-playfair font-bold text-gray-700">{blackCount}</p>
            <p className="text-sm text-gray-600 font-medium">Black Stars</p>
            <p className="text-xs text-gray-500 mt-0.5">Areas needing improvement</p>
          </div>
        </div>
      </div>

      {/* Full history */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-playfair text-lg font-semibold mb-4">Full History</h3>
        <StarHistoryTable stars={stars as any} />
      </div>
    </div>
  );
}
