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
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}

export default async function StudentsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const search = params.search ?? "";
  const status = (params.status ?? "active") as "active" | "completed" | "discontinued";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 25;
  const offset = (page - 1) * limit;

  const whereConditions = [eq(sql`${students.status}::text`, status)];
  if (search) {
    whereConditions.push(
      or(
        ilike(students.firstName, `%${search}%`),
        ilike(students.lastName!, `%${search}%`),
        ilike(students.studentCode, `%${search}%`)
      )!
    );
  }

  const [studentList, totalCount] = await Promise.all([
    db.query.students.findMany({
      where: and(...whereConditions),
      with: {
        enrollments: {
          where: eq(enrollments.status, "active"),
          with: { class: true },
        },
      },
      orderBy: [desc(students.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(students).where(and(...whereConditions)),
  ]);

  const total = totalCount[0]?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <PageHeader
        title="Students"
        description={`${total} ${status} student${total !== 1 ? "s" : ""}`}
        action={
          <Link
            href="/admin/admissions/new"
            className="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
          >
            + New Admission
          </Link>
        }
        breadcrumbs={[{ label: "Admin" }, { label: "Students" }]}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {(["active", "completed", "discontinued"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/students?status=${s}${search ? `&search=${search}` : ""}`}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              status === s
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <form>
          <input type="hidden" name="status" value={status} />
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search by name or student code..."
            className="w-full max-w-sm h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </form>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Student Code</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Hifz Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">School Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Admission Date</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {studentList.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No {status} students found
                </td>
              </tr>
            ) : (
              studentList.map((student) => {
                const hifzEnrollment = student.enrollments.find(
                  (e) => e.class.track === "hifz"
                );
                const schoolEnrollment = student.enrollments.find(
                  (e) => e.class.track === "school"
                );

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
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {hifzEnrollment?.class.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/students?status=${status}&page=${page - 1}${search ? `&search=${search}` : ""}`}
                className="px-3 py-1.5 text-sm border border-border rounded-sm hover:bg-muted transition-colors"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/students?status=${status}&page=${page + 1}${search ? `&search=${search}` : ""}`}
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
