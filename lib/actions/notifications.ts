"use server";

import { requireRole } from "@/lib/auth/helpers";
import { notificationService } from "@/lib/services/notifications";

export async function getBellNotifications() {
  const session = await requireRole(["parent", "student"]); // Only these roles have notifications in phase 1
  
  const notifications = await notificationService.getUserNotifications(session.user.id, 10);
  const unreadCount = await notificationService.getUnreadCount(session.user.id);
  
  return { notifications, unreadCount };
}

export async function markNotificationAsRead(id: string) {
  const session = await requireRole(["parent", "student"]);
  await notificationService.markAsRead(id, session.user.id);
  return { success: true };
}

export async function markAllNotificationsAsRead() {
  const session = await requireRole(["parent", "student"]);
  await notificationService.markAllAsRead(session.user.id);
  return { success: true };
}

export async function getPaginatedNotifications(page: number = 1, filter: "all" | "unread" = "all") {
  const session = await requireRole(["parent", "student"]);
  const limit = 20;
  const offset = (page - 1) * limit;
  
  const { db } = await import("@/lib/db");
  const { notifications } = await import("@/lib/db/schema");
  const { eq, and, desc, count } = await import("drizzle-orm");

  const conditions = filter === "unread" 
    ? and(eq(notifications.recipientUserId, session.user.id), eq(notifications.isRead, false))
    : eq(notifications.recipientUserId, session.user.id);

  const [totalRes, items] = await Promise.all([
    db.select({ value: count() }).from(notifications).where(conditions),
    db.query.notifications.findMany({
      where: conditions,
      orderBy: [desc(notifications.createdAt)],
      limit,
      offset,
    })
  ]);

  return {
    items,
    total: totalRes[0].value,
    page,
    totalPages: Math.ceil(totalRes[0].value / limit),
  };
}
