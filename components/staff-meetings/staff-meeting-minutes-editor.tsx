"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateStaffMeetingMinutes,
  updateStaffMeetingDetails,
  deleteStaffMeeting,
} from "@/lib/actions/staff-meetings";
import {
  CheckCircle2,
  FileText,
  Gavel,
  Calendar,
  Clock,
  MapPin,
  Save,
  Loader2,
  Trash2,
  Printer,
  Edit2,
  X,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface StaffMeetingProps {
  meeting: {
    id: string;
    title: string;
    meetingDate: string;
    meetingTime: string | null;
    location: string | null;
    description: string | null;
    status: string;
    minutes: string | null;
    decisions: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    createdByUser?: {
      username: string;
      role: string;
    } | null;
  };
  isAdmin?: boolean;
}

export function StaffMeetingMinutesEditor({ meeting, isAdmin = true }: StaffMeetingProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Minutes & Decisions state
  const [status, setStatus] = useState<"scheduled" | "completed" | "cancelled">(
    (meeting.status as "scheduled" | "completed" | "cancelled") || "scheduled"
  );
  const [decisions, setDecisions] = useState(meeting.decisions || "");
  const [minutes, setMinutes] = useState(meeting.minutes || "");

  // Meeting Details edit state
  const [editTitle, setEditTitle] = useState(meeting.title);
  const [editDate, setEditDate] = useState(meeting.meetingDate);
  const [editTime, setEditTime] = useState(meeting.meetingTime || "");
  const [editLocation, setEditLocation] = useState(meeting.location || "");
  const [editDescription, setEditDescription] = useState(meeting.description || "");

  const hasUnsavedMinutes =
    decisions !== (meeting.decisions || "") ||
    minutes !== (meeting.minutes || "") ||
    status !== meeting.status;

  function handleSaveMinutes() {
    startTransition(async () => {
      const res = await updateStaffMeetingMinutes({
        meetingId: meeting.id,
        minutes: minutes.trim() || null,
        decisions: decisions.trim() || null,
        status,
      });

      if (res.success) {
        toast.success("Meeting minutes & decisions saved successfully!");
        router.refresh();
      } else {
        toast.error("Failed to save minutes. Please try again.");
      }
    });
  }

  function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!editTitle.trim() || !editDate) return;

    startTransition(async () => {
      const res = await updateStaffMeetingDetails({
        meetingId: meeting.id,
        title: editTitle.trim(),
        meetingDate: editDate,
        meetingTime: editTime.trim() || null,
        location: editLocation.trim() || null,
        description: editDescription.trim() || null,
        status,
      });

      if (res.success) {
        toast.success("Meeting details updated successfully!");
        setShowEditModal(false);
        router.refresh();
      } else {
        toast.error("Failed to update details. Please check inputs.");
      }
    });
  }

  async function handleDelete() {
    setIsDeleting(true);
    const res = await deleteStaffMeeting(meeting.id);
    setIsDeleting(false);

    if (res.success) {
      toast.success("Meeting deleted.");
      router.push("/admin/staff-meetings");
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Failed to delete meeting.");
      setShowDeleteConfirm(false);
    }
  }

  function addDecisionTemplate() {
    const template =
      (decisions.trim() ? decisions + "\n" : "") +
      `• Decision: [Key decision or resolution agreed upon]\n  Action Item: [Assigned staff / deadline]\n`;
    setDecisions(template);
  }

  return (
    <div className="space-y-6">
      {/* ── Top Meeting Header & Controls ── */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  status === "completed"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : status === "cancelled"
                    ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                    : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                }`}
              >
                {status}
              </span>
              <h2 className="text-xl font-bold font-inter text-foreground">
                {meeting.title}
              </h2>
            </div>
            {meeting.createdByUser && (
              <p className="text-xs text-muted-foreground mt-1 font-dm-sans">
                Convened by{" "}
                <span className="font-medium text-foreground">
                  {meeting.createdByUser.username}
                </span>{" "}
                ({meeting.createdByUser.role})
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Printer size={14} />
              <span>Print MOM</span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Edit2 size={14} />
                  <span>Edit Info</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Meeting metadata pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs font-dm-sans">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar size={14} className="text-teal-600" />
            <span className="font-medium text-foreground">
              {new Date(meeting.meetingDate + "T00:00:00").toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={14} className="text-teal-600" />
            <span>{meeting.meetingTime || "Time not specified"}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin size={14} className="text-teal-600" />
            <span>{meeting.location || "Institution Premises"}</span>
          </div>
        </div>

        {meeting.description && (
          <div className="mt-3.5 pt-3.5 border-t border-border">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1 font-dm-sans">
              Agenda / Discussion Points:
            </p>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {meeting.description}
            </p>
          </div>
        )}
      </div>

      {/* ── Status Selector & Save Button ── */}
      {isAdmin && (
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-foreground font-dm-sans">
              Meeting Status:
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "scheduled" | "completed" | "cancelled")
              }
              className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-teal"
            >
              <option value="scheduled">Scheduled (Upcoming / In Progress)</option>
              <option value="completed">Completed (Minutes Finalized)</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSaveMinutes}
            disabled={isPending}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs ${
              hasUnsavedMinutes
                ? "bg-teal-700 hover:bg-teal-800 text-white animate-pulse"
                : "bg-foreground text-background hover:bg-foreground/90"
            }`}
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{hasUnsavedMinutes ? "Save Changes *" : "Save Minutes & Decisions"}</span>
          </button>
        </div>
      )}

      {/* ── DECISIONS TAKEN SECTION ("DISITIONS") ── */}
      <div className="bg-card border-2 border-teal-500/40 dark:border-teal-400/30 rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl -z-10 pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 flex items-center justify-center">
              <Gavel size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold font-inter text-foreground flex items-center gap-2">
                Decisions Taken & Resolutions
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 font-medium uppercase tracking-wide">
                  Official Record
                </span>
              </h3>
              <p className="text-xs text-muted-foreground font-dm-sans">
                Document all formal decisions, agreed policies, approvals, and assigned action items
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={addDecisionTemplate}
              className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
            >
              <Sparkles size={13} />
              + Add Decision Template
            </button>
          )}
        </div>

        {isAdmin ? (
          <div>
            <textarea
              rows={6}
              value={decisions}
              onChange={(e) => setDecisions(e.target.value)}
              placeholder="Record the decisions taken in this staff meeting...&#10;Example:&#10;1. Daily tracker entry deadline finalized: Staff must enter marks by 09:30 AM daily.&#10;2. Daura juz target: 1-30 multi-select verified and approved for all hifz classes.&#10;3. Leave requests: Staff must submit leave requests minimum 24 hours prior."
              className="w-full px-3.5 py-3 rounded-lg border border-border bg-background text-xs font-mono text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1 font-dm-sans">
              <CheckCircle2 size={12} className="text-teal-600" />
              Decisions documented here will be displayed to all faculty & staff members in their portal.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-muted/40 border border-border">
            {meeting.decisions ? (
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-dm-sans">
                {meeting.decisions}
              </p>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                No formal decisions recorded yet for this meeting.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── MINUTES OF THE MEETING (MOM) ── */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold font-inter text-foreground">
              Minutes of the Meeting (MOM)
            </h3>
            <p className="text-xs text-muted-foreground font-dm-sans">
              Comprehensive proceedings, discussion points, faculty concerns, and progress reviews
            </p>
          </div>
        </div>

        {isAdmin ? (
          <div>
            <textarea
              rows={8}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="Enter detailed meeting minutes, discussions, matters reviewed, and notes...&#10;• The meeting commenced at 10:00 AM with Quran recitation.&#10;• Reviewed monthly Hifz completion rates across all batches.&#10;• Tutors discussed student retention and revision schedules.&#10;• Head of department addressed classroom attendance patterns."
              className="w-full px-3.5 py-3 rounded-lg border border-border bg-background text-xs font-mono text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 font-dm-sans">
              Comprehensive discussion log preserved for institutional governance and accreditation.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-muted/40 border border-border">
            {meeting.minutes ? (
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-dm-sans">
                {meeting.minutes}
              </p>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                No meeting minutes recorded yet.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: EDIT MEETING DETAILS ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-inter text-base font-semibold text-foreground">
                Edit Meeting Details
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveDetails} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">
                  Meeting Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">
                    Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10:00 AM - 11:30 AM"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">
                  Location / Venue
                </label>
                <input
                  type="text"
                  placeholder="e.g. Conference Hall / Board Room"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">
                  Agenda / Description
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 disabled:opacity-50 cursor-pointer"
                >
                  {isPending && <Loader2 size={13} className="animate-spin" />}
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE CONFIRMATION ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl animate-fade-in">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <AlertTriangle size={20} />
              <h3 className="font-inter text-sm font-bold text-foreground">
                Delete Staff Meeting?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground font-dm-sans leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-foreground">&quot;{meeting.title}&quot;</span>? All associated minutes, decisions, and attendance records will be permanently removed.
            </p>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting && <Loader2 size={13} className="animate-spin" />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
