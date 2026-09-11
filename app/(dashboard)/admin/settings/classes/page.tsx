import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { classes, users, enrollments } from "@/lib/db/schema";
import { asc, eq, and } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { AddClassDialog } from "@/components/settings/add-class-dialog";
import { EditClassDialog } from "@/components/settings/edit-class-dialog";
import { DeleteClassButton } from "@/components/settings/delete-class-button";
import type { Metadata } from "next";

interface Props {
  searchParams: Promise<{ track?: string }>;
}

export const metadata: Metadata = { title: "Classes | Settings" };

export default async function ClassesSettingsPage({ searchParams }: Props) {
  await requireRole(["super_admin", "admin"]);
  const params = await searchParams;
  const currentTrack = params.track || "all";

  const [allClasses, tutors, activeEnrollments] = await Promise.all([
    db.query.classes.findMany({
      where: currentTrack !== "all" ? eq(classes.track, currentTrack as any) : undefined,
      orderBy: [asc(classes.name)],
      with: {
        tutor: { columns: { username: true } }
      }
    }),
    db.query.users.findMany({
      where: and(eq(users.role, "tutor"), eq(users.isActive, true)),
      columns: { id: true, username: true },
      orderBy: [asc(users.username)],
    }),
    db.query.enrollments.findMany({
      where: eq(enrollments.status, "active"),
      columns: { classId: true }
    })
  ]);

  const studentCounts = activeEnrollments.reduce((acc, e) => {
    acc[e.classId] = (acc[e.classId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tracks = [
    { value: "all", label: "All Classes" },
    { value: "hifz", label: "Hifz" },
    { value: "madrasa", label: "Madrasa" },
    { value: "school", label: "School" },
  ];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Class Manager"
        description="Manage classes across all tracks"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Settings", href: "/admin/settings" },
          { label: "Classes" },
        ]}
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {tracks.map((track) => (
          <a
            key={track.value}
            href={`/admin/settings/classes${track.value === "all" ? "" : `?track=${track.value}`}`}
            className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
              currentTrack === track.value
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {track.label}
          </a>
        ))}
      </div>

      <div className="mt-6 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/20">
          <h3 className="font-playfair text-lg font-semibold">Configured Classes</h3>
          <AddClassDialog tutors={tutors} />
        </div>
        
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-5 py-3 font-medium text-muted-foreground">Class Name</th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground">Track</th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground">Assigned Tutor</th>
              <th className="text-center px-5 py-3 font-medium text-muted-foreground">Students</th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {allClasses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">No classes found</td>
              </tr>
            ) : (
              allClasses.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3 capitalize">{c.track}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {c.tutor ? (
                      <span className="font-medium text-foreground">{c.tutor.username}</span>
                    ) : (
                      "Unassigned"
                    )}
                  </td>
                  <td className="px-5 py-3 text-center font-jetbrains text-muted-foreground">
                    {studentCounts[c.id] || 0}
                  </td>
                  <td className="px-5 py-3">
                    {c.isActive ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">Active</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">Inactive</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <EditClassDialog cls={c} tutors={tutors} />
                      <span className="text-border">|</span>
                      <DeleteClassButton cls={c} />
                    </div>
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
