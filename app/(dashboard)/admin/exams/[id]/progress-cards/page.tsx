import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examinations, students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { getProgressCardData } from "@/lib/actions/progress-cards";
import { Printer } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ProgressCardsPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { studentId } = await searchParams;

  const examination = await db.query.examinations.findFirst({
    where: eq(examinations.id, id),
  });

  if (!examination) notFound();

  // Fetch all active students for the dropdown
  const allStudents = await db.query.students.findMany({
    where: eq(students.status, "active"),
    orderBy: (s, { asc }) => [asc(s.firstName)],
  });

  let cardData = null;
  if (studentId) {
    const result = await getProgressCardData(id, studentId);
    if (result.success) {
      cardData = result.data;
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Progress Cards"
          description={`Generate progress cards for ${examination.name}`}
          breadcrumbs={[
            { label: "Admin" },
            { label: "Exams", href: "/admin/exams" },
            { label: examination.name, href: `/admin/exams/${id}` },
            { label: "Progress Cards" },
          ]}
          action={
            cardData && (
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
              >
                <Printer size={16} />
                Print Card
              </button>
            )
          }
        />

        <div className="bg-card border border-border p-4 rounded-lg flex items-end gap-4 mb-8">
          <div className="flex-1 max-w-sm">
            <label className="block text-sm font-medium text-foreground mb-1.5">Select Student</label>
            <form action="">
              <div className="flex gap-2">
                <select 
                  name="studentId" 
                  defaultValue={studentId || ""} 
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm outline-none"
                  required
                >
                  <option value="" disabled>Select a student...</option>
                  {allStudents.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.admissionNumber ? `[${s.admissionNumber}] ` : ""}{s.firstName} {s.lastName}
                    </option>
                  ))}
                </select>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md">
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {cardData ? (
        <div className="bg-white text-black p-8 rounded-lg shadow-sm border border-gray-200 mx-auto print:shadow-none print:border-none print:p-0" style={{ maxWidth: "21cm", minHeight: "29.7cm" }}>
          
          {/* Header */}
          <div className="text-center mb-6 border-b-2 border-green-800 pb-4 flex justify-between items-center">
            <div className="w-20 h-20 bg-green-100 rounded-md flex items-center justify-center border border-green-200">
              {/* Placeholder for Logo */}
              <span className="text-green-800 font-bold text-xs text-center leading-tight">MIC<br/>LOGO</span>
            </div>
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold text-green-800 mb-1">MIC THAHFEEZUL QUR'AN COLLEGE</h1>
              <p className="text-xs text-gray-600">Udma West, Udma P.O, Kasaragod Dt., Kerala, India, 671319</p>
              <div className="mt-3 inline-block bg-green-800 text-white px-6 py-1.5 rounded-full font-bold text-sm tracking-wide">
                PROGRESS REPORT
              </div>
            </div>
            <div className="w-20 h-20"></div> {/* Spacer for balance */}
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-2 gap-y-3 gap-x-8 mb-8 text-sm font-medium px-4">
            <div className="flex"><span className="w-24 text-gray-600">Ad. No :</span> <span>{cardData.admissionNumber}</span></div>
            <div className="flex"><span className="w-24 text-gray-600">Name :</span> <span className="font-bold">{cardData.studentName}</span></div>
            <div className="flex"><span className="w-24 text-gray-600">Class :</span> <span>{cardData.tracks.find((t: any) => t.track === 'hifz')?.className || "—"}</span></div>
            <div className="flex"><span className="w-24 text-gray-600">Mentor :</span> <span>{cardData.tracks.find((t: any) => t.track === 'hifz')?.classTeacher || "—"}</span></div>
          </div>

          {/* Tracks */}
          <div className="space-y-8">
            {cardData.tracks.map((trackData: any) => {
              if (trackData.subjects.length === 0) return null;
              
              const isHifz = trackData.track === 'hifz';
              const isMadrasa = trackData.track === 'madrasa';
              
              const title = isHifz ? "HIFZ EXAM RESULT" : isMadrasa ? "HIFZ MADRASA RESULT" : "HIFZ SCHOOL RESULT";
              const classLabel = isHifz ? "Memorized Juz" : "Standard"; // Example adaptation
              const classValue = isHifz ? "—" : trackData.className;
              const teacherLabel = isHifz ? "To be Obtained" : "Class Teacher"; // Example adaptation
              const teacherValue = isHifz ? "—" : trackData.classTeacher;

              return (
                <div key={trackData.track} className="border border-green-800 overflow-hidden">
                  <div className="bg-green-800 text-white text-center py-1.5 font-bold tracking-widest text-sm">
                    {title}
                  </div>
                  
                  {/* Track Meta */}
                  <div className="grid grid-cols-2 text-sm">
                    <div className="border-r border-b border-green-800 grid grid-cols-2">
                      <div className="p-1.5 font-semibold text-green-900 bg-green-50/50 border-r border-green-800 px-3">{classLabel}</div>
                      <div className="p-1.5 text-center font-medium">{classValue}</div>
                    </div>
                    <div className="border-b border-green-800 grid grid-cols-2">
                      <div className="p-1.5 font-semibold text-green-900 bg-green-50/50 border-r border-green-800 border-l px-3">Rank</div>
                      <div className="p-1.5 text-center font-medium">{trackData.rank}</div>
                    </div>
                    
                    <div className="border-r border-b border-green-800 grid grid-cols-2">
                      <div className="p-1.5 font-semibold text-green-900 bg-green-50/50 border-r border-green-800 px-3">{teacherLabel}</div>
                      <div className="p-1.5 text-center font-medium truncate px-1 text-xs leading-5" title={teacherValue}>{teacherValue}</div>
                    </div>
                    <div className="border-b border-green-800 grid grid-cols-2">
                      <div className="p-1.5 font-semibold text-green-900 bg-green-50/50 border-r border-green-800 border-l px-3">Status</div>
                      <div className={`p-1.5 text-center font-bold ${trackData.status === 'PASS' ? 'text-green-700' : 'text-red-600'}`}>{trackData.status}</div>
                    </div>
                  </div>

                  {/* Subjects Table */}
                  <table className="w-full text-sm text-center">
                    <thead>
                      <tr className="bg-green-700 text-white">
                        <th className="py-1.5 px-2 font-semibold border-r border-green-600 text-left w-1/4 bg-green-50/10"></th>
                        {trackData.subjects.map((s: any, i: number) => (
                          <th key={i} className="py-1.5 px-2 font-semibold border-r border-green-600 uppercase text-xs">{s.name}</th>
                        ))}
                        <th className="py-1.5 px-2 font-bold uppercase text-xs">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-green-800 font-medium">
                        <td className="py-1.5 px-2 text-left font-semibold text-green-900 bg-green-50/50 border-r border-green-800">Max. Mark</td>
                        {trackData.subjects.map((s: any, i: number) => (
                          <td key={i} className="py-1.5 px-2 border-r border-green-800">{s.maxMark}</td>
                        ))}
                        <td className="py-1.5 px-2 font-bold">{trackData.totalMax}</td>
                      </tr>
                      <tr className="font-bold">
                        <td className="py-1.5 px-2 text-left font-semibold text-green-900 bg-green-50/50 border-r border-green-800">Scored</td>
                        {trackData.subjects.map((s: any, i: number) => (
                          <td key={i} className="py-1.5 px-2 border-r border-green-800">{s.scored}</td>
                        ))}
                        <td className="py-1.5 px-2 text-green-800">{trackData.totalScored}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* Signatures */}
          <div className="mt-20 pt-8 flex justify-between items-end px-8 text-sm font-medium text-gray-600">
            <div className="text-center">
              <div className="w-32 border-b border-gray-400 mb-2"></div>
              <p>Class teacher</p>
            </div>
            <div className="text-center">
              <div className="w-32 border-b border-gray-400 mb-2"></div>
              <p>Guardian</p>
            </div>
            <div className="text-center">
              <div className="w-32 border-b border-gray-400 mb-2"></div>
              <p>Principal</p>
            </div>
          </div>
          
        </div>
      ) : studentId ? (
        <div className="text-center p-8 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground">Could not generate progress card for this student.</p>
        </div>
      ) : null}
    </div>
  );
}
