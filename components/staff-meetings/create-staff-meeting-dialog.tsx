"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStaffMeeting } from "@/lib/actions/staff-meetings";
import { Calendar, Clock, MapPin, Plus, Loader2, X, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  MeetingCategoryField,
  MeetingParticipantsPicker,
  type CategoryValue,
  type ExternalDraft,
  type StaffCandidate,
} from "./meeting-form-sections";

export function CreateStaffMeetingDialog({ staff = [] }: { staff?: StaffCandidate[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [meetingTime, setMeetingTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [cat, setCat] = useState<CategoryValue>({ category: "", customCategory: "" });
  // Default: every eligible staff member is invited; the admin deselects who is not needed.
  const [selected, setSelected] = useState<string[]>(() => staff.map((s) => s.id));
  const [externals, setExternals] = useState<ExternalDraft[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    if (!title.trim() || !meetingDate) return;
    if (!cat.category || (cat.category === "custom" && !cat.customCategory.trim())) return;
    if (selected.length + externals.length === 0) {
      toast.error("Select at least one participant.");
      return;
    }

    startTransition(async () => {
      const result = await createStaffMeeting({
        title,
        meetingDate,
        meetingTime: meetingTime.trim() || undefined,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        category: cat.category,
        customCategory: cat.category === "custom" ? cat.customCategory.trim() : null,
        participantUserIds: selected,
        externalParticipants: externals.map((x) => ({
          name: x.name,
          designation: x.designation || null,
          contactNumber: x.contactNumber || null,
        })),
      });

      if (result.success && "data" in result && result.data) {
        toast.success("Staff meeting scheduled successfully!");
        setOpen(false);
        setTitle("");
        setMeetingTime("");
        setLocation("");
        setDescription("");
        setCat({ category: "", customCategory: "" });
        setSelected(staff.map((s) => s.id));
        setExternals([]);
        setShowErrors(false);
        router.push(`/admin/staff-meetings/${result.data.id}`);
      } else {
        const err = ("error" in result ? result.error : undefined) as
          | Record<string, string[] | undefined>
          | undefined;
        const first = err && Object.values(err).flat().find(Boolean);
        toast.error(first || "Failed to schedule meeting. Please check inputs.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-all cursor-pointer shadow-xs font-dm-sans"
      >
        <Plus size={14} />
        <span>Schedule Staff Meeting</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="font-inter text-base font-semibold text-foreground">
                    New Staff Meeting
                  </h3>
                  <p className="text-xs text-muted-foreground font-dm-sans">
                    Schedule an institutional meeting with staff & faculty
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">
                  Meeting Title / Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Faculty Sync / Academic Progress Review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal"
                />
              </div>

              <MeetingCategoryField value={cat} onChange={setCat} showError={showErrors} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans flex items-center gap-1">
                    <Calendar size={12} className="text-muted-foreground" />
                    Meeting Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-jetbrains"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans flex items-center gap-1">
                    <Clock size={12} className="text-muted-foreground" />
                    Time (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10:30 AM or After Zuhr"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-dm-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans flex items-center gap-1">
                  <MapPin size={12} className="text-muted-foreground" />
                  Venue / Location (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Conference Hall / Principal's Office / Staff Room"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-dm-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">
                  Agenda & Discussion Topics (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Outline the key agenda items to be addressed during this meeting..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal resize-none"
                />
              </div>

              <MeetingParticipantsPicker
                candidates={staff}
                selected={selected}
                onSelectedChange={setSelected}
                externals={externals}
                onExternalsChange={setExternals}
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !title.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-60 cursor-pointer shadow-xs"
                >
                  {isPending && <Loader2 size={12} className="animate-spin" />}
                  Schedule Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
