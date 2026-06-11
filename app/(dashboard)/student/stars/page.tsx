import { requireStudent, getStudentProfileId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { studentStars } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { StarHistoryTable } from "@/components/stars/star-history-table";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Stars | Student Portal" };

export default async function StudentStarsPage() {
  await requireStudent();
  const studentId = await getStudentProfileId();

  const stars = await db.query.studentStars.findMany({
    where: eq(studentStars.studentId, studentId),
    with: { awardedByUser: { columns: { username: true } } },
    orderBy: [desc(studentStars.awardedAt)],
  });

  const blueCount = stars.filter((s) => s.type === "blue").length;
  const blackCount = stars.filter((s) => s.type === "black").length;

  return (
    <div className="space-y-6">
      <PageHeader title="My Stars" description="Stars awarded by your teacher" />

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex items-center gap-4">
          <span className="text-4xl">⭐</span>
          <div>
            <p className="text-3xl font-playfair font-bold text-blue-700">{blueCount}</p>
            <p className="text-sm text-blue-600 font-medium">Blue Stars</p>
            <p className="text-xs text-blue-500 mt-0.5">Good performance</p>
          </div>
        </div>
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-5 flex items-center gap-4">
          <span className="text-4xl">🌑</span>
          <div>
            <p className="text-3xl font-playfair font-bold text-gray-700">{blackCount}</p>
            <p className="text-sm text-gray-600 font-medium">Black Stars</p>
            <p className="text-xs text-gray-500 mt-0.5">Need to improve</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-playfair text-lg font-semibold mb-4">History</h3>
        <StarHistoryTable stars={stars as any} />
      </div>
    </div>
  );
}
