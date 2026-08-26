"use server";

import { db } from "@/lib/db";
import { examinations, examSessions, examMarks, examSubjects, students, classes, enrollments, users } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function getProgressCardData(examinationId: string, studentId: string) {
  // 1. Fetch Examination and its Sessions
  const exam = await db.query.examinations.findFirst({
    where: eq(examinations.id, examinationId),
    with: {
      examSessions: {
        with: {
          subjects: true,
          gradeRules: { orderBy: (r, { asc }) => [asc(r.displayOrder)] },
        }
      }
    }
  });

  if (!exam) return { success: false, error: "Examination not found" };

  // 2. Fetch Student Details
  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
  });

  if (!student) return { success: false, error: "Student not found" };

  // 3. Fetch Student's Enrollments for the examination's academic year
  const studentEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.studentId, studentId),
      eq(enrollments.academicYearId, exam.academicYearId)
    ),
    with: {
      class: {
        with: { tutor: true }
      }
    }
  });

  // 4. Fetch Marks for this student in all subjects belonging to the exam sessions
  const sessionIds = exam.examSessions.map(s => s.id);
  
  let marks: any[] = [];
  if (sessionIds.length > 0) {
    const allSubjects = await db.query.examSubjects.findMany({
      where: inArray(examSubjects.examSessionId, sessionIds)
    });
    const subjectIds = allSubjects.map(s => s.id);
    
    if (subjectIds.length > 0) {
      marks = await db.query.examMarks.findMany({
        where: and(
          eq(examMarks.studentId, studentId),
          inArray(examMarks.examSubjectId, subjectIds)
        ),
        with: {
          subject: true
        }
      });
    }
  }

  // Structure the result by track
  const tracksData = exam.examSessions.map(session => {
    // Find class the student is enrolled in for this track
    const enrollment = studentEnrollments.find(e => e.class.track === session.track);
    const enrolledClass = enrollment?.class;

    // Filter marks for this specific session
    const sessionMarks = marks.filter(m => m.subject.examSessionId === session.id);

    // Calculate rank for this track (this is complex, usually requires fetching all marks for the class and sorting)
    // For now, we will return the raw marks and max marks
    let totalMax = 0;
    let totalScored = 0;
    const subjectsData = session.subjects
      .filter(s => enrolledClass ? s.classId === enrolledClass.id : true) // Only subjects for their class
      .map(subject => {
        const mark = sessionMarks.find(m => m.examSubjectId === subject.id);
        const scored = mark?.isAbsent ? 0 : Number(mark?.marksObtained ?? 0);
        totalMax += subject.totalMarks;
        totalScored += scored;
        return {
          name: subject.name,
          maxMark: subject.totalMarks,
          scored: mark?.isAbsent ? "AB" : scored,
        };
      });

    // Calculate Grade/Status based on gradeRules
    let status = "FAIL";
    // basic check: if all subjects pass
    const allPassed = session.subjects
      .filter(s => enrolledClass ? s.classId === enrolledClass.id : true)
      .every(s => {
        const mark = sessionMarks.find(m => m.examSubjectId === s.id);
        return mark && !mark.isAbsent && Number(mark.marksObtained) >= s.passMarks;
      });

    if (allPassed && subjectsData.length > 0) status = "PASS";

    return {
      track: session.track,
      className: enrolledClass?.name ?? "—",
      classTeacher: enrolledClass?.tutor?.username ?? "—",
      rank: "-", // Placeholder
      status,
      subjects: subjectsData,
      totalMax,
      totalScored,
    };
  });

  return {
    success: true,
    data: {
      examName: exam.name,
      studentName: `${student.firstName} ${student.lastName ?? ""}`.trim(),
      admissionNumber: student.admissionNumber ?? student.studentCode,
      tracks: tracksData,
    }
  };
}
