"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getProgressCardDefaults, type ProgressCardDefaults } from "@/lib/actions/progress-cards";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CardDetails {
  toBeObtained: string;
  memorizedJuz: string;
  mentor: string;
  madrasaTeacher: string;
  schoolTeacher: string;
}

interface Props {
  examinationId: string;
  students: { id: string; label: string }[];
  studentId: string | null;
  /** Details currently applied to the card on screen (from the URL). */
  current: Partial<CardDetails>;
}

const input =
  "w-full h-10 px-3 rounded-md border border-input bg-background text-sm outline-none focus:ring-1 focus:ring-primary/30";

// Teacher names are the same for a whole class, so remember them per class on this device
// instead of retyping them for every student.
const memKey = (kind: string, className: string) => `hqms.progressCard.${kind}.${className}`;
function remember(kind: string, className: string): string {
  try { return localStorage.getItem(memKey(kind, className)) ?? ""; } catch { return ""; }
}
function store(kind: string, className: string, value: string) {
  try { if (value.trim()) localStorage.setItem(memKey(kind, className), value.trim()); } catch { /* storage unavailable */ }
}

export function ProgressCardControls({ examinationId, students, studentId, current }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(studentId ?? "");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState<ProgressCardDefaults | null>(null);
  const [form, setForm] = useState<CardDetails>({ toBeObtained: "", memorizedJuz: "", mentor: "", madrasaTeacher: "", schoolTeacher: "" });

  async function openDialog(forStudent: string) {
    if (!forStudent) { toast.error("Select a student first"); return; }
    setLoading(true);
    const res = await getProgressCardDefaults(examinationId, forStudent);
    setLoading(false);
    if (!res.success) { toast.error(res.error ?? "Could not load student details"); return; }
    const d = res.defaults;
    const sameStudent = forStudent === studentId;
    setDefaults(d);
    setForm({
      toBeObtained: sameStudent ? current.toBeObtained ?? "" : "",
      memorizedJuz: (sameStudent && current.memorizedJuz) || d.memorizedJuz,
      mentor: (sameStudent && current.mentor) || d.mentor,
      madrasaTeacher: (sameStudent && current.madrasaTeacher) || remember("madrasa", d.madrasaClass) || d.madrasaTeacher,
      schoolTeacher: (sameStudent && current.schoolTeacher) || remember("school", d.schoolClass) || d.schoolTeacher,
    });
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!defaults) return;
    if (defaults.hasHifz && !form.toBeObtained.trim()) { toast.error("Enter the obtained (to be obtained) value"); return; }
    if (defaults.hasMadrasa && !form.madrasaTeacher.trim()) { toast.error("Enter the Madrasa class teacher"); return; }
    if (defaults.hasSchool && !form.schoolTeacher.trim()) { toast.error("Enter the School class teacher"); return; }

    store("madrasa", defaults.madrasaClass, form.madrasaTeacher);
    store("school", defaults.schoolClass, form.schoolTeacher);

    const p = new URLSearchParams({ studentId: selected });
    if (defaults.hasHifz) {
      p.set("obtained", form.toBeObtained.trim());
      if (form.memorizedJuz.trim()) p.set("memorized", form.memorizedJuz.trim());
      if (form.mentor.trim()) p.set("mentor", form.mentor.trim());
    }
    if (defaults.hasMadrasa) p.set("madrasaTeacher", form.madrasaTeacher.trim());
    if (defaults.hasSchool) p.set("schoolTeacher", form.schoolTeacher.trim());
    setOpen(false);
    router.push(`/admin/exams/${examinationId}/progress-cards?${p.toString()}`);
  }

  const set = (k: keyof CardDetails) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <div className="bg-card border border-border p-4 rounded-lg flex flex-wrap items-end gap-4 mb-8">
        <div className="flex-1 max-w-sm">
          <label className="block text-sm font-medium text-foreground mb-1.5">Select Student</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm outline-none"
          >
            <option value="" disabled>Select a student...</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => openDialog(selected)}
          disabled={loading || !selected}
          className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-md disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />} Generate
        </button>
        {studentId && selected === studentId && (
          <button
            type="button"
            onClick={() => openDialog(studentId)}
            disabled={loading}
            className="h-10 px-3 border border-border rounded-md text-sm flex items-center gap-1.5 hover:bg-muted disabled:opacity-50"
          >
            <Pencil size={14} /> Edit card details
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Before generating the progress card</DialogTitle>
              <DialogDescription>
                These details are printed on the card. Pre-filled values can be changed.
              </DialogDescription>
            </DialogHeader>

            {defaults && (
              <div className="space-y-3">
                {defaults.hasHifz && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">To be obtained (Juz) <span className="text-red-500">*</span></label>
                      <input className={input} value={form.toBeObtained} onChange={set("toBeObtained")} placeholder="e.g. 22" autoFocus />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Memorized Juz</label>
                        <input className={input} value={form.memorizedJuz} onChange={set("memorizedJuz")} placeholder="e.g. 19" />
                        <p className="text-[11px] text-muted-foreground mt-1">Auto from Hifz progress</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Mentor</label>
                        <input className={input} value={form.mentor} onChange={set("mentor")} placeholder="Hifz class teacher" />
                      </div>
                    </div>
                  </>
                )}
                {defaults.hasMadrasa && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Madrasa class teacher ({defaults.madrasaClass}) <span className="text-red-500">*</span></label>
                    <input className={input} value={form.madrasaTeacher} onChange={set("madrasaTeacher")} placeholder="e.g. Hafiz Irshad Hudawi" />
                  </div>
                )}
                {defaults.hasSchool && (
                  <div>
                    <label className="block text-sm font-medium mb-1">School class teacher ({defaults.schoolClass}) <span className="text-red-500">*</span></label>
                    <input className={input} value={form.schoolTeacher} onChange={set("schoolTeacher")} placeholder="e.g. Abdul Rasheed Hudawi" />
                  </div>
                )}
                {!defaults.hasHifz && !defaults.hasMadrasa && !defaults.hasSchool && (
                  <p className="text-sm text-muted-foreground">
                    This student has no classes with exam subjects in this examination, so the card will be empty.
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md">Generate card</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
