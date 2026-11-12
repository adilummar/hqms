// Run by progress-card-pdf.test.ts after bundling with esbuild (react-pdf is ESM-only, so it cannot be
// loaded through tsx's CommonJS path). Prints "<bytes>|<page count>|<header>".
import { renderProgressCardPdf } from "@/lib/exams/progress-card-pdf";
const card = (name: string) => ({
  examName: "T", periodLabel: "MAR 26", studentName: name, admissionNumber: "1",
  header: { className: "HA", mentor: "M", hasHifzClass: true },
  tracks: [
    { track: "hifz", className: "HA", teacher: "M", rank: 1, status: "PASS", subjects: [{ name: "Hifz", maxMark: 100, scored: 90 }], totalMax: 100, totalScored: 90, memorizedJuz: "1.25", toBeObtained: "2", remarks: null },
    { track: "madrasa", className: "M1", teacher: "T", rank: 1, status: "PASS", subjects: [{ name: "Lisan", maxMark: 50, scored: 40 }], totalMax: 50, totalScored: 40 },
  ],
}) as never;
const names = (process.argv[2] ?? "A").split(",");
const buf = await renderProgressCardPdf(names.map(card));
const text = buf.toString("latin1");
console.log(`${buf.length}|${(text.match(/\/Type \/Page[^s]/g) ?? []).length}|${text.slice(0, 5)}`);
