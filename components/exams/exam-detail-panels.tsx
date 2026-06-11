"use client";

import { useState, useTransition } from "react";
import { saveExamSubjects, copySubjectsFromLastExam, saveGradeRules, publishExamResults, unpublishExamResults } from "@/lib/actions/exams";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Copy, Globe, EyeOff } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Subject { id?: string; name: string; totalMarks: number; passMarks: number; displayOrder: number; }
interface GradeRule { grade: string; minPercentage: number; label: string; isFailing: boolean; displayOrder: number; }
interface ClassOption { id: string; name: string; track: string; }
interface ExamSubjectWithClass { id: string; classId: string; name: string; totalMarks: number; passMarks: number; displayOrder: number; }

const inp = "h-9 px-2.5 rounded border border-input bg-background text-sm focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none transition-all w-full";

// ─── Subject Manager ──────────────────────────────────────────────────────────
export function SubjectManager({ examSessionId, classes, initialSubjects }: {
  examSessionId: string;
  classes: ClassOption[];
  initialSubjects: ExamSubjectWithClass[];
}) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [copying, setCopying] = useState(false);

  const [subjectsByClass, setSubjectsByClass] = useState<Record<string, Subject[]>>(() => {
    const map: Record<string, Subject[]> = {};
    for (const cls of classes) {
      map[cls.id] = initialSubjects
        .filter(s => s.classId === cls.id)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(s => ({ id: s.id, name: s.name, totalMarks: s.totalMarks, passMarks: s.passMarks, displayOrder: s.displayOrder }));
    }
    return map;
  });

  const subjects = subjectsByClass[selectedClass] ?? [];

  function updateSubject(idx: number, field: keyof Subject, value: string | number) {
    setSubjectsByClass(prev => ({
      ...prev,
      [selectedClass]: prev[selectedClass].map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  }
  function addSubject() {
    setSubjectsByClass(prev => ({
      ...prev,
      [selectedClass]: [...(prev[selectedClass] ?? []), { name: "", totalMarks: 100, passMarks: 35, displayOrder: (prev[selectedClass]?.length ?? 0) }],
    }));
  }
  function removeSubject(idx: number) {
    setSubjectsByClass(prev => ({ ...prev, [selectedClass]: prev[selectedClass].filter((_, i) => i !== idx) }));
  }

  function save() {
    startTransition(async () => {
      const result = await saveExamSubjects({ examSessionId, classId: selectedClass, subjects });
      if (result.success) toast.success("Subjects saved");
      else toast.error("Failed to save");
    });
  }

  async function copy() {
    setCopying(true);
    const result = await copySubjectsFromLastExam(examSessionId, selectedClass);
    setCopying(false);
    if (result.success) {
      toast.success(`Copied ${result.count} subjects from previous exam`);
      // Reload page to reflect
      window.location.reload();
    } else toast.error(result.error ?? "No previous subjects found");
  }

  return (
    <div className="space-y-4">
      {/* Class picker */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium shrink-0">Class:</label>
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          className="h-9 px-3 rounded border border-input bg-background text-sm outline-none focus:ring-1 focus:ring-primary/30">
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={copy} disabled={copying} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded hover:bg-muted transition-colors disabled:opacity-50">
          {copying ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />} Copy from last exam
        </button>
      </div>

      {/* Subject table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-8">#</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Subject Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Total Marks</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Pass Marks</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subjects.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No subjects added. Click &ldquo;Add Subject&rdquo; or copy from last exam.</td></tr>
            )}
            {subjects.map((s, i) => (
              <tr key={i} className="hover:bg-muted/10">
                <td className="px-4 py-2 text-muted-foreground text-xs">{i + 1}</td>
                <td className="px-4 py-2"><input value={s.name} onChange={e => updateSubject(i, "name", e.target.value)} className={inp} placeholder="e.g. English, Quran, Thareek" /></td>
                <td className="px-4 py-2"><input type="number" value={s.totalMarks} onChange={e => updateSubject(i, "totalMarks", Number(e.target.value))} className={inp} min={1} /></td>
                <td className="px-4 py-2"><input type="number" value={s.passMarks} onChange={e => updateSubject(i, "passMarks", Number(e.target.value))} className={inp} min={1} /></td>
                <td className="px-4 py-2"><button onClick={() => removeSubject(i)} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={addSubject} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-dashed border-border rounded hover:bg-muted transition-colors">
          <Plus size={14} /> Add Subject
        </button>
        <button onClick={save} disabled={isPending} className="px-5 py-1.5 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5">
          {isPending ? <Loader2 size={13} className="animate-spin" /> : null} Save Subjects
        </button>
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
