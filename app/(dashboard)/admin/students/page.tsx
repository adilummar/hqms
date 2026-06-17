import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, enrollments } from "@/lib/db/schema";
import { eq, and, desc, count, or, ilike, sql } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/students/status-badge";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Students" };

interface Props {
  searchParams: Promise<{
    search?: string;
    tab?: string;       // "active" | "inactive"
    subTab?: string;    // "completed" | "discontinued" (only when tab=inactive)
    batch?: string;     // batch id filter
    page?: string;
  }>;
}

export default async function StudentsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const search      = params.search ?? "";
  const tab         = (params.tab    ?? "active")    as "active" | "inactive";
  const subTab      = (params.subTab ?? "completed") as "completed" | "discontinued";
  const batchFilter = params.batch ?? "";
  const page        = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit       = 25;
  const offset      = (page - 1) * limit;

  // Status to filter — active tab = "active", inactive tab = subTab
  const statusValue = tab === "active" ? "active" : subTab;

  // Build base filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [eq(sql`${students.status}::text`, statusValue)];

  if (batchFilter) {
    conditions.push(eq(students.batchId, batchFilter));
  }

  if (search) {
    conditions.push(
      or(
        ilike(students.firstName, `%${search}%`),
        ilike(students.lastName!, `%${search}%`),
        ilike(students.studentCode, `%${search}%`),
        ilike(students.admissionNumber!, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [studentList, totalCount, allBatches, activeCounts, inactiveCounts] = await Promise.all([
    db.query.students.findMany({
      where: whereClause,
      with: {
        enrollments: {
          where: eq(enrollments.status, "active"),
          with: { class: true },
        },
        batch: true,
      },
      orderBy: [desc(students.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(students).where(whereClause),
    // All batches for filter dropdown
    db.query.batches.findMany({
      orderBy: (b, { asc }) => [asc(b.batchNumber)],
    }),
    // Count active students
    db.select({ count: count() }).from(students).where(
      eq(sql`${students.status}::text`, "active")
    ),
    // Count inactive (completed + discontinued) students
    db.select({ count: count() }).from(students).where(
      sql`${students.status}::text IN ('completed', 'discontinued')`
    ),
  ]);

  const total      = totalCount[0]?.count ?? 0;
  const totalPages = Math.ceil(total / limit);
  const activeTotal   = activeCounts[0]?.count   ?? 0;
  const inactiveTotal = inactiveCounts[0]?.count  ?? 0;

  // Build link helper (preserves current filters)
  function buildLink(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const base = { tab, subTab, batch: batchFilter, search, ...overrides };
    for (const [k, v] of Object.entries(base)) {
      if (v) p.set(k, v);
    }
    return `/admin/students?${p.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Students"
        description={`${total} ${tab === "active" ? "active" : subTab} student${total !== 1 ? "s" : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/students/import"
              className="px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              ⬆ Bulk Import
            </Link>
            <Link
              href="/admin/admissions/new"
              className="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
            >
              + New Admission
            </Link>
          </div>
        }
        breadcrumbs={[{ label: "Admin" }, { label: "Students" }]}
      />

      {/* ── Main Tabs: Active / Inactive ─────────────────── */}
      <div className="flex gap-1 mb-1 border-b border-border">
        <Link
          href={buildLink({ tab: "active", subTab: undefined, page: "1" })}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "active"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Active
          <span className="ml-1.5 font-jetbrains text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            {activeTotal}
          </span>
        </Link>
        <Link
          href={buildLink({ tab: "inactive", subTab: "completed", page: "1" })}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "inactive"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Inactive
          <span className="ml-1.5 font-jetbrains text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            {inactiveTotal}
          </span>
        </Link>
      </div>

      {/* ── Sub-tabs (only visible when Inactive tab is active) ── */}
      {tab === "inactive" && (
        <div className="flex gap-1 mb-5 px-1 pt-1">
          <Link
            href={buildLink({ tab: "inactive", subTab: "completed", page: "1" })}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
              subTab === "completed"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            ✓ Completed
          </Link>
          <Link
            href={buildLink({ tab: "inactive", subTab: "discontinued", page: "1" })}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
              subTab === "discontinued"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            ✗ Discontinued
          </Link>
        </div>
      )}
      {tab === "active" && <div className="mb-5" />}

      {/* ── Filters: Search + Batch ──────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <form className="flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          {tab === "inactive" && <input type="hidden" name="subTab" value={subTab} />}
          {batchFilter && <input type="hidden" name="batch" value={batchFilter} />}
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search by name, code, or admission no..."
            className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground w-64"
          />
        </form>

        {/* Batch filter */}
        {allBatches.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Batch:</span>
            <Link
              href={buildLink({ batch: undefined, page: "1" })}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors ${
                !batchFilter
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/50"
              }`}
            >
              All
            </Link>
            {allBatches.map((b) => (
              <Link
                key={b.id}
                href={buildLink({ batch: b.id, page: "1" })}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors ${
                  batchFilter === b.id
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:border-foreground/50"
                }`}
              >
                {b.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Student Code
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Batch
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Hifz Class
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  School Class
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Admission Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {studentList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {tab === "active"
                      ? "No active students found"
                      : `No ${subTab} students found`}
                  </td>
                </tr>
              ) : (
                studentList.map((student) => {
                  const hifzEnrollment   = student.enrollments.find((e) => e.class.track === "hifz");
                  const schoolEnrollment = student.enrollments.find((e) => e.class.track === "school");

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-jetbrains text-xs text-muted-foreground">
                        <Link href={`/admin/students/${student.id}`} className="block">
                          {student.studentCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/students/${student.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {student.firstName} {student.lastName ?? ""}
                        </Link>
                        {student.admissionNumber && (
                          <p className="text-xs text-muted-foreground font-jetbrains">
                            AD #{student.admissionNumber}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {student.batch ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {student.batch.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {hifzEnrollment?.class.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {schoolEnrollment?.class.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-jetbrains text-xs text-muted-foreground">
                        {student.admissionDate}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={student.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildLink({ page: String(page - 1) })}
                className="px-3 py-1.5 text-sm border border-border rounded-sm hover:bg-muted transition-colors"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildLink({ page: String(page + 1) })}
                className="px-3 py-1.5 text-sm border border-border rounded-sm hover:bg-muted transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
