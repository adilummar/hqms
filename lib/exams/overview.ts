// Admin overview of common examinations and their independent track sessions.
// Every filter is applied in SQL against exam_sessions (track / status / publication), so no
// unrelated rows are loaded and filtered client-side. Plain module.
import { db } from "@/lib/db";
import { examinations, examSessions, academicYears } from "@/lib/db/schema";
import { and, desc, eq, exists, inArray, type SQL } from "drizzle-orm";
import { getSessionProgress, EMPTY_PROGRESS, type SessionProgress } from "@/lib/exams/session-progress";

export type Track = "school" | "madrasa" | "hifz";
export const TRACKS: Track[] = ["school", "madrasa", "hifz"];
export type SessionStatus = "scheduled" | "ongoing" | "completed" | "cancelled";
export type PublicationFilter = "published" | "unpublished";

export interface OverviewFilters {
  academicYearId?: string;
  examinationId?: string;
  track?: Track;
  status?: SessionStatus;
  publication?: PublicationFilter;
}

export interface TrackCell {
  sessionId: string;
  track: Track;
  status: SessionStatus;
  published: boolean;
  publishedAt: Date | null;
  startDate: string | null;
  endDate: string | null;
  progress: SessionProgress;
}

export type OverallStatus = "not_configured" | "scheduled" | "ongoing" | "completed";

export interface OverviewRow {
  id: string;
  name: string;
  yearLabel: string | null;
  academicYearId: string;
  overallStatus: OverallStatus;
  tracks: Partial<Record<Track, TrackCell>>;
}

export interface OverviewSummary {
  commonExams: number;
  configuredTrackExams: number;
  scheduled: number;
  ongoing: number;
  completed: number;
  pendingMarkEntry: number;
  published: number;
  unpublished: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseFilters(sp: Record<string, string | string[] | undefined>): OverviewFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) || undefined;
  };
  const f: OverviewFilters = {};
  const y = one("year");
  if (y && UUID.test(y)) f.academicYearId = y;
  const e = one("exam");
  if (e && UUID.test(e)) f.examinationId = e;
  const t = one("track");
  if (t && (TRACKS as string[]).includes(t)) f.track = t as Track;
  const s = one("status");
  if (s && ["scheduled", "ongoing", "completed", "cancelled"].includes(s)) f.status = s as SessionStatus;
  const p = one("publication");
  if (p === "published" || p === "unpublished") f.publication = p;
  return f;
}

/** Overall status of a common exam, derived only from its configured track sessions. */
export function deriveOverallStatus(statuses: SessionStatus[]): OverallStatus {
  if (statuses.length === 0) return "not_configured";
  if (statuses.includes("ongoing")) return "ongoing";
  const live = statuses.filter((s) => s !== "cancelled");
  if (live.length === 0) return "completed";
  if (live.every((s) => s === "completed")) return "completed";
  if (live.some((s) => s === "completed")) return "ongoing";
  return "scheduled";
}

/** Counts per track session. Never adds marks or results across tracks. */
export function summarize(rows: OverviewRow[]): OverviewSummary {
  const sum: OverviewSummary = {
    commonExams: rows.length,
    configuredTrackExams: 0,
    scheduled: 0,
    ongoing: 0,
    completed: 0,
    pendingMarkEntry: 0,
    published: 0,
    unpublished: 0,
  };
  for (const r of rows) {
    for (const c of Object.values(r.tracks)) {
      if (!c) continue;
      sum.configuredTrackExams++;
      if (c.status === "scheduled") sum.scheduled++;
      if (c.status === "ongoing") sum.ongoing++;
      if (c.status === "completed") sum.completed++;
      if (c.progress.missing > 0) sum.pendingMarkEntry++;
      if (c.published) sum.published++;
      else sum.unpublished++;
    }
  }
  return sum;
}

export async function loadOverview(f: OverviewFilters) {
  // The same predicate decides which exams match and which track cells are shown.
  const sessionConds: SQL[] = [];
  if (f.track) sessionConds.push(eq(examSessions.track, f.track));
  if (f.status) sessionConds.push(eq(examSessions.status, f.status));
  if (f.publication)
    sessionConds.push(eq(examSessions.resultStatus, f.publication === "published" ? "published" : "draft"));

  const examConds: SQL[] = [];
  if (f.academicYearId) examConds.push(eq(examinations.academicYearId, f.academicYearId));
  if (f.examinationId) examConds.push(eq(examinations.id, f.examinationId));
  if (sessionConds.length) {
    examConds.push(
      exists(
        db
          .select({ one: examSessions.id })
          .from(examSessions)
          .where(and(eq(examSessions.examinationId, examinations.id), ...sessionConds))
      )
    );
  }

  const exams = await db
    .select({
      id: examinations.id,
      name: examinations.name,
      academicYearId: examinations.academicYearId,
      yearLabel: academicYears.label,
    })
    .from(examinations)
    .leftJoin(academicYears, eq(academicYears.id, examinations.academicYearId))
    .where(examConds.length ? and(...examConds) : undefined)
    .orderBy(desc(examinations.createdAt));

  const sessions = exams.length
    ? await db
        .select()
        .from(examSessions)
        .where(and(inArray(examSessions.examinationId, exams.map((e) => e.id)), ...sessionConds))
    : [];
  const progress = await getSessionProgress(sessions.map((s) => s.id));

  const rows: OverviewRow[] = exams.map((e) => {
    const tracks: OverviewRow["tracks"] = {};
    for (const s of sessions.filter((x) => x.examinationId === e.id)) {
      tracks[s.track] = {
        sessionId: s.id,
        track: s.track,
        status: s.status,
        published: s.resultStatus === "published",
        publishedAt: s.publishedAt,
        startDate: s.startDate,
        endDate: s.endDate,
        progress: progress.get(s.id) ?? EMPTY_PROGRESS,
      };
    }
    return { ...e, tracks, overallStatus: deriveOverallStatus(Object.values(tracks).map((c) => c!.status)) };
  });
  return { rows, summary: summarize(rows) };
}

export async function listFilterOptions() {
  const [years, exams] = await Promise.all([
    db.select({ id: academicYears.id, label: academicYears.label }).from(academicYears).orderBy(desc(academicYears.startDate)),
    db
      .select({ id: examinations.id, name: examinations.name, academicYearId: examinations.academicYearId })
      .from(examinations)
      .orderBy(desc(examinations.createdAt)),
  ]);
  return { years, exams };
}
