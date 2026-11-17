import { requireAdmin } from "@/lib/auth/helpers";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { ExaminationActions } from "@/components/exams/examination-actions";
import {
  loadOverview,
  listFilterOptions,
  parseFilters,
  TRACKS,
  type OverviewRow,
  type TrackCell,
} from "@/lib/exams/overview";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Exams" };

const STATUS_COLORS: Record<string, string> = {
  not_configured: "bg-muted text-muted-foreground",
  scheduled: "bg-muted text-muted-foreground",
  ongoing: "bg-yellow-500/10 text-yellow-600",
  completed: "bg-green-500/10 text-green-600",
  cancelled: "bg-red-500/10 text-red-600",
};

const TRACK_LABEL = { school: "School", madrasa: "Madrasa", hifz: "Hifz" } as const;
const sel = "h-9 px-2 rounded border border-input bg-background text-sm";

function TrackCellView({ cell, examId, track }: { cell?: TrackCell; examId: string; track: string }) {
  if (!cell) {
    return <span className="text-xs text-muted-foreground italic">Not configured</span>;
  }
  return (
    <Link href={`/admin/exams/${examId}?track=${track}`} className="block space-y-1 hover:opacity-80">
      <div className="flex flex-wrap items-center gap-1">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${STATUS_COLORS[cell.status]}`}>
          {cell.status}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
            cell.published ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-muted text-muted-foreground border-border"
          }`}
        >
          {cell.published ? "Published" : "Unpublished"}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground font-jetbrains">
        {cell.startDate ?? "—"}
        {cell.endDate ? ` → ${cell.endDate}` : ""}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {cell.progress.subjects === 0
          ? "No subjects"
          : `Marks ${cell.progress.entered}/${cell.progress.expected}`}
      </p>
    </Link>
  );
}

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const filters = parseFilters(await searchParams);
  const [{ rows, summary }, options] = await Promise.all([loadOverview(filters), listFilterOptions()]);
  const hasFilters = Object.keys(filters).length > 0;
  const visibleTracks = filters.track ? [filters.track] : TRACKS;
  const examOptions = filters.academicYearId
    ? options.exams.filter((e) => e.academicYearId === filters.academicYearId)
    : options.exams;

  const stat = (label: string, value: number) => (
    <div className="bg-card border border-border rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Exams"
        description="Common examinations and their independent School, Madrasa and Hifz track exams"
        breadcrumbs={[{ label: "Admin" }, { label: "Exams" }]}
        action={
          <Link
            href="/admin/exams/new"
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:bg-primary/90 transition-colors"
          >
            + Create Exam
          </Link>
        }
      />

      {/* Filters: plain GET form → applied in the SQL query on the server */}
      <form method="get" className="bg-card border border-border rounded-lg p-4 mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs space-y-1">
          <span className="block text-muted-foreground">Academic Year</span>
          <select name="year" defaultValue={filters.academicYearId ?? ""} className={sel}>
            <option value="">All</option>
            {options.years.map((y) => (
              <option key={y.id} value={y.id}>{y.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs space-y-1">
          <span className="block text-muted-foreground">Examination</span>
          <select name="exam" defaultValue={filters.examinationId ?? ""} className={sel}>
            <option value="">All</option>
            {examOptions.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs space-y-1">
          <span className="block text-muted-foreground">Track</span>
          <select name="track" defaultValue={filters.track ?? ""} className={sel}>
            <option value="">All tracks</option>
            {TRACKS.map((t) => (
              <option key={t} value={t}>{TRACK_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <label className="text-xs space-y-1">
          <span className="block text-muted-foreground">Exam Status</span>
          <select name="status" defaultValue={filters.status ?? ""} className={sel}>
            <option value="">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="text-xs space-y-1">
          <span className="block text-muted-foreground">Result Publication</span>
          <select name="publication" defaultValue={filters.publication ?? ""} className={sel}>
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </label>
        <button className="h-9 px-4 rounded bg-primary text-primary-foreground text-sm font-medium">Apply</button>
        {hasFilters && (
          <Link href="/admin/exams" className="h-9 px-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            Clear
          </Link>
        )}
      </form>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        {stat("Common exams", summary.commonExams)}
        {stat("Track exams configured", summary.configuredTrackExams)}
        {stat("Scheduled", summary.scheduled)}
        {stat("Ongoing", summary.ongoing)}
        {stat("Completed", summary.completed)}
        {stat("Pending mark entry", summary.pendingMarkEntry)}
        {stat("Published", summary.published)}
        {stat("Unpublished", summary.unpublished)}
      </div>

      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-16 text-center">
          <p className="text-muted-foreground text-sm mb-4">
            {hasFilters ? "No examinations match these filters." : "No examinations yet."}
          </p>
          {!hasFilters && (
            <Link href="/admin/exams/new" className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-sm">
              Create First Examination
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Examination</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Academic Year</th>
                  {visibleTracks.map((t) => (
                    <th key={t} className="text-left px-5 py-3 font-medium text-muted-foreground">{TRACK_LABEL[t]}</th>
                  ))}
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Overall Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((exam: OverviewRow) => (
                  <tr key={exam.id} className="hover:bg-muted/20 transition-colors align-top">
                    <td className="px-5 py-3 font-medium">{exam.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{exam.yearLabel ?? "—"}</td>
                    {visibleTracks.map((t) => (
                      <td key={t} className="px-5 py-3">
                        <TrackCellView cell={exam.tracks[t]} examId={exam.id} track={t} />
                      </td>
                    ))}
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[exam.overallStatus]}`}>
                        {exam.overallStatus.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <ExaminationActions examId={exam.id} examName={exam.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
