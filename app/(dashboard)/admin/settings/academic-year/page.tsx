import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { academicYears, classes, enrollments } from "@/lib/db/schema";
import { eq, count, and } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { NewAcademicYearForm } from "@/components/academic-year/new-year-form";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Academic Year Management" };

export default async function AcademicYearPage() {
  const session = await requireRole(["admin", "super_admin"]);

  const allYears = await db.query.academicYears.findMany({
    orderBy: (ay, { desc }) => [desc(ay.createdAt)],
  });

  // Get class counts per year
  const classCounts = await db
    .select({ yearId: classes.academicYearId, count: count() })
    .from(classes)
    .where(eq(classes.isActive, true))
    .groupBy(classes.academicYearId);

  const classCountMap = new Map(classCounts.map((c) => [c.yearId, c.count]));

  // Get active enrollment counts per year
  const enrollmentCounts = await db
    .select({ yearId: enrollments.academicYearId, count: count() })
    .from(enrollments)
    .where(eq(enrollments.status, "active"))
    .groupBy(enrollments.academicYearId);

  const enrollmentCountMap = new Map(
    enrollmentCounts.map((e) => [e.yearId, e.count])
  );

  const currentYear = allYears.find((y) => y.isCurrent);
  const isSuperAdmin = session.user.role === "super_admin" || session.user.role === "admin";

  return (
    <div>
      <PageHeader
        title="Academic Year Management"
        description="Manage academic years and promote students"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Settings", href: "/admin/settings" },
          { label: "Academic Year" },
        ]}
      />

      {/* Current Year Banner */}
      {currentYear && (
        <div className="bg-card border border-border rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Current Academic Year</p>
              <p className="font-playfair text-2xl font-bold text-foreground">
                {currentYear.label}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(currentYear.startDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                →{" "}
                {new Date(currentYear.endDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="text-center px-4 py-2 border border-border rounded-sm">
                <p className="font-jetbrains font-semibold text-lg text-foreground">
                  {classCountMap.get(currentYear.id) ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Active Classes</p>
              </div>
              <div className="text-center px-4 py-2 border border-border rounded-sm">
                <p className="font-jetbrains font-semibold text-lg text-foreground">
                  {enrollmentCountMap.get(currentYear.id) ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Enrolled Students</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <Link
              href={`/admin/settings/academic-year/promote?yearId=${currentYear.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 border border-foreground text-sm font-medium rounded-sm hover:bg-foreground hover:text-background transition-colors"
            >
              🎓 Promote Students to This Year
            </Link>
          </div>
        </div>
      )}

      {/* Create New Year */}
      {isSuperAdmin && (
        <div className="mb-6">
          <NewAcademicYearForm />
        </div>
      )}

      {/* All Years Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 bg-muted/50 border-b border-border">
          <h3 className="font-playfair font-semibold text-sm">All Academic Years</h3>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">
                Year
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">
                Start Date
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">
                End Date
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">
                Classes
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">
                Students
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {allYears.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-muted-foreground"
                >
                  No academic years found. Create one to get started.
                </td>
              </tr>
            ) : (
              allYears.map((year) => (
                <tr key={year.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 font-jetbrains font-medium text-foreground">
                    {year.label}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(year.startDate).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(year.endDate).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-5 py-3 font-jetbrains">
                    {classCountMap.get(year.id) ?? 0}
                  </td>
                  <td className="px-5 py-3 font-jetbrains">
                    {enrollmentCountMap.get(year.id) ?? 0}
                  </td>
                  <td className="px-5 py-3">
                    {year.isCurrent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Current
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                        Past
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {year.isCurrent && (
                      <Link
                        href={`/admin/settings/academic-year/promote?yearId=${year.id}`}
                        className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors"
                      >
                        Promote Students →
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
