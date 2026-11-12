"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Download, FileArchive, FileText, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getBulkProgressCardRoster,
  renderClassProgressCards,
  type BulkRosterRow,
  type RenderedCard,
} from "@/lib/actions/progress-cards-bulk";
import { uniqueName } from "@/lib/exams/progress-card-view";

type Track = "school" | "madrasa" | "hifz";
interface Props {
  years: { id: string; label: string }[];
  exams: { id: string; name: string; academicYearId: string }[];
  classOptions: { examinationId: string; track: Track; classId: string; className: string }[];
}

const BATCH = 5; // students per server request (keeps every request short)
const selectCls =
  "h-9 w-full px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-50";
const TRACK_LABEL: Record<Track, string> = { school: "School", madrasa: "Madrasa", hifz: "Hifz" };

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
const slug = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

export function BulkProgressCards({ years, exams, classOptions }: Props) {
  const [yearId, setYearId] = useState("");
  const [examId, setExamId] = useState("");
  const [track, setTrack] = useState<Track | "">("");
  const [classId, setClassId] = useState("");

  const [roster, setRoster] = useState<BulkRosterRow[] | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<RenderedCard[]>([]);
  const req = useRef(0);

  const yearExams = exams.filter((e) => e.academicYearId === yearId);
  const examTracks = useMemo(
    () => [...new Set(classOptions.filter((c) => c.examinationId === examId).map((c) => c.track))] as Track[],
    [classOptions, examId]
  );
  const classes = classOptions.filter((c) => c.examinationId === examId && c.track === track);
  const year = years.find((y) => y.id === yearId);
  const cls = classes.find((c) => c.classId === classId);

  const reset = (from: "year" | "exam" | "track" | "class") => {
    req.current++;
    if (from === "year") { setExamId(""); }
    if (from === "year" || from === "exam") { setTrack(""); }
    if (from !== "class") { setClassId(""); }
    setRoster(null); setSelected(new Set()); setResults([]); setError(null); setQuery("");
  };

  async function loadRoster(e: string, c: string) {
    const id = ++req.current;
    setLoadingRoster(true);
    const r = await getBulkProgressCardRoster({ examinationId: e, classId: c });
    if (id !== req.current) return; // selection changed while loading
    setLoadingRoster(false);
    if (!r.success) { setError(r.error); setRoster(null); return; }
    setRoster(r.rows);
    setSelected(new Set(r.rows.map((x) => x.id)));
  }

  const q = query.trim().toLowerCase();
  const visible = (roster ?? []).filter((s) => !q || s.name.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q));
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));

  async function generate(only?: string[]) {
    if (!roster) return;
    const ids = only ?? roster.filter((r) => selected.has(r.id)).map((r) => r.id);
    if (ids.length === 0) return;
    setRunning(true);
    setError(null);
    setProgress({ done: 0, total: ids.length });
    const kept = only ? results.filter((r) => r.ok && !only.includes(r.studentId)) : [];
    const collected: RenderedCard[] = [...kept];
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      try {
        const res = await renderClassProgressCards({ examinationId: examId, classId, studentIds: chunk });
        if (res.success) collected.push(...res.results);
        else chunk.forEach((id) => collected.push({ studentId: id, ok: false, error: res.error }));
      } catch {
        chunk.forEach((id) => collected.push({ studentId: id, ok: false, error: "Request failed" }));
      }
      setProgress({ done: Math.min(i + BATCH, ids.length), total: ids.length });
    }
    setResults(collected);
    setRunning(false);
    const failed = collected.filter((r) => !r.ok).length;
    if (failed) toast.error(`${failed} card${failed === 1 ? "" : "s"} failed. You can retry them.`);
    else toast.success(`${collected.length} progress card${collected.length === 1 ? "" : "s"} ready`);
  }

  const okCards = results.filter((r) => r.ok && r.pdf);
  const failedCards = results.filter((r) => !r.ok);
  const nameOf = (id: string) => roster?.find((r) => r.id === id);
  const baseName = `Progress-Cards-${slug(cls?.className ?? "class")}${year ? `-${slug(year.label)}` : ""}`;

  async function downloadZip() {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const used = new Set<string>();
    for (const c of okCards) zip.file(`${uniqueName(c.fileStem ?? c.studentId, used)}.pdf`, b64ToBytes(c.pdf!));
    saveBlob(await zip.generateAsync({ type: "blob", compression: "DEFLATE" }), `${baseName}.zip`);
  }
  async function downloadCombined() {
    const { PDFDocument } = await import("pdf-lib");
    const out = await PDFDocument.create();
    for (const c of okCards) {
      const src = await PDFDocument.load(b64ToBytes(c.pdf!));
      (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p)); // one card = one page
    }
    saveBlob(new Blob([new Uint8Array(await out.save())], { type: "application/pdf" }), `${baseName}.pdf`);
  }
  const downloadOne = (c: RenderedCard) =>
    saveBlob(new Blob([b64ToBytes(c.pdf!)], { type: "application/pdf" }), `${c.fileStem ?? "progress-card"}.pdf`);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Academic year</label>
          <select className={selectCls} value={yearId} disabled={running} onChange={(e) => { reset("year"); setYearId(e.target.value); }}>
            <option value="">Select year</option>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Examination</label>
          <select className={selectCls} value={examId} disabled={!yearId || running} onChange={(e) => { reset("exam"); setExamId(e.target.value); }}>
            <option value="">Select examination</option>
            {yearExams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Track</label>
          <select className={selectCls} value={track} disabled={!examId || running} onChange={(e) => { reset("track"); setTrack(e.target.value as Track); }}>
            <option value="">Select track</option>
            {examTracks.map((t) => <option key={t} value={t}>{TRACK_LABEL[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Class</label>
          <select
            className={selectCls}
            value={classId}
            disabled={!track || running}
            onChange={(e) => { reset("class"); setClassId(e.target.value); if (e.target.value) void loadRoster(examId, e.target.value); }}
          >
            <option value="">Select class</option>
            {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
          </select>
        </div>
      </div>

      {yearId && yearExams.length === 0 && (
        <p className="text-sm text-muted-foreground">No examinations exist for this academic year.</p>
      )}
      {loadingRoster && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading students…</div>
      )}
      {error && (
        <div className="rounded-md border bg-destructive/10 text-destructive px-4 py-3 flex gap-3 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error}
        </div>
      )}

      {roster && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-lg border">
            <div>
              <h3 className="font-semibold">{cls?.className} — {TRACK_LABEL[track as Track]}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selected.size} of {roster.length} students selected
                {roster.some((r) => !r.ready) && ` · ${roster.filter((r) => !r.ready).length} missing data`}
              </p>
            </div>
            <Button onClick={() => generate()} disabled={running || selected.size === 0}>
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              {running ? `Generating ${progress.done}/${progress.total}…` : `Generate ${selected.size} Progress Card${selected.size === 1 ? "" : "s"}`}
            </Button>
          </div>

          {running && (
            <div className="h-2 w-full rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
          )}

          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search name or admission no." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {roster.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              No active students are enrolled in this class.
            </div>
          ) : (
            <div className="rounded-md border bg-card overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-muted/50 border-b">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all shown"
                        checked={allVisibleSelected}
                        disabled={running}
                        onChange={(e) =>
                          setSelected((p) => {
                            const n = new Set(p);
                            visible.forEach((s) => (e.target.checked ? n.add(s.id) : n.delete(s.id)));
                            return n;
                          })
                        }
                      />
                    </th>
                    <th className="px-3 py-2 w-12">No.</th>
                    <th className="px-3 py-2">Admission No.</th>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Card status</th>
                    <th className="px-3 py-2 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visible.map((s) => {
                    const done = results.find((r) => r.studentId === s.id);
                    return (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${s.name}`}
                            checked={selected.has(s.id)}
                            disabled={running}
                            onChange={(e) => setSelected((p) => { const n = new Set(p); e.target.checked ? n.add(s.id) : n.delete(s.id); return n; })}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{roster.indexOf(s) + 1}</td>
                        <td className="px-3 py-2 font-jetbrains text-xs">{s.admissionNumber}</td>
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        <td className="px-3 py-2">{s.className}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${s.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                            {s.ready ? "Ready" : "Missing Data"}
                          </span>
                          {done && !done.ok && <span className="ml-2 text-[11px] text-destructive">{done.error}</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {done?.ok && done.pdf ? (
                            <button className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => downloadOne(done)}>
                              <Download className="h-3.5 w-3.5" /> PDF
                            </button>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {visible.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No students match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {results.length > 0 && !running && (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <p className="text-sm">
                <span className="font-semibold text-emerald-700">{okCards.length} generated</span>
                {failedCards.length > 0 && <span className="font-semibold text-destructive"> · {failedCards.length} failed</span>}
              </p>
              {failedCards.length > 0 && (
                <ul className="text-xs text-destructive list-disc pl-5">
                  {failedCards.map((f) => <li key={f.studentId}>{nameOf(f.studentId)?.name ?? f.studentId}: {f.error}</li>)}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={downloadZip} disabled={okCards.length === 0}><FileArchive className="w-4 h-4 mr-2" /> Download all as ZIP</Button>
                <Button variant="outline" onClick={downloadCombined} disabled={okCards.length === 0}><FileText className="w-4 h-4 mr-2" /> Download combined PDF</Button>
                {failedCards.length > 0 && (
                  <Button variant="outline" onClick={() => generate(failedCards.map((f) => f.studentId))}>Retry {failedCards.length} failed</Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
