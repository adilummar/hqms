import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { activityLogs } from "@/lib/db/schema";
import { desc, count } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Activity Log" };

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function ActivityLogPage({ searchParams }: Props) {
  await requireRole(["super_admin"]);
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const [logs, totalCount] = await Promise.all([
    db.query.activityLogs.findMany({
      with: { user: true },
      orderBy: [desc(activityLogs.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(activityLogs),
  ]);

  const total = totalCount[0]?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  const actionColor = (action: string) => {
    if (action.includes("delete") || action.includes("reject")) return "text-red-600";
    if (action.includes("create") || action.includes("complete")) return "text-green-600";
    if (action.includes("update") || action.includes("status")) return "text-blue-600";
    return "text-muted-foreground";
  };

  return (
    <div>
      <PageHeader
        title="Activity Log"
        description={`${total.toLocaleString()} total entries`}
        breadcrumbs={[{ label: "Admin" }, { label: "Settings" }, { label: "Activity Log" }]}
      />

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Timestamp</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Action</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Entity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  No activity logged yet
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-jetbrains text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit", hour12: false
                    })}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-foreground text-xs">{log.user?.username ?? "—"}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 bg-muted border border-border rounded-sm font-medium capitalize">
                      {log.user?.role?.replace("_", " ") ?? "—"}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-xs font-medium font-jetbrains ${actionColor(log.action)}`}>
                    {log.action}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-jetbrains">
                    {log.entityType && (
                      <span>
                        {log.entityType}
                        {log.entityId && (
                          <span className="ml-1 text-muted-foreground/60">
                            #{log.entityId.slice(0, 8)}
                          </span>
                        )}
                      </span>
                    )}
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
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={`?page=${page - 1}`} className="px-3 py-1.5 text-sm border border-border rounded-sm hover:bg-muted transition-colors">
                ← Previous
              </a>
            )}
            {page < totalPages && (
              <a href={`?page=${page + 1}`} className="px-3 py-1.5 text-sm border border-border rounded-sm hover:bg-muted transition-colors">
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
