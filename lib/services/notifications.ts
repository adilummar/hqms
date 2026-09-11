import { db } from "@/lib/db";
import { notifications, users, parents, students, enrollments, examSubjects } from "@/lib/db/schema";
import { eq, and, desc, inArray, count } from "drizzle-orm";

export type NotificationType =
  | "exam_results_published"
  | "parent_meeting_announced"
  | "parent_meeting_reminder"
  | "parent_meeting_attendance_recorded"
  | "hifz_entry_created"
  | "juz_completed"
  | "hafiz_milestone"
  | "leave_period_activated";

export interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  deepLink?: string;
  recipients: string[]; // user IDs
  idempotencyKey: string;
}

export const notificationService = {
  async createNotification(params: CreateNotificationParams) {
    if (!params.recipients || params.recipients.length === 0) return;

    try {
      const rows = params.recipients.map((recipientId) => ({
        type: params.type as any, // Cast due to strict Drizzle pgEnum typing
        title: params.title,
        body: params.body,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        deepLink: params.deepLink ?? null,
        recipientUserId: recipientId,
        idempotencyKey: `${params.idempotencyKey}:${recipientId}`, // Make key unique per recipient
      }));

      await db
        .insert(notifications)
        .values(rows)
        .onConflictDoNothing({ target: [notifications.idempotencyKey] });
    } catch (err) {
      console.error("[NotificationService] Failed to create notifications:", err);
    }
  },

  async getUserNotifications(userId: string, limit = 20) {
    return db.query.notifications.findMany({
      where: eq(notifications.recipientUserId, userId),
      orderBy: [desc(notifications.createdAt)],
      limit,
    });
  },

  async getUnreadCount(userId: string) {
    const result = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, userId),
          eq(notifications.isRead, false)
        )
      );
    return Number(result[0]?.count ?? 0);
  },

  async markAsRead(notificationId: string, userId: string) {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientUserId, userId)
        )
      );
  },

  async markAllAsRead(userId: string) {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.recipientUserId, userId),
          eq(notifications.isRead, false)
        )
      );
  },

  // ── Recipient Resolution Methods ────────────────────────────────────────

  async resolveExamResultsRecipients(examSessionId: string): Promise<string[]> {
    // Find all subjects in this session -> classes -> active enrollments -> students
    const sessionSubjects = await db.query.examSubjects.findMany({
      where: eq(examSubjects.examSessionId, examSessionId),
    });
    const classIds = [...new Set(sessionSubjects.map((s) => s.classId))];
    if (classIds.length === 0) return [];

    const activeEnrollments = await db.query.enrollments.findMany({
      where: and(
        inArray(enrollments.classId, classIds),
        eq(enrollments.status, "active")
      ),
    });
    const studentIds = [...new Set(activeEnrollments.map((e) => e.studentId))];
    if (studentIds.length === 0) return [];

    return await this.resolveRecipientsFromStudentIds(studentIds);
  },

  async resolveMeetingAnnouncementRecipients(): Promise<string[]> {
    const activeStudents = await db.query.students.findMany({
      where: eq(students.status, "active"),
      columns: { id: true },
    });
    const studentIds = activeStudents.map((s) => s.id);
    return await this.resolveRecipientsFromStudentIds(studentIds);
  },

  async resolveMeetingAttendanceRecipients(studentId: string): Promise<string[]> {
    return await this.resolveRecipientsFromStudentIds([studentId], false); // Parent only
  },

  async resolveHifzEntryRecipients(studentId: string): Promise<string[]> {
    return await this.resolveRecipientsFromStudentIds([studentId]);
  },

  async resolveLeavePeriodRecipients(): Promise<string[]> {
    const activeStudents = await db.query.students.findMany({
      where: eq(students.status, "active"),
      columns: { id: true },
    });
    const studentIds = activeStudents.map((s) => s.id);
    return await this.resolveRecipientsFromStudentIds(studentIds, false); // Usually parent only for leave
  },

  async resolveRecipientsFromStudentIds(studentIds: string[], includeStudent = true): Promise<string[]> {
    if (studentIds.length === 0) return [];

    const recipientUserIds: string[] = [];

    // Parents
    const activeParents = await db
      .select({ userId: parents.userId })
      .from(parents)
      .innerJoin(users, eq(parents.userId, users.id))
      .where(
        and(
          inArray(parents.studentId, studentIds),
          eq(users.isActive, true)
        )
      );
      
    for (const p of activeParents) {
      if (p.userId) recipientUserIds.push(p.userId);
    }

    // Students
    if (includeStudent) {
      const activeStudents = await db
        .select({ userId: students.userId })
        .from(students)
        .innerJoin(users, eq(students.userId, users.id))
        .where(
          and(
            inArray(students.id, studentIds),
            eq(users.isActive, true)
          )
        );
        
      for (const s of activeStudents) {
        if (s.userId) recipientUserIds.push(s.userId);
      }
    }

    // Return unique IDs
    return [...new Set(recipientUserIds)];
  },
};
