// Server-side PDF of the progress card. Vector (real text, A4, one card per page), built with
// @react-pdf/renderer from the SAME ProgressCardData and the same label rules
// (lib/exams/progress-card-view.ts) as the on-screen card, so content cannot drift.
import path from "node:path";
import React from "react";
import { Document, Page, View, Text, Svg, Path, Font, renderToBuffer } from "@react-pdf/renderer";
import type { CardTrackData, ProgressCardData } from "@/lib/exams/progress-card";
import { SECTION_TITLE, columnLabel, metaLeft, metaRight } from "@/lib/exams/progress-card-view";

const GREEN = "#2f7d46";
const fontDir = path.join(process.cwd(), "lib", "fonts");

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  Font.register({
    family: "NotoNaskh",
    fonts: [
      { src: path.join(fontDir, "NotoNaskhArabic-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontDir, "NotoNaskhArabic-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]); // never split words
  fontsReady = true;
}

const ARABIC = /[؀-ۿ]/;
const T = ({ children, style }: { children: React.ReactNode; style?: object }) => {
  const text = typeof children === "string" ? children : "";
  const arabic = ARABIC.test(text);
  return <Text style={{ fontFamily: arabic ? "NotoNaskh" : "Helvetica-Bold", fontSize: 9.5, ...style }}>{children}</Text>;
};

const border = { borderWidth: 0.7, borderColor: GREEN, borderStyle: "solid" as const };
const cellBase = { ...border, paddingVertical: 3, paddingHorizontal: 5, justifyContent: "center" as const };

function Logo() {
  return (
    <Svg viewBox="0 0 100 100" width={60} height={60}>
      <Path d="M5 25 Q30 25 50 45 L50 95 L5 95 Z" fill="#4ade80" />
      <Path d="M95 25 Q70 25 50 45 L50 95 L95 95 Z" fill="#86efac" />
      <Path d="M25 95 Q50 35 75 95 Z" fill="#166534" />
    </Svg>
  );
}

function Track({ t }: { t: CardTrackData }) {
  const left = metaLeft(t);
  const right = metaRight(t);
  const statusColor = t.status === "PASS" ? "#1a6b30" : t.status === "FAILED" ? "#b3261e" : "#000000";
  const subjectCount = t.subjects.length;
  return (
    <View wrap={false} style={{ marginBottom: 12 }}>
      <View style={{ ...cellBase, backgroundColor: GREEN, alignItems: "center" }}>
        <T style={{ color: "#ffffff", fontSize: 11 }}>{SECTION_TITLE[t.track]}</T>
      </View>
      {[0, 1].map((i) => (
        <View key={i} style={{ flexDirection: "row" }}>
          <View style={{ ...cellBase, width: "27%" }}><T>{left[i][0]}</T></View>
          <View style={{ ...cellBase, width: "33%" }}>
            <T style={left[i][1] === null ? { fontFamily: "Helvetica-Oblique", color: "#6b7280" } : undefined}>
              {left[i][1] ?? "Not available"}
            </T>
          </View>
          <View style={{ ...cellBase, width: "15%" }}><T>{right[i][0]}</T></View>
          <View style={{ ...cellBase, width: "25%" }}>
            <T style={right[i][0] === "Status" ? { color: statusColor } : undefined}>{right[i][1]}</T>
          </View>
        </View>
      ))}

      {subjectCount > 0 ? (
        <View>
          <View style={{ flexDirection: "row", backgroundColor: GREEN }}>
            <View style={{ ...cellBase, width: "28%" }} />
            {t.subjects.map((s, i) => (
              <View key={i} style={{ ...cellBase, flex: 1, alignItems: "center" }}>
                <T style={{ color: "#ffffff", fontSize: 10 }}>{columnLabel(t.track, s.name)}</T>
              </View>
            ))}
            <View style={{ ...cellBase, width: "14%", alignItems: "center" }}>
              <T style={{ color: "#ffffff", fontSize: 10 }}>TOTAL</T>
            </View>
          </View>
          {[
            ["Max. Mark", t.subjects.map((s) => String(s.maxMark)), String(t.totalMax)],
            ["Scored", t.subjects.map((s) => String(s.scored)), String(t.totalScored)],
          ].map(([label, cells, total], r) => (
            <View key={r} style={{ flexDirection: "row" }}>
              <View style={{ ...cellBase, width: "28%" }}><T>{label as string}</T></View>
              {(cells as string[]).map((c, i) => (
                <View key={i} style={{ ...cellBase, flex: 1, alignItems: "center" }}><T>{c}</T></View>
              ))}
              <View style={{ ...cellBase, width: "14%", alignItems: "center" }}><T>{total as string}</T></View>
            </View>
          ))}
        </View>
      ) : (
        <View style={cellBase}>
          <T style={{ fontFamily: "Helvetica-Oblique", color: "#6b7280" }}>Marks not entered for this exam.</T>
        </View>
      )}

      {t.track === "hifz" && t.remarks ? (
        <View style={{ flexDirection: "row" }}>
          <View style={{ ...cellBase, width: "27%" }}><T>Remarks</T></View>
          <View style={{ ...cellBase, flex: 1 }}><T style={{ fontFamily: "Helvetica" }}>{t.remarks}</T></View>
        </View>
      ) : null}
    </View>
  );
}

function CardPage({ data }: { data: ProgressCardData }) {
  return (
    <Page size="A4" style={{ padding: 23, fontFamily: "Helvetica-Bold", color: "#000000" }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Logo />
        <View style={{ flex: 1, alignItems: "flex-end", paddingLeft: 10 }}>
          <Text style={{ fontFamily: "NotoNaskh", fontWeight: 700, fontSize: 16, color: GREEN }}>
            كلية تحفيظ القرآن لمجمع مليبار الإسلامي
          </Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 17, color: GREEN, marginTop: 1 }}>
            MIC THAHFEEZUL QUR&apos;AN COLLEGE
          </Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8, color: GREEN, marginTop: 1 }}>
            Udma West, Udma P.O, Kasaragod Dt., Kerala, India, 671319
          </Text>
        </View>
      </View>

      <View style={{ alignItems: "center", marginTop: 10 }}>
        <View style={{ backgroundColor: GREEN, borderRadius: 5, paddingVertical: 4, paddingHorizontal: 24 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13, color: "#ffffff" }}>PROGRESS REPORT {data.periodLabel}</Text>
        </View>
      </View>

      <View style={{ marginTop: 14, paddingHorizontal: 6 }}>
        {[
          [["Ad. No :", data.admissionNumber], ["Name :", data.studentName.toUpperCase()]],
          [["Class :", data.header.className.toUpperCase()], ["Mentor :", data.header.mentor.toUpperCase()]],
        ].map((row, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 5 }}>
            {row.map(([k, v], j) => (
              <View key={j} style={{ flexDirection: "row", width: "50%" }}>
                <Text style={{ width: 52, fontSize: 11 }}>{k}</Text>
                <Text style={{ fontSize: 11, flex: 1 }}>{v}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={{ marginTop: 12 }}>
        {data.tracks.length === 0 ? (
          <View style={{ ...cellBase, borderStyle: "dashed", paddingVertical: 24, alignItems: "center" }}>
            <T style={{ fontFamily: "Helvetica", color: "#6b7280" }}>No exam marks found for this student in this examination.</T>
          </View>
        ) : (
          data.tracks.map((t) => <Track key={t.track} t={t} />)
        )}
      </View>

      <View style={{ marginTop: 22, paddingHorizontal: 6 }}>
        <Text style={{ fontSize: 9.5 }}>Remarks</Text>
        <View style={{ flexDirection: "row", marginTop: 34 }}>
          {["Class teacher", "Guardian", "Principal"].map((l) => (
            <Text key={l} style={{ flex: 1, textAlign: "center", fontSize: 9.5 }}>{l}</Text>
          ))}
        </View>
      </View>
    </Page>
  );
}

/** One PDF buffer containing one page per card (a single card = a one-page PDF). */
export async function renderProgressCardPdf(cards: ProgressCardData[]): Promise<Buffer> {
  ensureFonts();
  const doc = (
    <Document title={cards.length === 1 ? `Progress Report - ${cards[0].studentName}` : "Progress Reports"} author="MIC Thahfeezul Qur'an College">
      {cards.map((c, i) => <CardPage key={i} data={c} />)}
    </Document>
  );
  return renderToBuffer(doc);
}
