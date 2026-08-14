import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Printer } from "lucide-react";

interface SubjectResult {
  subjectName: string;
  totalMarks: number;
  obtainedMarks: number;
  passMarks: number;
  isPassed: boolean;
  grade: string;
}

interface TrackResult {
  className: string;
  tutorName: string;
  rank: number | null;
  status: string;
  subjectResults: SubjectResult[];
  memorizedJuz?: number;
  toBeObtained?: number;
}

interface ProgressReportCardProps {
  student: {
    admissionNumber: string | null;
    firstName: string;
    lastName: string | null;
    studentCode: string;
  };
  examSessionName: string;
  academicYearLabel: string;
  hifzResult?: TrackResult;
  madrasaResult?: TrackResult;
  schoolResult?: TrackResult;
}

export function ProgressReportCard({
  student,
  examSessionName,
  academicYearLabel,
  hifzResult,
  madrasaResult,
  schoolResult,
}: ProgressReportCardProps) {
  
  const handlePrint = () => {
    window.print();
  };

  const getArabicSubjectName = (name: string) => {
    const lower = name.toLowerCase().trim();
    if (lower.includes("lisan") || lower.includes("لسان")) return "لِسَان";
    if (lower.includes("fiqh") || lower.includes("فقه")) return "فِقْه";
    if (lower.includes("tarikh") || lower.includes("تاريخ") || lower.includes("tareekh")) return "تَارِيخ";
    if (lower.includes("duroos") || lower.includes("دروس")) return "دُرُوس";
    return name;
  };

  const renderResultSection = (title: string, track: "hifz" | "madrasa" | "school", result: TrackResult) => {
    const totalMax = result.subjectResults.reduce((acc, r) => acc + r.totalMarks, 0);
    const totalObtained = result.subjectResults.reduce((acc, r) => acc + r.obtainedMarks, 0);

    return (
      <div className="border border-[#3E7D58]/30 rounded-lg overflow-hidden shadow-sm bg-white print:shadow-none print:border-collapse">
        {/* Track Title Bar */}
        <div className="bg-[#3E7D58] text-white px-4 py-2 text-center font-bold text-sm tracking-wider uppercase print:bg-[#3E7D58] print:text-white">
          {title}
        </div>

        {/* Track Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-[#3E7D58]/10 bg-slate-50/50 text-xs">
          {track === "hifz" ? (
            <>
              <div className="p-2 flex justify-between px-3">
                <span className="text-muted-foreground font-medium">Memorized Juz</span>
                <span className="font-bold">{result.memorizedJuz ?? "—"}</span>
              </div>
              <div className="p-2 flex justify-between px-3">
                <span className="text-muted-foreground font-medium">To be Obtained</span>
                <span className="font-bold">{result.toBeObtained ?? "—"}</span>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 flex justify-between px-3">
                <span className="text-muted-foreground font-medium">Standard</span>
                <span className="font-bold">{result.className}</span>
              </div>
              <div className="p-2 flex justify-between px-3 col-span-1">
                <span className="text-muted-foreground truncate mr-2 font-medium">Class Teacher</span>
                <span className="font-bold truncate">{result.tutorName || "—"}</span>
              </div>
            </>
          )}
          <div className="p-2 flex justify-between px-3">
            <span className="text-muted-foreground font-medium">Rank</span>
            <span className="font-bold">{result.rank ?? "—"}</span>
          </div>
          <div className="p-2 flex justify-between px-3">
            <span className="text-muted-foreground font-medium">Status</span>
            <span className={cn(
              "font-bold uppercase",
              result.status === "PASS" ? "text-emerald-700" : "text-rose-600"
            )}>{result.status}</span>
          </div>
        </div>

        {/* Marks Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-t border-[#3E7D58]/20">
            <thead>
              <tr className="bg-[#4a8a64]/10 text-[#2f6544] font-bold">
                <th className="px-4 py-2 border-r border-[#3E7D58]/10">SUBJECT</th>
                {result.subjectResults.map((s, idx) => (
                  <th key={idx} className="px-3 py-2 text-center border-r border-[#3E7D58]/10 uppercase font-semibold">
                    {track === "madrasa" ? getArabicSubjectName(s.subjectName) : s.subjectName}
                  </th>
                ))}
                <th className="px-4 py-2 text-center">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {/* Max Marks Row */}
              <tr className="border-b border-t border-[#3E7D58]/10 bg-slate-50/20 text-muted-foreground font-medium">
                <td className="px-4 py-1.5 border-r border-[#3E7D58]/10 font-medium">Max. Mark</td>
                {result.subjectResults.map((s, idx) => (
                  <td key={idx} className="px-3 py-1.5 text-center border-r border-[#3E7D58]/10 font-mono">
                    {s.totalMarks}
                  </td>
                ))}
                <td className="px-4 py-1.5 text-center font-mono font-semibold">{totalMax}</td>
              </tr>
              {/* Scored Row */}
              <tr className="font-semibold text-foreground bg-white">
                <td className="px-4 py-2 border-r border-[#3E7D58]/10 font-bold">Scored</td>
                {result.subjectResults.map((s, idx) => (
                  <td key={idx} className="px-3 py-2 text-center border-r border-[#3E7D58]/10 font-mono text-sm">
                    {s.obtainedMarks}
                  </td>
                ))}
                <td className="px-4 py-2 text-center font-mono text-sm font-bold text-[#2f6544]">{totalObtained}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const hasAnyResult = hifzResult || madrasaResult || schoolResult;

  return (
    <div className="space-y-4">
      {/* Action / Print Toolbar */}
      <div className="flex justify-end gap-2 print:hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#3E7D58] hover:bg-[#3E7D58]/90 text-white transition-all shadow-sm cursor-pointer"
        >
          <Printer size={13} />
          Print Report Card
        </button>
      </div>

      <Card className="border border-slate-200 shadow-lg p-6 sm:p-8 max-w-4xl mx-auto bg-white print:border-none print:shadow-none print:p-0">
        <CardContent className="p-0 space-y-6">
          {/* ── Report Card Header ─────────────────────────────────────── */}
          <div className="flex flex-col items-center text-center space-y-2 border-b border-[#3E7D58]/20 pb-5">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2">
              <svg className="w-12 h-12 text-[#3E7D58]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 8C8 10 5.9 16.1 5.9 16.1S12 15 16 10c1.7-2.1 1-2 1-2zM4 2c1.7 4 3.7 9 8 11.2C17.7 10 20 4 20 4s-4.5 1-9 5C7.2 5.5 4 2 4 2z" />
              </svg>
            </div>

            {/* Title / Name */}
            <div>
              <p className="font-serif text-lg font-bold text-[#3E7D58] tracking-wide" dir="rtl">
                كلية تحفيظ القرآن لمجمع مليبار الإسلامي
              </p>
              <h1 className="font-serif text-xl font-extrabold text-[#3E7D58] tracking-tight leading-none mt-0.5">
                MIC THAHFEEZUL QUR'AN COLLEGE
              </h1>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-medium">
                Udma West, Udma P.O, Kasaragod Dt., Kerala, India, 671319
              </p>
            </div>

            {/* Session Title Badge */}
            <div className="bg-[#3E7D58] text-white px-5 py-1.5 rounded text-xs font-bold uppercase tracking-widest mt-3 shadow-sm print:bg-[#3E7D58] print:text-white">
              PROGRESS REPORT {examSessionName.toUpperCase()}
            </div>
          </div>

          {/* ── Student Information Grid ─────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-sm border-b border-[#3E7D58]/20 pb-5 px-1">
            <div className="flex justify-between sm:justify-start gap-4">
              <span className="text-muted-foreground w-20 flex-shrink-0">Ad. No :</span>
              <span className="font-semibold text-foreground">{student.studentCode}</span>
            </div>
            <div className="flex justify-between sm:justify-start gap-4">
              <span className="text-muted-foreground w-20 flex-shrink-0">Name :</span>
              <span className="font-semibold text-foreground uppercase">{student.firstName} {student.lastName ?? ""}</span>
            </div>
            <div className="flex justify-between sm:justify-start gap-4">
              <span className="text-muted-foreground w-20 flex-shrink-0">Class :</span>
              <span className="font-semibold text-foreground">{hifzResult?.className || madrasaResult?.className || schoolResult?.className || "—"}</span>
            </div>
            <div className="flex justify-between sm:justify-start gap-4">
              <span className="text-muted-foreground w-20 flex-shrink-0">Mentor :</span>
              <span className="font-semibold text-foreground uppercase">{hifzResult?.tutorName || madrasaResult?.tutorName || schoolResult?.tutorName || "—"}</span>
            </div>
          </div>

          {/* ── Results Tables Container ─────────────────────────────────── */}
          <div className="space-y-6">
            {!hasAnyResult ? (
              <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-slate-200 rounded-lg">
                No exam results published for this period.
              </div>
            ) : (
              <>
                {hifzResult && renderResultSection("HIFZ EXAM RESULT", "hifz", hifzResult)}
                {madrasaResult && renderResultSection("HIFZ MADRASA RESULT", "madrasa", madrasaResult)}
                {schoolResult && renderResultSection("HIFZ SCHOOL RESULT", "school", schoolResult)}
              </>
            )}
          </div>

          {/* ── Report Card Signatures / Footer ───────────────────────────── */}
          <div className="pt-8 border-t border-[#3E7D58]/10 px-2">
            <div className="text-xs text-muted-foreground flex items-center justify-between gap-4 mt-2">
              <span>Remarks: __________________________________________________</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center mt-12 text-xs">
              <div className="flex flex-col items-center justify-end">
                <span className="w-24 border-b border-slate-300 pb-1 font-mono text-[9px] text-muted-foreground/60 italic">Signature</span>
                <span className="font-bold text-foreground mt-2">Class teacher</span>
              </div>
              <div className="flex flex-col items-center justify-end">
                <span className="w-24 border-b border-slate-300 pb-1 font-mono text-[9px] text-muted-foreground/60 italic">Signature</span>
                <span className="font-bold text-foreground mt-2">Guardian</span>
              </div>
              <div className="flex flex-col items-center justify-end">
                <span className="w-24 border-b border-slate-300 pb-1 font-mono text-[9px] text-muted-foreground/60 italic">Signature</span>
                <span className="font-bold text-foreground mt-2">Principal</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Embedded Print CSS specifically for reports */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
            background: white !important;
            color: black !important;
          }
          aside, nav, header, button, .print\\:hidden, [role="navigation"] {
            display: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:bg-\\[\\#3E7D58\\] {
            background-color: #3E7D58 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:text-white {
            color: white !important;
          }
          .print\\:border-collapse {
            border-collapse: collapse !important;
          }
          /* Show report card specifically */
          .print\\:p-0, .print\\:p-0 * {
            visibility: visible;
          }
          /* Align print to cover page */
          div.space-y-4 {
            margin: 0 !important;
            padding: 0 !important;
          }
          div.max-w-4xl {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}} />
    </div>
  );
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");
