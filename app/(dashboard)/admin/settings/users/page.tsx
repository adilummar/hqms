import { requireRole } from "@/lib/auth/helpers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { AddUserDialog } from "@/components/settings/add-user-dialog";
import { ResetUserPasswordDialog } from "@/components/settings/reset-user-password-dialog";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Users | Settings" };

export default async function UsersSettingsPage() {
  await requireRole(["super_admin", "admin"]);

  const session = await auth();
  const currentUserId = session?.user?.id;

  const allUsers = await db.query.users.findMany({
    orderBy: [asc(users.username)],
  });

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

      <div className="mt-6 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/20 flex justify-between items-center">
          <div>
            <h3 className="font-playfair text-lg font-semibold">System Users</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allUsers.length} user{allUsers.length !== 1 ? "s" : ""} registered
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
            {allUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">
                  No users found
                </td>
              </tr>
            ) : (
              allUsers.map((u) => (
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
                  <td className="px-5 py-3 capitalize">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-sm text-xs font-medium ${
                        u.role === "super_admin"
                          ? "bg-purple-100 text-purple-800 border border-purple-200"
                          : u.role === "admin"
                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                          : u.role === "tutor"
                          ? "bg-orange-100 text-orange-800 border border-orange-200"
                          : "bg-gray-100 text-gray-800 border border-gray-200"
                      }`}
                    >
                      {u.role.replace("_", " ")}
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
                    <ResetUserPasswordDialog
                      userId={u.id}
                      username={u.username}
                      role={u.role}
                    />
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
