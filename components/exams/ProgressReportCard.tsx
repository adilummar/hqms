import { MicLogo } from "@/components/ui/mic-logo";
import type { CardTrackData, ProgressCardData } from "@/lib/exams/progress-card";

// Printed progress report. Layout mirrors the college's paper card:
// header → student block → HIFZ / MADRASA / SCHOOL result tables → remarks + signatures.
// Pure presentational (no hooks) so it renders on the server for admin and parent pages.

const GREEN = "#2f7d46";
const LINE = "#2f7d46";

const SECTION_TITLE: Record<CardTrackData["track"], string> = {
  hifz: "HIFZ EXAM RESULT",
  madrasa: "HIFZ MADRASA RESULT",
  school: "HIFZ SCHOOL RESULT",
};

/** Header label for a subject column, as printed on the paper card. */
function columnLabel(track: CardTrackData["track"], name: string) {
  const n = name.trim().toLowerCase();
  if (track === "madrasa") {
    if (/lisan|لسان/.test(n)) return "لسان";
    if (/fiqh|فقه/.test(n)) return "فقه";
    if (/tar[ie]*kh|تاريخ/.test(n)) return "تاريخ";
    if (/duroos|durus|دروس/.test(n)) return "دروس";
  }
  if (track === "school") {
    if (/^eng/.test(n)) return "ENG";
    if (/^mal/.test(n)) return "MLM";
    if (/^hin/.test(n)) return "HND";
    if (/^(sci|evs)/.test(n)) return "SCI";
    if (/^(math|mts)/.test(n)) return "MTS";
  }
  return name.toUpperCase();
}

const cell = `border px-2 py-1`;
const cellStyle = { borderColor: LINE } as const;

