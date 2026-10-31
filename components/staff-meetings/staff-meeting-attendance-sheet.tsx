"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStaffMeetingAttendance } from "@/lib/actions/staff-meetings";
import {
  Users,
  CheckCircle2,
  XCircle,
  Save,
  Loader2,
  Search,
  Check,
  X,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

export interface StaffAttendee {
  userId: string;
  username: string;
  email?: string | null;
  role: string;
  attended: boolean;
  remarks: string | null;
}

interface Props {
  meetingId: string;
  initialAttendees: StaffAttendee[];
  isAdmin?: boolean;
}

export function StaffMeetingAttendanceSheet({
  meetingId,
  initialAttendees,
  isAdmin = true,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [attendees, setAttendees] = useState<StaffAttendee[]>(initialAttendees);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");

  const total = attendees.length;
  const presentCount = attendees.filter((a) => a.attended).length;
  const absentCount = total - presentCount;
  const attendanceRate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  function handleToggleAttended(userId: string) {
    if (!isAdmin) return;
    setAttendees((prev) =>
      prev.map((a) => (a.userId === userId ? { ...a, attended: !a.attended } : a))
    );
  }

  function handleRemarksChange(userId: string, remarks: string) {
    if (!isAdmin) return;
    setAttendees((prev) =>
      prev.map((a) => (a.userId === userId ? { ...a, remarks } : a))
    );
  }

  function handleMarkAll(attended: boolean) {
    if (!isAdmin) return;
    setAttendees((prev) => prev.map((a) => ({ ...a, attended })));
  }

  function handleSave() {
    startTransition(async () => {
      const payload = attendees.map((a) => ({
        userId: a.userId,
        attended: a.attended,
        remarks: a.remarks?.trim() || undefined,
      }));

      const res = await saveStaffMeetingAttendance(meetingId, payload);
      if (res.success) {
        toast.success("Staff meeting attendance saved successfully!");
        router.refresh();
      } else {
        toast.error("Failed to save attendance.");
      }
    });
  }

  const filteredAttendees = attendees.filter((a) => {
    const matchesSearch =
      a.username.toLowerCase().includes(search.toLowerCase()) ||
      (a.email && a.email.toLowerCase().includes(search.toLowerCase()));
    const matchesRole = filterRole === "all" || a.role === filterRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-4">
      {/* ── Summary bar & controls ── */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Quick Stats */}
          <div className="flex items-center gap-6 flex-wrap font-dm-sans">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-semibold">Total Staff</p>
              <p className="text-lg font-bold font-inter text-foreground">{total}</p>
            </div>
            <div className="border-l border-border pl-6">
              <p className="text-[11px] text-emerald-600 font-semibold uppercase flex items-center gap-1">
                <CheckCircle2 size={12} /> Present
              </p>
              <p className="text-lg font-bold font-inter text-emerald-600">{presentCount}</p>
            </div>
            <div className="border-l border-border pl-6">
              <p className="text-[11px] text-red-600 font-semibold uppercase flex items-center gap-1">
                <XCircle size={12} /> Absent
              </p>
              <p className="text-lg font-bold font-inter text-red-600">{absentCount}</p>
            </div>
            <div className="border-l border-border pl-6">
              <p className="text-[11px] text-muted-foreground uppercase font-semibold">Turnout</p>
              <p className="text-lg font-bold font-inter text-foreground">{attendanceRate}%</p>
            </div>
          </div>

          {/* Action buttons */}
          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleMarkAll(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted cursor-pointer font-dm-sans"
              >
                <UserCheck size={13} className="text-emerald-600" />
                All Present
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll(false)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted cursor-pointer font-dm-sans"
              >
                <UserX size={13} className="text-red-600" />
                All Absent
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 disabled:opacity-50 cursor-pointer font-dm-sans"
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Roster
              </button>
            </div>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-border">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search staff by username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-dm-sans"
            />
          </div>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-dm-sans"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="tutor">Tutor</option>
            <option value="school_admin">School Admin</option>
            <option value="madrasa_admin">Madrasa Admin</option>
          </select>
        </div>
      </div>

      {/* ── Attendees Roster Table ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-dm-sans border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase text-[11px]">
                <th className="py-2.5 px-4 w-12 text-center">#</th>
                <th className="py-2.5 px-4">Staff Member</th>
                <th className="py-2.5 px-4 w-32">Role</th>
                <th className="py-2.5 px-4 w-36 text-center">Attendance Status</th>
                <th className="py-2.5 px-4">Remarks / Absence Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAttendees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No staff members match the criteria.
                  </td>
                </tr>
              ) : (
                filteredAttendees.map((att, idx) => (
                  <tr
                    key={att.userId}
                    className={`transition-colors ${
                      att.attended ? "hover:bg-emerald-500/5" : "bg-red-500/5 hover:bg-red-500/10"
                    }`}
                  >
                    <td className="py-2.5 px-4 text-center text-muted-foreground font-mono">
                      {idx + 1}
                    </td>

                    <td className="py-2.5 px-4">
                      <p className="font-semibold text-foreground font-inter">
                        {att.username}
                      </p>
                      {att.email && (
                        <p className="text-[11px] text-muted-foreground">{att.email}</p>
                      )}
                    </td>

                    <td className="py-2.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-foreground border border-border capitalize">
                        {att.role.replace("_", " ")}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleToggleAttended(att.userId)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                            att.attended
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300"
                              : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300"
                          }`}
                        >
                          {att.attended ? (
                            <>
                              <Check size={12} className="stroke-[3]" />
                              <span>Present</span>
                            </>
                          ) : (
                            <>
                              <X size={12} className="stroke-[3]" />
                              <span>Absent</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            att.attended
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {att.attended ? "Present" : "Absent"}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-4">
                      {isAdmin ? (
                        <input
                          type="text"
                          placeholder={att.attended ? "Optional note..." : "Reason for absence..."}
                          value={att.remarks || ""}
                          onChange={(e) => handleRemarksChange(att.userId, e.target.value)}
                          className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs italic">
                          {att.remarks || "—"}
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
    </div>
  );
}
