// DB helpers for exam subjects. Kept out of the "use server" actions file so they
// can be unit-tested. Every query here is scoped by exam session (which is unique
// per examination + track) and every write checks the class belongs to that track.
import { db } from "@/lib/db";
import { examSessions, examSubjects, classes } from "@/lib/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";

export interface SubjectInput {
  id?: string;
  name: string;
  totalMarks: number;
  passMarks: number;
  displayOrder?: number;
  examDate?: string | null;
}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Make a class's subjects for an exam session equal to `subjects` WITHOUT
 * deleting rows that are merely edited: rows are matched by id (else by name)
 * and updated in place, so marks already entered for them survive. Only
 * subjects that were really removed from the list are deleted.
 */
export async function syncClassSubjects(tx: Tx, examSessionId: string, classId: string, subjects: SubjectInput[]) {
  const existing = await tx
    .select()
    .from(examSubjects)
    .where(and(eq(examSubjects.examSessionId, examSessionId), eq(examSubjects.classId, classId)));
  const unmatched = new Map(existing.map((e) => [e.id, e]));
  const norm = (n: string) => n.trim().toLowerCase();

  for (let i = 0; i < subjects.length; i++) {
    const s = subjects[i];
    let match = s.id ? unmatched.get(s.id) : undefined;
    if (!match) match = [...unmatched.values()].find((e) => norm(e.name) === norm(s.name));
    const values = {
      name: s.name.trim(),
      totalMarks: s.totalMarks,
      passMarks: s.passMarks,
      displayOrder: i,
      examDate: s.examDate || null,
    };
    if (match) {
      unmatched.delete(match.id);
      await tx.update(examSubjects).set(values).where(eq(examSubjects.id, match.id));
    } else {
      await tx.insert(examSubjects).values({ examSessionId, classId, ...values });
    }
  }

  if (unmatched.size > 0) {
    await tx.delete(examSubjects).where(inArray(examSubjects.id, [...unmatched.keys()]));
  }
}

/** Returns the session, or an error when any class does not belong to the session's track. */
export async function assertClassesInTrack(examSessionId: string, classIds: string[]) {
  const exam = await db.query.examSessions.findFirst({ where: eq(examSessions.id, examSessionId) });
  if (!exam) return { ok: false as const, error: "Exam session not found" };
  const rows = await db
    .select({ id: classes.id, track: classes.track })
    .from(classes)
    .where(inArray(classes.id, classIds));
  if (rows.length !== new Set(classIds).size || rows.some((c) => c.track !== exam.track)) {
    return { ok: false as const, error: `Classes must belong to the ${exam.track} track` };
  }
  return { ok: true as const, exam };
}

/**
 * Subjects of the most recent OTHER exam session of the SAME track that has
 * subjects for this class. Never looks at other tracks.
 */
export async function findLastExamSubjects(current: { id: string; track: "school" | "madrasa" | "hifz" }, classId: string) {
  const candidates = await db.query.examSessions.findMany({
    where: and(eq(examSessions.track, current.track), ne(examSessions.id, current.id)),
    with: { subjects: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  const source = candidates.find((c) => c.subjects.some((s) => s.classId === classId));
  return (source?.subjects ?? [])
    .filter((s) => s.classId === classId)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}
