"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2, Save, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getBulkSheet, saveBulkSubjectMarks } from "@/lib/actions/bulk-marks";
import { displayMark, isChangedRow, rowStatus, validateMarkText, type RowState } from "@/lib/exams/bulk-marks-validate";
import type { BulkOptions, BulkSheet } from "@/lib/exams/bulk-marks";

const TRACKS = [
  { value: "school", label: "School" },
  { value: "madrasa", label: "Madrasa" },
  { value: "hifz", label: "Hifz" },
] as const;

const selectCls =
  "h-9 w-full px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-50";

const STATUS_STYLE: Record<string, string> = {
  existing: "bg-emerald-100 text-emerald-800",
  modified: "bg-amber-100 text-amber-800",
  new: "bg-blue-100 text-blue-800",
  not_entered: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  existing: "Existing",
  modified: "Modified",
  new: "New",
  not_entered: "Not Entered",
};

export function BulkMarkEntry({ options }: { options: BulkOptions }) {
  const [examId, setExamId] = useState("");
  const [track, setTrack] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const [sheet, setSheet] = useState<BulkSheet | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, startSave] = useTransition();
  const reqId = useRef(0);

  const exam = options.examinations.find((e) => e.id === examId);
  // One session per (examination, track): never offer another track's session
  const session = exam?.sessions.find((s) => s.track === track);
  const subject = session?.subjects.find((s) => s.id === subjectId);

  // Original (saved) state per student, derived from the freshly loaded sheet
  const orig = useMemo(() => {
    const m: Record<string, RowState | null> = {};
    sheet?.students.forEach((s) => {
      m[s.id] = s.mark ? { value: displayMark(s.mark.value), absent: s.mark.absent } : null;
    });
    return m;
  }, [sheet]);

  const max = sheet?.subject.totalMarks ?? 0;

  const changed = useMemo(
    () => (sheet ? sheet.students.filter((s) => rows[s.id] && isChangedRow(orig[s.id], rows[s.id], max)) : []),
    [sheet, rows, orig, max]
  );
  const hasErrors = !!sheet && sheet.students.some((s) => {
    const r = rows[s.id];
    return r && !r.absent && validateMarkText(r.value, max) !== null;
  });
  const dirty = changed.length > 0;

  // Warn before leaving with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const confirmDiscard = () => !dirty || window.confirm("You have unsaved marks. Discard them?");

  const clearSheet = () => {
    reqId.current++; // invalidate any in-flight load
    setSheet(null);
    setRows({});
    setLoadError(null);
    setQuery("");
  };

  async function load(sessionId: string, sid: string) {
    const id = ++reqId.current;
    setLoading(true);
    setLoadError(null);
    const res = await getBulkSheet({ examSessionId: sessionId, examSubjectId: sid });
    if (id !== reqId.current) return; // stale (selection changed meanwhile)
    setLoading(false);
    if (!res.success) {
      setSheet(null);
      setLoadError(res.error);
      return;
    }
    setSheet(res.sheet);
    const next: Record<string, RowState> = {};
    res.sheet.students.forEach((s) => {
      next[s.id] = s.mark ? { value: displayMark(s.mark.value), absent: s.mark.absent } : { value: "", absent: false };
    });
    setRows(next);
  }

  const onExam = (v: string) => {
    if (!confirmDiscard()) return;
    clearSheet(); setExamId(v); setTrack(""); setSubjectId("");
  };
  const onTrack = (v: string) => {
    if (!confirmDiscard()) return;
    clearSheet(); setTrack(v); setSubjectId("");
  };
  const onSubject = (v: string) => {
    if (!confirmDiscard()) return;
    clearSheet(); setSubjectId(v);
    if (v && session) void load(session.id, v);
  };

  const setValue = (id: string, value: string) =>
    setRows((p) => ({ ...p, [id]: { ...p[id], value, absent: false } }));
  const setAbsent = (id: string, absent: boolean) =>
    setRows((p) => ({ ...p, [id]: { value: absent ? "" : displayMark(sheet?.students.find((s) => s.id === id)?.mark?.value), absent } }));

  const save = () => {
    if (!session || !sheet || !dirty || hasErrors) return;
    startSave(async () => {
      const res = await saveBulkSubjectMarks({
        examSessionId: session.id,
        examSubjectId: sheet.subject.id,
        changes: changed.map((s) => ({ studentId: s.id, value: rows[s.id].value.trim(), absent: rows[s.id].absent })),
      });
      if (!res.success) {
        toast.error(res.error); // edits stay on screen
        return;
      }
      const parts = [res.created && `${res.created} new`, res.updated && `${res.updated} updated`].filter(Boolean);
      toast.success(parts.length ? `Saved: ${parts.join(", ")}` : "Nothing needed saving");
      await load(session.id, sheet.subject.id); // authoritative refresh
    });
  };

  const q = query.trim().toLowerCase();
  const visible = sheet
    ? sheet.students.map((s, i) => ({ s, i })).filter(({ s }) => !q || s.name.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q))
    : [];

  const counts = useMemo(() => {
    if (!sheet) return null;
    let existing = 0, modified = 0, fresh = 0;
    for (const s of sheet.students) {
      const st = rowStatus(orig[s.id], rows[s.id] ?? { value: "", absent: false }, max);
      if (st === "existing") existing++;
      else if (st === "modified") { modified++; existing++; }
      else if (st === "new") fresh++;
    }
    const entered = existing + fresh;
    return { total: sheet.students.length, existing, modified, fresh, remaining: sheet.students.length - entered };
  }, [sheet, rows, orig, max]);

  const focusNext = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-mark-input]:not(:disabled)"));
    inputs[inputs.indexOf(e.currentTarget) + 1]?.focus();
  };

  const noOptions = options.examinations.length === 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Examination</label>
          <select className={selectCls} value={examId} onChange={(e) => onExam(e.target.value)} disabled={saving}>
            <option value="">Select examination</option>
            {options.examinations.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Track</label>
          <select className={selectCls} value={track} onChange={(e) => onTrack(e.target.value)} disabled={!exam || saving}>
            <option value="">Select track</option>
            {TRACKS.filter((t) => exam?.sessions.some((s) => s.track === t.value)).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Exam session</label>
          <select className={selectCls} value={session?.id ?? ""} disabled>
            <option value="">{session ? session.name : "Auto-selected from track"}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Subject</label>
          <select className={selectCls} value={subjectId} onChange={(e) => onSubject(e.target.value)} disabled={!session || saving}>
            <option value="">Select subject</option>
            {session?.subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.className} (max {s.totalMarks})</option>
            ))}
          </select>
        </div>
      </div>

      {noOptions && (
        <div className="rounded-md border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No examination subjects are available for you yet.
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading students…
        </div>
      )}

      {loadError && (
        <div className="rounded-md border bg-destructive/10 text-destructive px-4 py-3 flex gap-3 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" /> {loadError}
        </div>
      )}

      {sheet && subject && counts && (
        <>
          {sheet.locked && (
            <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
              Results are <strong>published</strong>. Mark entry is locked.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-lg border">
            <div>
              <h3 className="font-semibold">{sheet.subject.name} — {subject.className}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {counts.total} students · {counts.existing} entered · {counts.fresh} new · {counts.modified} modified · {counts.remaining} remaining
              </p>
            </div>
            <Button onClick={save} disabled={sheet.locked || !dirty || hasErrors || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {saving ? "Saving…" : dirty ? `Save ${changed.length} Change${changed.length === 1 ? "" : "s"}` : "Save Marks"}
            </Button>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search name or admission no." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {sheet.students.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              No active students are enrolled in this class.
            </div>
          ) : (
            <div className="rounded-md border bg-card overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-muted/50 border-b">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 w-12">No.</th>
                    <th className="px-3 py-2">Admission No.</th>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2 text-right">Max</th>
                    <th className="px-3 py-2">Marks Obtained</th>
                    <th className="px-3 py-2">Absent</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visible.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No students match your search.</td></tr>
                  )}
                  {visible.map(({ s, i }) => {
                    const r = rows[s.id] ?? { value: "", absent: false };
                    const err = r.absent ? null : validateMarkText(r.value, max);
                    const st = rowStatus(orig[s.id], r, max);
                    return (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-jetbrains text-xs">{s.admissionNumber}</td>
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{subject.className}</td>
                        <td className="px-3 py-2 text-right">{max}</td>
                        <td className="px-3 py-2">
                          <Input
                            data-mark-input
                            inputMode="decimal"
                            className="w-24 text-center"
                            value={r.value}
                            disabled={sheet.locked || r.absent || saving}
                            aria-invalid={!!err}
                            aria-label={`Marks for ${s.name}`}
                            placeholder="-"
                            onChange={(e) => setValue(s.id, e.target.value)}
                            onKeyDown={focusNext}
                          />
                          {err && <p className="text-[11px] text-destructive mt-1">{err}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={r.absent}
                            disabled={sheet.locked || saving}
                            aria-label={`Absent: ${s.name}`}
                            onChange={(e) => setAbsent(s.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[st]}`}>
                            {STATUS_LABEL[st]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Only rows you change are saved. Clearing a box does not remove a saved mark.
          </p>
        </>
      )}
    </div>
  );
}
