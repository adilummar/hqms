"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveExamSubjects, copySubjectsFromLastExam, addTrackSubject, removeTrackSubject, applyCatalogueToClasses, saveGradeRules, publishExamResults, unpublishExamResults } from "@/lib/actions/exams";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Copy, Globe, EyeOff, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Subject { id?: string; name: string; totalMarks: number; passMarks: number; displayOrder: number; examDate?: string | null; }
interface GradeRule { grade: string; minPercentage: number; label: string; isFailing: boolean; displayOrder: number; }
interface ClassOption { id: string; name: string; track: string; }
interface ExamSubjectWithClass { id: string; classId: string; name: string; totalMarks: number; passMarks: number; displayOrder: number; examDate?: string | null; }

const inp = "h-9 px-2.5 rounded border border-input bg-background text-sm focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none transition-all w-full";

// ─── Subject Manager ──────────────────────────────────────────────────────────
interface CatalogueItem { id: string; name: string; totalMarks: number; passMarks: number; }

function buildSubjectMap(classes: ClassOption[], initialSubjects: ExamSubjectWithClass[]) {
  const map: Record<string, Subject[]> = {};
  for (const cls of classes) {
    map[cls.id] = initialSubjects
      .filter(s => s.classId === cls.id)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(s => ({ id: s.id, name: s.name, totalMarks: s.totalMarks, passMarks: s.passMarks, displayOrder: s.displayOrder, examDate: s.examDate ?? null }));
  }
  return map;
}

