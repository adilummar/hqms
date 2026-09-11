import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parentMeetings } from "@/lib/db/schema";
import { notificationService } from "@/lib/services/notifications";
import { eq, gte, lt, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // FAIL CLOSED: If CRON_SECRET is missing, or auth doesn't match exactly, reject.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 1. Parent Meeting Reminders (1 day before)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

    // Find meetings scheduled for tomorrow
    const upcomingMeetings = await db.query.parentMeetings.findMany({
      where: eq(parentMeetings.meetingDate, tomorrowStr),
    });

    const recipients = await notificationService.resolveMeetingAnnouncementRecipients();

    for (const meeting of upcomingMeetings) {
      const dateString = tomorrow.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      
      await notificationService.createNotification({
        type: "parent_meeting_reminder",
        title: "Parent Meeting Tomorrow",
        body: `Reminder: The parent meeting "${meeting.title}" is scheduled for tomorrow, ${dateString}.`,
        entityType: "parent_meeting",
        entityId: meeting.id,
        deepLink: `/parent`,
        recipients,
        idempotencyKey: `parent_meeting_reminder:${meeting.id}`,
      });
    }

    return NextResponse.json({ success: true, processedMeetings: upcomingMeetings.length });
  } catch (error) {
    console.error("Failed to run daily cron:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
