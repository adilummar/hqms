import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function seed() {
  console.log("🌱 Seeding HQMS database...");

  // 1. Create academic year
  console.log("📅 Creating academic year 2024-25...");
  const [academicYear] = await db
    .insert(schema.academicYears)
    .values({
      label: "2024-25",
      startDate: new Date("2024-06-01"),
      endDate: new Date("2025-05-31"),
      isCurrent: true,
    })
    .onConflictDoNothing()
    .returning();

  const yearId = academicYear?.id ?? (
    await db.query.academicYears.findFirst({
      where: eq(schema.academicYears.label, "2024-25"),
    })
  )!.id;

  // 2. Create super_admin user
  console.log("👤 Creating super_admin user...");
  const passwordHash = await bcrypt.hash("hqms@admin", 12);
  await db
    .insert(schema.users)
    .values({
      username: "admin",
      email: "admin@hqms.local",
      passwordHash,
      role: "super_admin",
      isActive: true,
    })
    .onConflictDoNothing();

  // 3. Create default classes
  console.log("🏫 Creating default classes...");

  // Hifz classes
  const hifzClasses = ["HA", "HB", "HC"];
  for (let i = 0; i < hifzClasses.length; i++) {
    await db
      .insert(schema.classes)
      .values({
        name: hifzClasses[i],
        track: "hifz",
        academicYearId: yearId,
        displayOrder: i,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // School classes
  const schoolClasses = ["Class 4", "Class 5", "Class 6", "Class 7"];
  for (let i = 0; i < schoolClasses.length; i++) {
    await db
      .insert(schema.classes)
      .values({
        name: schoolClasses[i],
        track: "school",
        academicYearId: yearId,
        displayOrder: i,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // Madrasa classes
  const madrasaClasses = ["M1", "M2"];
  for (let i = 0; i < madrasaClasses.length; i++) {
    await db
      .insert(schema.classes)
      .values({
        name: madrasaClasses[i],
        track: "madrasa",
        academicYearId: yearId,
        displayOrder: i,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // 4. Default settings
  console.log("⚙️ Creating default settings...");
  const defaultSettings = [
    { key: "student_login_enabled", value: "false", description: "Allow students to log in" },
    { key: "current_academic_year", value: "2024-25", description: "Current academic year label" },
    { key: "hifz_year1_monthly_target", value: "1", description: "Default monthly Juz target for 1st year" },
    { key: "hifz_year2_monthly_target", value: "2", description: "Default monthly Juz target for 2nd year" },
    { key: "hifz_year3_monthly_target", value: "2.5", description: "Default monthly Juz target for 3rd year" },
    { key: "low_attendance_threshold", value: "75", description: "Attendance % below which student is flagged" },
  ];

  for (const s of defaultSettings) {
    await db.insert(schema.settings).values(s).onConflictDoNothing();
  }

  // 5. Default remarks options
  console.log("📝 Creating default remarks options...");

  const sabaqRemarks = [
    "Holiday",
    "Student Sick",
    "Usthad Absent",
    "Exam Day",
    "Travel",
    "Other",
  ];
  for (let i = 0; i < sabaqRemarks.length; i++) {
    await db
      .insert(schema.remarksOptions)
      .values({ category: "sabaq", label: sabaqRemarks[i], displayOrder: i })
      .onConflictDoNothing();
  }

  const sabaqJuzRemarks = [
    "Not Ready",
    "Time Shortage",
    "Holiday",
    "Student Sick",
    "Other",
  ];
  for (let i = 0; i < sabaqJuzRemarks.length; i++) {
    await db
      .insert(schema.remarksOptions)
      .values({
        category: "sabaq_juz",
        label: sabaqJuzRemarks[i],
        displayOrder: i,
      })
      .onConflictDoNothing();
  }

  const dauraRemarks = ["Not Assigned Yet", "Holiday", "Exam", "Other"];
  for (let i = 0; i < dauraRemarks.length; i++) {
    await db
      .insert(schema.remarksOptions)
      .values({ category: "daura", label: dauraRemarks[i], displayOrder: i })
      .onConflictDoNothing();
  }

  const attendanceRemarks = [
    "Sick Leave",
    "Family Emergency",
    "Travel",
    "Other",
  ];
  for (let i = 0; i < attendanceRemarks.length; i++) {
    await db
      .insert(schema.remarksOptions)
      .values({
        category: "attendance",
        label: attendanceRemarks[i],
        displayOrder: i,
      })
      .onConflictDoNothing();
  }

  // 6. Default Leave Tracker activities
  console.log("🕌 Creating default leave tracker activities...");
  const defaultActivities = [
    { name: "Tahajjud",        description: "Pre-Fajr prayer",          displayOrder: 0, isSuspendedOnHoliday: false },
    { name: "Subh Jama'ah",    description: "Fajr congregation",        displayOrder: 1, isSuspendedOnHoliday: false },
    { name: "Sabaq Juz",       description: "Morning lesson revision",  displayOrder: 2, isSuspendedOnHoliday: true  },
    { name: "Zuha Namaz",      description: "Mid-morning prayer",       displayOrder: 3, isSuspendedOnHoliday: false },
    { name: "Zuhr Jama'ah",    description: "Midday congregation",      displayOrder: 4, isSuspendedOnHoliday: false },
    { name: "Daura",           description: "Afternoon revision",       displayOrder: 5, isSuspendedOnHoliday: true  },
    { name: "Asr Jama'ah",     description: "Afternoon congregation",   displayOrder: 6, isSuspendedOnHoliday: false },
    { name: "Play",            description: "Recreation time",          displayOrder: 7, isSuspendedOnHoliday: false },
    { name: "Maghrib Jama'ah", description: "Sunset congregation",      displayOrder: 8, isSuspendedOnHoliday: false },
    { name: "Isha Jama'ah",    description: "Night congregation",       displayOrder: 9, isSuspendedOnHoliday: false },
  ];
  for (const act of defaultActivities) {
    await db
      .insert(schema.leaveActivities)
      .values({ ...act, isActive: true })
      .onConflictDoNothing();
  }

  console.log("✅ Seed complete!");

  console.log("");
  console.log("🔑 Login credentials:");
  console.log("   Username: admin");
  console.log("   Password: hqms@admin");
  console.log("   Role: super_admin");

  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
