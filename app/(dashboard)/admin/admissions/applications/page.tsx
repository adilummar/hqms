import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { admissionApplications } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Applications" };

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function ApplicationsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const status = (params.status ?? "all") as "all" | "pending" | "shortlisted" | "selected" | "rejected";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 25;
  const offset = (page - 1) * limit;

  const whereClause =
    status !== "all"
      ? eq(admissionApplications.status, status)
      : undefined;

  const [applicationList, totalCount, pendingCount] = await Promise.all([
    db.query.admissionApplications.findMany({
      where: whereClause,
      orderBy: [desc(admissionApplications.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(admissionApplications).where(whereClause),
    db.select({ count: count() }).from(admissionApplications).where(
      eq(admissionApplications.status, "pending")
    ),
  ]);

  const total = totalCount[0]?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-800 border border-yellow-200",
    shortlisted: "bg-blue-50 text-blue-800 border border-blue-200",
    selected: "bg-green-50 text-green-800 border border-green-200",
    rejected: "bg-red-50 text-red-800 border border-red-200",
  };

  return (
    <div>
      <PageHeader
        title="Applications"
        description={`${pendingCount[0]?.count ?? 0} pending review`}
        breadcrumbs={[{ label: "Admin" }, { label: "Admissions" }, { label: "Applications" }]}
        action={
          <Link
            href="/apply"
            target="_blank"
            className="px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors"
          >
            Public Form ↗
          </Link>
        }
      />

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {(["all", "pending", "shortlisted", "selected", "rejected"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/admissions/applications?status=${s}`}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap ${
              status === s
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">App #</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Tracks</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Applied</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {applicationList.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No {status !== "all" ? status : ""} applications found
                </td>
              </tr>
            ) : (
              applicationList.map((app) => (
                <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-jetbrains text-xs text-muted-foreground">
                    {app.applicationNumber}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{app.applicantName}</p>
                    <p className="text-xs text-muted-foreground">{app.guardianPhone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {app.appliedTracks.map((track) => (
                        <span
                          key={track}
                          className="text-xs px-1.5 py-0.5 bg-muted border border-border rounded-sm capitalize"
                        >
                          {track}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-jetbrains text-xs text-muted-foreground">
                    {new Date(app.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-sm capitalize font-medium ${statusColors[app.status]}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/admissions/applications/${app.id}`}
                      className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`?status=${status}&page=${page - 1}`} className="px-3 py-1.5 text-sm border border-border rounded-sm hover:bg-muted transition-colors">
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={`?status=${status}&page=${page + 1}`} className="px-3 py-1.5 text-sm border border-border rounded-sm hover:bg-muted transition-colors">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
