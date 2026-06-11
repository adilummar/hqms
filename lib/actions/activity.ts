"use server";

import { db } from "@/lib/db";
import { activityLogs } from "@/lib/db/schema";

/**
 * Log an admin/tutor action to the activity_logs table.
 * Called by every Server Action per RULES.md §4.
 */
export async function logActivity(
  userId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await db.insert(activityLogs).values({
      userId,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (err) {
    // Non-blocking: log errors shouldn't fail the main action
    console.error("[logActivity] Failed to log activity:", err);
  }
}