export function SubjectManager({ examSessionId, track, classes, initialSubjects, catalogue, catalogueReady }: {
  examSessionId: string;
  track: string;
  classes: ClassOption[];
  initialSubjects: ExamSubjectWithClass[];
  catalogue: CatalogueItem[];
  catalogueReady: boolean;
}) {
  const router = useRouter();
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [copying, setCopying] = useState(false);
  const [busy, setBusy] = useState(false);
  const isHifzTrack = track === "hifz";
  const [applyToAllClasses, setApplyToAllClasses] = useState(isHifzTrack);
  const [newSubject, setNewSubject] = useState({ name: "", totalMarks: 100, passMarks: 35 });

  // Server data → draft state. Resyncs whenever the saved data changes (e.g. after
  // router.refresh()) without resetting the selected class.
  const serverMap = buildSubjectMap(classes, initialSubjects);
  const serverSig = JSON.stringify(serverMap);
  const [prevSig, setPrevSig] = useState(serverSig);
  const [subjectsByClass, setSubjectsByClass] = useState<Record<string, Subject[]>>(serverMap);
  if (serverSig !== prevSig) {
    setPrevSig(serverSig);
    setSubjectsByClass(serverMap);
  }
  const dirty = JSON.stringify(subjectsByClass) !== serverSig;

  const subjects = subjectsByClass[selectedClass] ?? [];
  const trackLabel = track.charAt(0).toUpperCase() + track.slice(1);
  const lowerNames = new Set(subjects.map(s => s.name.trim().toLowerCase()));

  function updateSubject(idx: number, field: keyof Subject, value: string | number) {
    setSubjectsByClass(prev => ({
      ...prev,
      [selectedClass]: prev[selectedClass].map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  }
  function addSubject(init?: Partial<Subject>) {
    setSubjectsByClass(prev => ({
      ...prev,
      [selectedClass]: [...(prev[selectedClass] ?? []), { name: "", totalMarks: 100, passMarks: 35, displayOrder: (prev[selectedClass]?.length ?? 0), examDate: null, ...init }],
    }));
  }
  function removeSubject(idx: number) {
    setSubjectsByClass(prev => ({ ...prev, [selectedClass]: prev[selectedClass].filter((_, i) => i !== idx) }));
  }

  function save() {
    if (subjects.some(s => !s.name.trim())) { toast.error("Every subject needs a name"); return; }
    if (subjects.some(s => s.passMarks > s.totalMarks)) { toast.error("Pass marks cannot exceed total marks"); return; }
    startTransition(async () => {
      const applyToAllClassIds = applyToAllClasses ? classes.map(c => c.id) : undefined;
      const result = await saveExamSubjects({ examSessionId, classId: selectedClass, subjects, applyToAllClassIds });
      if (result.success) {
        toast.success(applyToAllClasses ? `Subjects saved for all ${trackLabel} classes` : "Subjects saved");
        router.refresh();
      } else {
        toast.error(typeof result.error === "string" ? result.error : "Failed to save");
      }
    });
  }

  async function copy() {
    setCopying(true);
    const result = await copySubjectsFromLastExam(examSessionId, selectedClass);
    setCopying(false);
    if (result.success) {
      toast.success(`Copied ${result.count} subjects from previous ${track} exam`);
      router.refresh();
    } else toast.error(result.error ?? "No previous subjects found");
  }

  async function addToCatalogue() {
    setBusy(true);
    const result = await addTrackSubject({ track, ...newSubject });
    setBusy(false);
    if (result.success) {
      toast.success(`Added to ${trackLabel} subjects`);
      setNewSubject({ name: "", totalMarks: 100, passMarks: 35 });
      router.refresh();
    } else toast.error(result.error ?? "Failed to add subject");
  }

  async function removeFromCatalogue(id: string) {
    setBusy(true);
    const result = await removeTrackSubject(id);
    setBusy(false);
    if (result.success) router.refresh();
    else toast.error(result.error ?? "Failed to remove subject");
  }

  async function applyAll(classIds: string[]) {
    setBusy(true);
    const result = await applyCatalogueToClasses({ examSessionId, classIds });
    setBusy(false);
    if (result.success) {
      toast.success(result.added ? `Added ${result.added} subject(s)` : "Nothing to add — all already present");
      router.refresh();
    } else toast.error(typeof result.error === "string" ? result.error : "Failed to add subjects");
  }

  return (
    <div className="space-y-4">
      {/* Track subject list */}
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">{trackLabel} subject list</p>
          <p className="text-xs text-muted-foreground">Subjects for the {track} track only. Add them once, then use them in any {track} class.</p>
        </div>
        {!catalogueReady ? (
          <p className="text-xs text-amber-600">The saved subject list needs a one-time database update (migration 0009). You can still add subjects to classes below.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {catalogue.length === 0 && <span className="text-xs text-muted-foreground">No {track} subjects yet — add one below.</span>}
              {catalogue.map(c => {
                const present = lowerNames.has(c.name.trim().toLowerCase());
                return (
                  <span key={c.id} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${present ? "border-primary/30 bg-primary/5 text-muted-foreground" : "border-border bg-background"}`}>
                    <button type="button" disabled={present || !selectedClass} onClick={() => addSubject({ name: c.name, totalMarks: c.totalMarks, passMarks: c.passMarks })}
                      title={present ? "Already in this class" : "Add to this class"} className="hover:text-primary disabled:cursor-default disabled:hover:text-inherit">
                      {c.name} <span className="text-muted-foreground">· {c.totalMarks}/{c.passMarks}</span>
                    </button>
                    <button type="button" disabled={busy} onClick={() => removeFromCatalogue(c.id)} title="Remove from list" className="text-muted-foreground hover:text-red-500"><X size={12} /></button>
                  </span>
                );
              })}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[180px]">
                <label className="text-[11px] text-muted-foreground">New {track} subject</label>
                <input value={newSubject.name} onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))} className={inp} placeholder="e.g. Hadith, Mathematics" />
              </div>
              <div className="w-24">
                <label className="text-[11px] text-muted-foreground">Total</label>
                <input type="number" min={1} value={newSubject.totalMarks} onChange={e => setNewSubject(p => ({ ...p, totalMarks: Number(e.target.value) }))} className={inp} />
              </div>
              <div className="w-24">
                <label className="text-[11px] text-muted-foreground">Pass</label>
                <input type="number" min={0} value={newSubject.passMarks} onChange={e => setNewSubject(p => ({ ...p, passMarks: Number(e.target.value) }))} className={inp} />
              </div>
              <button type="button" onClick={addToCatalogue} disabled={busy || !newSubject.name.trim()} className="h-9 px-3 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                <Plus size={14} /> Add to {trackLabel} list
              </button>
            </div>
            {catalogue.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button type="button" disabled={busy || dirty || !selectedClass} onClick={() => applyAll([selectedClass])} title={dirty ? "Save your changes first" : undefined}
                  className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted disabled:opacity-50">Add all to this class</button>
                <button type="button" disabled={busy || dirty} onClick={() => applyAll(classes.map(c => c.id))} title={dirty ? "Save your changes first" : undefined}
                  className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted disabled:opacity-50">Add all to every {track} class</button>
                <span className="text-[11px] text-muted-foreground">Only adds missing subjects; existing ones are never changed.</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Class picker */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium shrink-0">{trackLabel} class:</label>
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          className="h-9 px-3 rounded border border-input bg-background text-sm outline-none focus:ring-1 focus:ring-primary/30">
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={copy} disabled={copying} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded hover:bg-muted transition-colors disabled:opacity-50">
          {copying ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />} Copy from last {track} exam
        </button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
          <input
            type="checkbox"
            checked={applyToAllClasses}
            onChange={e => setApplyToAllClasses(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          Apply to all {trackLabel} classes
        </label>
      </div>

      {/* Subject table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-8">#</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Subject Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-36">Exam Date</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Total Marks</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Pass Marks</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subjects.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No subjects added. Click &ldquo;Add Subject&rdquo;, pick from the {track} list above, or copy from last exam.</td></tr>
            )}
            {subjects.map((s, i) => (
              <tr key={s.id ?? `new-${i}`} className="hover:bg-muted/10">
                <td className="px-4 py-2 text-muted-foreground text-xs">{i + 1}</td>
                <td className="px-4 py-2"><input value={s.name} onChange={e => updateSubject(i, "name", e.target.value)} className={inp} placeholder={`e.g. a ${track} subject`} list={`track-subjects-${examSessionId}`} /></td>
                <td className="px-4 py-2"><input type="date" value={s.examDate ?? ""} onChange={e => updateSubject(i, "examDate", e.target.value)} className={inp} /></td>
                <td className="px-4 py-2"><input type="number" value={s.totalMarks} onChange={e => updateSubject(i, "totalMarks", Number(e.target.value))} className={inp} min={1} /></td>
                <td className="px-4 py-2"><input type="number" value={s.passMarks} onChange={e => updateSubject(i, "passMarks", Number(e.target.value))} className={inp} min={1} /></td>
                <td className="px-4 py-2"><button onClick={() => removeSubject(i)} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <datalist id={`track-subjects-${examSessionId}`}>
          {catalogue.map(c => <option key={c.id} value={c.name} />)}
        </datalist>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => addSubject()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-dashed border-border rounded hover:bg-muted transition-colors">
          <Plus size={14} /> Add Subject
        </button>
        <button onClick={save} disabled={isPending} className="px-5 py-1.5 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5">
          {isPending ? <Loader2 size={13} className="animate-spin" /> : null} Save Subjects
        </button>
        {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
      </div>
    </div>
  );
}

// ─── Grade Rules Manager ──────────────────────────────────────────────────────
const DEFAULT_GRADES: GradeRule[] = [
  { grade: "A+", minPercentage: 90, label: "Outstanding",  isFailing: false, displayOrder: 0 },
  { grade: "A",  minPercentage: 75, label: "Excellent",    isFailing: false, displayOrder: 1 },
  { grade: "B+", minPercentage: 60, label: "Very Good",    isFailing: false, displayOrder: 2 },
  { grade: "B",  minPercentage: 50, label: "Good",         isFailing: false, displayOrder: 3 },
  { grade: "C",  minPercentage: 40, label: "Average",      isFailing: false, displayOrder: 4 },
  { grade: "F",  minPercentage: 0,  label: "Fail",         isFailing: true,  displayOrder: 5 },
];

export function GradeRulesManager({ examSessionId, initialRules }: {
  examSessionId: string;
  initialRules: GradeRule[];
}) {
  const [rules, setRules] = useState<GradeRule[]>(
    initialRules.length > 0 ? initialRules : DEFAULT_GRADES
  );
  const [isPending, startTransition] = useTransition();

  function update(i: number, field: keyof GradeRule, value: string | number | boolean) {
    setRules(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }
  function add() {
    setRules(prev => [...prev, { grade: "", minPercentage: 0, label: "", isFailing: false, displayOrder: prev.length }]);
  }
  function remove(i: number) { setRules(prev => prev.filter((_, idx) => idx !== i)); }

  function save() {
    startTransition(async () => {
      const result = await saveGradeRules({ examSessionId, rules });
      if (result.success) toast.success("Grade rules saved");
      else toast.error("Failed to save grade rules");
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Grades are computed from percentage (marks ÷ total × 100). Rules apply to all subjects in this exam.</p>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-24">Grade</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Min % (≥)</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Label</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-20">Failing?</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((r, i) => (
              <tr key={i} className={r.isFailing ? "bg-red-500/5" : ""}>
                <td className="px-4 py-2"><input value={r.grade} onChange={e => update(i, "grade", e.target.value)} className={inp} placeholder="A+" /></td>
                <td className="px-4 py-2"><input type="number" value={r.minPercentage} onChange={e => update(i, "minPercentage", Number(e.target.value))} className={inp} min={0} max={100} /></td>
                <td className="px-4 py-2"><input value={r.label} onChange={e => update(i, "label", e.target.value)} className={inp} placeholder="Excellent" /></td>
                <td className="px-4 py-2 text-center">
                  <input type="checkbox" checked={r.isFailing} onChange={e => update(i, "isFailing", e.target.checked)} className="w-4 h-4 rounded border-border accent-red-500" />
                </td>
                <td className="px-4 py-2"><button onClick={() => remove(i)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={add} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-dashed border-border rounded hover:bg-muted transition-colors">
          <Plus size={14} /> Add Grade
        </button>
        <button onClick={save} disabled={isPending} className="px-5 py-1.5 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5">
          {isPending ? <Loader2 size={13} className="animate-spin" /> : null} Save Grade Rules
        </button>
      </div>
    </div>
  );
}

// ─── Publish Controls ─────────────────────────────────────────────────────────
export function PublishControls({ examSessionId, resultStatus, isSuperAdmin }: {
  examSessionId: string;
  resultStatus: string;
  isSuperAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const isPublished = resultStatus === "published";

  function toggle() {
    startTransition(async () => {
      const fn = isPublished ? unpublishExamResults : publishExamResults;
      const result = await fn(examSessionId);
      if (result.success) toast.success(isPublished ? "Results unpublished" : "Results published to student portal");
      else toast.error("Action failed");
    });
  }

  if (!isSuperAdmin) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm ${isPublished ? "border-green-500/20 bg-green-500/5 text-green-600" : "border-border bg-muted text-muted-foreground"}`}>
        {isPublished ? <><Globe size={14} />Results published</> : <><EyeOff size={14} />Results not yet published</>}
      </div>
    );
  }

  return (
    <button onClick={toggle} disabled={isPending} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
      isPublished
        ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20"
        : "bg-green-500/10 text-green-600 hover:bg-green-500/20 border border-green-500/20"
    }`}>
      {isPending ? <Loader2 size={14} className="animate-spin" /> : isPublished ? <EyeOff size={14} /> : <Globe size={14} />}
      {isPublished ? "Unpublish Results" : "Publish Results to Students"}
    </button>
  );
}