function TrackSection({ t }: { t: CardTrackData }) {
  const isHifz = t.track === "hifz";
  // null = not recorded for this exam (e.g. older Hifz exams): shown as unavailable, never as 0
  const metaLeft: [string, string | null][] = isHifz
    ? [
        ["Memorized Juz", t.memorizedJuz ?? null],
        ["To be Obtained", t.toBeObtained ?? null],
      ]
    : [
        ["Standard", t.className],
        ["Class Teacher", t.teacher],
      ];
  const metaRight: [string, string][] = [
    ["Rank", t.rank === null ? "—" : String(t.rank)],
    ["Status", t.status],
  ];

  return (
    <section className="break-inside-avoid">
      <table className="w-full border-collapse text-[13px] font-semibold" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th
              colSpan={4}
              className="py-1 text-center text-[15px] font-bold tracking-wide text-white"
              style={{ background: GREEN, border: `1px solid ${LINE}` }}
            >
              {SECTION_TITLE[t.track]}
            </th>
          </tr>
        </thead>
        <tbody>
          {[0, 1].map((i) => (
            <tr key={i}>
              <td className={cell} style={{ ...cellStyle, width: "27%" }}>{metaLeft[i][0]}</td>
              <td className={`${cell} ${isHifz || i === 0 ? "" : "text-[12px]"}`} style={{ ...cellStyle, width: "33%" }}>{metaLeft[i][1] ?? <span className="font-normal italic text-gray-500">Not recorded</span>}</td>
              <td className={cell} style={{ ...cellStyle, width: "15%" }}>{metaRight[i][0]}</td>
              <td
                className={cell}
                style={{
                  ...cellStyle,
                  width: "25%",
                  color: metaRight[i][0] === "Status" ? (t.status === "PASS" ? "#1a6b30" : t.status === "FAILED" ? "#b3261e" : undefined) : undefined,
                }}
              >
                {metaRight[i][1]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {t.subjects.length > 0 ? (
      <table className="w-full border-collapse text-[13px] font-semibold text-center" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr className="text-white" style={{ background: GREEN }}>
            <th className="px-2 py-1 border" style={{ ...cellStyle, width: "28%" }} />
            {t.subjects.map((s, i) => (
              <th key={i} className="px-1 py-1 border font-bold text-[14px]" style={cellStyle}>
                {columnLabel(t.track, s.name)}
              </th>
            ))}
            <th className="px-1 py-1 border font-bold text-[14px]" style={{ ...cellStyle, width: "14%" }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${cell} text-left`} style={cellStyle}>Max. Mark</td>
            {t.subjects.map((s, i) => (
              <td key={i} className={cell} style={cellStyle}>{s.maxMark}</td>
            ))}
            <td className={cell} style={cellStyle}>{t.totalMax}</td>
          </tr>
          <tr>
            <td className={`${cell} text-left`} style={cellStyle}>Scored</td>
            {t.subjects.map((s, i) => (
              <td key={i} className={cell} style={cellStyle}>{s.scored}</td>
            ))}
            <td className={cell} style={cellStyle}>{t.totalScored}</td>
          </tr>
        </tbody>
      </table>
      ) : (
        <p className="border px-2 py-1 text-[13px] font-normal italic text-gray-500" style={cellStyle}>Marks not entered for this exam.</p>
      )}
      {isHifz && t.remarks && (
        <table className="w-full border-collapse text-[13px] font-semibold" style={{ tableLayout: "fixed" }}>
          <tbody>
            <tr>
              <td className={cell} style={{ ...cellStyle, width: "27%" }}>Remarks</td>
              <td className={`${cell} font-normal`} style={cellStyle}>{t.remarks}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

export function ProgressReportCard({ data }: { data: ProgressCardData }) {

  return (
    <div className="space-y-4">
      <div
        id="progress-card"
        className="mx-auto bg-white text-black px-8 py-7 shadow-sm border border-gray-200 print:shadow-none print:border-0"
        style={{ maxWidth: "21cm", minHeight: "27cm", fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="h-[72px] w-[84px] shrink-0">
            <MicLogo />
          </div>
          <div className="flex-1 text-right leading-tight">
            <p className="text-[22px] font-bold" dir="rtl" style={{ color: GREEN }}>
              كلية تحفيظ القرآن لمجمع مليبار الإسلامي
            </p>
            <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: GREEN }}>
              MIC THAHFEEZUL QUR&apos;AN COLLEGE
            </h1>
            <p className="text-[11px] font-semibold" style={{ color: GREEN }}>
              Udma West, Udma P.O, Kasaragod Dt., Kerala, India, 671319
            </p>
          </div>
        </div>

        <div className="mt-3 flex justify-center">
          <div className="rounded-lg px-8 py-1.5 text-[18px] font-extrabold tracking-wide text-white" style={{ background: GREEN }}>
            PROGRESS REPORT {data.periodLabel}
          </div>
        </div>

        {/* Student block */}
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 px-2 text-[15px] font-bold">
          <div className="flex"><span className="w-24 shrink-0">Ad. No :</span><span>{data.admissionNumber}</span></div>
          <div className="flex"><span className="w-20 shrink-0">Name :</span><span className="uppercase">{data.studentName}</span></div>
          <div className="flex"><span className="w-24 shrink-0">Class :</span><span className="uppercase">{data.header.className}</span></div>
          <div className="flex"><span className="w-20 shrink-0">Mentor :</span><span className="uppercase">{data.header.mentor}</span></div>
        </div>

        {/* Results */}
        <div className="mt-5 space-y-5">
          {data.tracks.length === 0 ? (
            <div className="rounded border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">
              No exam marks found for this student in this examination.
            </div>
          ) : (
            data.tracks.map((t) => <TrackSection key={t.track} t={t} />)
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 px-2 text-[13px] font-bold">
          <p>Remarks</p>
          <div className="mt-10 grid grid-cols-3 text-center">
            <p>Class teacher</p>
            <p>Guardian</p>
            <p>Principal</p>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  @page { size: A4; margin: 8mm; }
  body * { visibility: hidden; }
  #progress-card, #progress-card * { visibility: visible; }
  #progress-card { position: absolute; left: 0; top: 0; width: 100%; max-width: none !important; min-height: 0 !important; margin: 0 !important; }
  #progress-card, #progress-card * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`,
        }}
      />
    </div>
  );
}
