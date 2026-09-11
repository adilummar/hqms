import { requireRole } from "@/lib/auth/helpers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { asc, eq, and } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { AddUserDialog } from "@/components/settings/add-user-dialog";
import { ResetUserPasswordDialog } from "@/components/settings/reset-user-password-dialog";
import { UserFilters } from "@/components/settings/user-filters";
import { UserActionsCell } from "@/components/settings/user-actions-cell";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Users | Settings" };

const ALL_ROLES = [
  { value: "super_admin",  label: "Super Admin" },
  { value: "admin",        label: "Admin" },
  { value: "tutor",        label: "Tutor" },
  { value: "school_admin", label: "School Admin" },
  { value: "madrasa_admin", label: "Madrasa Admin" },
  { value: "parent",       label: "Parent" },
  { value: "student",      label: "Student" },
] as const;

type RoleValue = (typeof ALL_ROLES)[number]["value"];

const ROLE_COLORS: Record<string, string> = {
  super_admin:  "bg-purple-100 text-purple-800 border border-purple-200",
  admin:        "bg-blue-100   text-blue-800   border border-blue-200",
  tutor:        "bg-orange-100 text-orange-800 border border-orange-200",
  school_admin: "bg-teal-100   text-teal-800   border border-teal-200",
  madrasa_admin: "bg-indigo-100 text-indigo-800 border border-indigo-200",
  parent:       "bg-green-100  text-green-800  border border-primary/20",
  student:      "bg-gray-100   text-gray-800   border border-gray-200",
};

import { count } from "drizzle-orm";

interface Props {
  searchParams: Promise<{ role?: string; status?: string; page?: string }>;
}

export default async function UsersSettingsPage({ searchParams }: Props) {
  await requireRole(["super_admin", "admin"]);

  const session = await auth();
  const currentUserId = session?.user?.id;

  const params = await searchParams;
  const roleFilter   = params.role   as RoleValue | undefined;
  const statusFilter = params.status; // "active" | "inactive" | undefined
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 50;

  // Build where clause from active filters
  const conditions = [];
  if (roleFilter && ALL_ROLES.some((r) => r.value === roleFilter)) {
    conditions.push(eq(users.role, roleFilter));
  }
  if (statusFilter === "active") {
    conditions.push(eq(users.isActive, true));
  } else if (statusFilter === "inactive") {
    conditions.push(eq(users.isActive, false));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalCountResult, filteredUsers] = await Promise.all([
    db.select({ value: count() }).from(users).where(whereClause),
    db.query.users.findMany({
      where: whereClause,
      orderBy: [asc(users.username)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
  ]);

  const totalUsers = totalCountResult[0].value;
  const totalPages = Math.ceil(totalUsers / pageSize);

  const hasFilter = Boolean(roleFilter || statusFilter);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="User Management"
        description="View and manage all system user accounts"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Settings", href: "/admin/settings" },
          { label: "Users" },
        ]}
      />

      {/* ── Dropdown filters ────────────────────────────────────────────────────── */}
      <UserFilters currentRole={roleFilter} currentStatus={statusFilter} />

      {/* ── Users table ──────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/20 flex justify-between items-center">
          <div>
            <h3 className="font-playfair text-lg font-semibold">System Users</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalUsers} user{totalUsers !== 1 ? "s" : ""}
              {hasFilter && (
                <>
                  {" "}matching filter{" — "}
                  <Link
                    href="/admin/settings/users"
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    clear
                  </Link>
                </>
              )}
            </p>
          </div>
          <AddUserDialog />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Username</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                    <p className="font-medium text-sm mb-1">No users match the selected filter</p>
                    <Link
                      href="/admin/settings/users"
                      className="text-xs underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      Clear filters
                    </Link>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium font-jetbrains">{u.username}</span>
                        {u.id === currentUserId && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-sm font-medium">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-sm text-xs font-medium ${
                          ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-800 border border-gray-200"
                        }`}
                      >
                        {u.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-emerald-700 bg-emerald-500/10">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-red-700 bg-red-500/10">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ResetUserPasswordDialog
                          userId={u.id}
                          username={u.username}
                          role={u.role}
                        />
                        <UserActionsCell
                          userId={u.id}
                          username={u.username}
                          role={u.role}
                          isActive={u.isActive}
                          isCurrentUser={u.id === currentUserId}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border bg-muted/10 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalUsers)} of {totalUsers} users
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/settings/users?${new URLSearchParams({ ...(roleFilter && { role: roleFilter }), ...(statusFilter && { status: statusFilter }), page: (page - 1).toString() })}`}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted transition-colors"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/settings/users?${new URLSearchParams({ ...(roleFilter && { role: roleFilter }), ...(statusFilter && { status: statusFilter }), page: (page + 1).toString() })}`}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted transition-colors"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
