import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

async function seedDummyData() {
  console.log("🌱 Generating Dummy Data...");
  
  console.log("🧹 Cleaning up old dummy data...");
  await db.execute(sql`
    DELETE FROM attendance_records;
    DELETE FROM hifz_daily_entries;
    DELETE FROM juz_tracker;
    DELETE FROM monthly_targets;
    DELETE FROM enrollments;
    DELETE FROM parents;
    DELETE FROM students;
    DELETE FROM users WHERE role = 'parent';
  `);


  let currentYear = await db.query.academicYears.findFirst({
    where: eq(schema.academicYears.isCurrent, true),
  });

  if (!currentYear) {
    console.log("⚠️ No active academic year found, creating one...");
    const [year] = await db.insert(schema.academicYears).values({
      label: "2024-25",
      startDate: new Date("2024-06-01"),
      endDate: new Date("2025-05-31"),
      isCurrent: true,
    }).returning();
    currentYear = year;
  }

  const yearId = currentYear.id;
  
  const adminUser = await db.query.users.findFirst({
    where: eq(schema.users.role, "super_admin"),
  });
  
  if (!adminUser) {
    console.log("⚠️ No super_admin found. Please run `npm run db:seed` first.");
    process.exit(1);
  }

  const hifzClasses = await db.query.classes.findMany({ where: eq(schema.classes.track, "hifz") });
  const madrasaClasses = await db.query.classes.findMany({ where: eq(schema.classes.track, "madrasa") });
  const schoolClasses = await db.query.classes.findMany({ where: eq(schema.classes.track, "school") });

  if (hifzClasses.length === 0 || madrasaClasses.length === 0 || schoolClasses.length === 0) {
    console.log("⚠️ Missing classes. Please run `npm run db:seed` first.");
    process.exit(1);
  }

  console.log("👥 Generating 30 dummy students...");
  const firstNames = ["Abdullah", "Mohammed", "Ali", "Hassan", "Hussain", "Fatima", "Aisha", "Zainab", "Khadija", "Umar", "Usman", "Abu Bakr", "Bilal", "Yusuf", "Ibrahim"];
  const lastNames = ["Khan", "Ahmed", "Syed", "Qureshi", "Shaikh", "Memon", "Ansari", "Patel"];

  const students = [];
  const passwordHash = await bcrypt.hash("password123", 10);

  for (let i = 1; i <= 30; i++) {
    const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const studentCode = `HQMS-2024-${String(i).padStart(4, "0")}`;

    const [student] = await db.insert(schema.students).values({
      studentCode,
      firstName: fName,
      lastName: lName,
      dateOfBirth: "2010-01-01",
      gender: Math.random() > 0.3 ? "male" : "female",
      bloodGroup: "O+",
      address: "123 Main St",
      admissionDate: "2024-06-01",
      admissionYearId: yearId,
      status: "active",
    }).returning();
    students.push(student);

    const [parentUser] = await db.insert(schema.users).values({
      username: `parent_${studentCode.toLowerCase()}`,
      passwordHash,
      role: "parent",
      isActive: true,
    }).returning();

    await db.insert(schema.parents).values({
      userId: parentUser.id,
      studentId: student.id,
      fatherName: `${fName} Sr.`,
      primaryPhone: `98765${String(i).padStart(5, "0")}`,
    });

    // Enrollments
    const hCls = hifzClasses[i % hifzClasses.length].id;
    const mCls = madrasaClasses[i % madrasaClasses.length].id;
    const sCls = schoolClasses[i % schoolClasses.length].id;

    await db.insert(schema.enrollments).values([
      { studentId: student.id, classId: hCls, academicYearId: yearId, yearOfStudy: "1", status: "active" },
      { studentId: student.id, classId: mCls, academicYearId: yearId, yearOfStudy: "1", status: "active" },
      { studentId: student.id, classId: sCls, academicYearId: yearId, yearOfStudy: "1", status: "active" },
    ]);
  }

  console.log("📅 Generating 5 months of historical data (Attendance, Hifz, Targets)...");
  
  const today = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 5);

  const days = [];
  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    // Skip Sundays
    if (d.getDay() !== 0) days.push(new Date(d));
  }

  // Monthly Targets
  const months = new Set(days.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`));
  
  for (let idx = 0; idx < students.length; idx++) {
    const student = students[idx];
    const category = idx % 3; // 0: High, 1: Normal, 2: Low
    const hCls = hifzClasses[(idx + 1) % hifzClasses.length].id;

    let targetJuz = 1.5;
    let attendanceProb = 0.90;
    let pagesPerDay = () => Math.floor(Math.random() * 2) + 1; // 1-2 pages
    let sabaqJuzProb = 0.75;
    let dauraProb = 0.70;

    if (category === 0) { // High
      targetJuz = 2.5;
      attendanceProb = 0.98;
      pagesPerDay = () => Math.floor(Math.random() * 2) + 2; // 2-3 pages
      sabaqJuzProb = 0.95;
      dauraProb = 0.90;
    } else if (category === 2) { // Low
      targetJuz = 0.5;
      attendanceProb = 0.75;
      pagesPerDay = () => Math.floor(Math.random() * 2); // 0-1 pages
      sabaqJuzProb = 0.50;
      dauraProb = 0.40;
    }

    for (const monthStr of months) {
      const [y, m] = monthStr.split("-");
      await db.insert(schema.monthlyTargets).values({
        studentId: student.id,
        month: parseInt(m, 10),
        year: parseInt(y, 10),
        targetJuz: targetJuz.toString(),
        setBy: adminUser.id,
      });
    }

    let currentJuz = Math.floor(Math.random() * 10) + 1;
    let currentPageInJuz = 0;
    const completedJuzes = Array.from({ length: currentJuz - 1 }, (_, i) => i + 1);
    const trackedJuzes = new Set<number>();

    for (const j of completedJuzes) {
      trackedJuzes.add(j);
      await db.insert(schema.juzTracker).values({
        studentId: student.id,
        juzNumber: j,
        status: "completed",
        completionDate: formatDate(startDate),
      });
    }

    for (const date of days) {
      const dateStr = formatDate(date);
      
      const rand = Math.random();
      let status: "present" | "absent" | "leave" = "present";
      let leaveType: "sick_leave" | null = null;
      if (rand > attendanceProb) {
        if (Math.random() > 0.5) status = "absent";
        else { status = "leave"; leaveType = "sick_leave"; }
      }

      await db.insert(schema.attendanceRecords).values({
        studentId: student.id,
        classId: hCls,
        track: "hifz",
        date: dateStr,
        status,
        leaveType,
        recordedBy: adminUser.id,
      });

      if (status === "present") {
        if (!trackedJuzes.has(currentJuz)) {
          trackedJuzes.add(currentJuz);
          await db.insert(schema.juzTracker).values({
            studentId: student.id,
            juzNumber: currentJuz,
            status: "in_progress",
            startDate: dateStr,
          });
        }

        const pages = pagesPerDay();
        
        const sabaqJuzGiven = Math.random() < sabaqJuzProb;
        let dauraJuzNumbers: number[] | null = null;
        if (Math.random() < dauraProb && completedJuzes.length > 0) {
          dauraJuzNumbers = [completedJuzes[Math.floor(Math.random() * completedJuzes.length)]];
        }

        const sabaqFromPage = currentPageInJuz + 1;
        let sabaqToPage = currentPageInJuz + pages;
        if (sabaqToPage > 20) sabaqToPage = 20;
        let actualPages = sabaqToPage - sabaqFromPage + 1;
        if (actualPages <= 0) actualPages = 0;

        await db.insert(schema.hifzDailyEntries).values({
          studentId: student.id,
          date: dateStr,
          recordedBy: adminUser.id,
          sabaqFromPage: actualPages > 0 ? String(sabaqFromPage) : null,
          sabaqToPage: actualPages > 0 ? String(sabaqToPage) : null,
          sabaqPages: String(actualPages),
          sabaqJuzNumber: currentJuz,
          sabaqJuzGiven,
          dauraJuzNumbers,
        });

        currentPageInJuz += actualPages;

        if (currentPageInJuz >= 20) {
          await db.execute(sql`
            UPDATE juz_tracker SET status = 'completed', completion_date = ${dateStr}::date
            WHERE student_id = ${student.id} AND juz_number = ${currentJuz}
          `);
          completedJuzes.push(currentJuz);
          currentJuz++;
          if (currentJuz > 30) {
            currentJuz = 30;
            currentPageInJuz = 20; // stop advancing
          } else {
            currentPageInJuz = 0;
          }
        }
      }
    }
  }

  console.log("✅ Dummy data generation complete!");
  await pool.end();
}

seedDummyData().catch((err) => {
  console.error("❌ Dummy Data Seed failed:", err);
  process.exit(1);
});
