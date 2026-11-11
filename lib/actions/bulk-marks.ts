"use server";

import { auth } from "@/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { applyBulkMarks, loadBulkSheet, type BulkUser } from "@/lib/exams/bulk-marks";
import { db } from "@/lib/db";
import { examSubjects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Every action re-authenticates and re-verifies the session/subject/student relationships
// on the server; client-supplied IDs are never trusted.

async function currentUser(): Promise<BulkUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return null;
  return { id: session.user.id as string, role: session.user.role as string };
}

const ids = z.object({ examSessionId: z.string().uuid(), examSubjectId: z.string().uuid() });

export async function getBulkSheet(input: unknown) {
  const user = await currentUser();
  if (!user) return { success: false as const, error: "Not signed in" };
  const p = ids.safeParse(input);
  if (!p.success) return { success: false as const, error: "Invalid selection" };
  const res = await loadBulkSheet(user, p.data.examSessionId, p.data.examSubjectId);
  return res.ok ? { success: true as const, sheet: res.sheet } : { success: false as const, error: res.error };
}

const saveSchema = ids.extend({
  changes: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        value: z.string().max(10),
        absent: z.boolean(),
      })
    )
    .min(1)
    .max(1000),
});

export async function saveBulkSubjectMarks(input: unknown) {
  const user = await currentUser();
  if (!user) return { success: false as const, error: "Not signed in" };
  const p = saveSchema.safeParse(input);
  if (!p.success) return { success: false as const, error: "Invalid submission" };

  const res = await applyBulkMarks(user, p.data.examSessionId, p.data.examSubjectId, p.data.changes);
  if (!res.ok) return { success: false as const, error: res.error };

  const subject = await db.query.examSubjects.findFirst({ where: eq(examSubjects.id, p.data.examSubjectId), columns: { classId: true } });
  const sid = p.data.examSessionId;
  revalidatePath(`/admin/exams/${sid}/marks`);
  if (subject) {
    revalidatePath(`/admin/exams/${sid}/marks/${subject.classId}`);
    revalidatePath(`/tutor/exams/${sid}/marks/${subject.classId}`);
  }
  return { success: true as const, created: res.created, updated: res.updated, unchanged: res.unchanged };
}
