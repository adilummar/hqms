import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSabaq, formatSabaqJuz, formatDaura, resolveRemark } from "./entry-display";

const labels = new Map([["r1", "Sick"], ["r2", "Leave"], ["r3", "Not Given"], ["r4", "Exam"]]);

test("sabaq: pages shown", () => {
  assert.equal(formatSabaq({ sabaqFromPage: "1", sabaqToPage: "6" }, labels), "1\u21926");
  assert.equal(formatSabaq({ sabaqPages: "6.0" }, labels), "6 pages");
});
test("sabaq: reason when no pages, configured label", () => {
  assert.equal(formatSabaq({ sabaqPages: "0", sabaqRemarksId: "r1" }, labels), "Sick");
  assert.equal(formatSabaq({ sabaqRemarksId: "r2" }, labels), "Leave");
  assert.equal(formatSabaq({ sabaqRemarksId: "r3" }, labels), "Not Given");
});
test("sabaq: nothing / unknown id never raw", () => {
  assert.equal(formatSabaq(undefined, labels), "\u2013");
  assert.equal(formatSabaq({ sabaqRemarksId: "gone" }, labels), "\u2013");
  assert.equal(resolveRemark("gone", labels), null);
});
test("sabaq juz", () => {
  assert.deepEqual(formatSabaqJuz({ sabaqJuzGiven: true }, labels), { kind: "given", text: "Given" });
  assert.deepEqual(formatSabaqJuz({ sabaqJuzGiven: false, sabaqJuzRemarksId: "r1" }, labels), { kind: "not_given", text: "Sick" });
  assert.equal(formatSabaqJuz({ sabaqJuzGiven: false }, labels).kind, "not_given");
  assert.equal(formatSabaqJuz(undefined, labels).text, "\u2013");
  assert.equal(formatSabaqJuz({ sabaqJuzGiven: null }, labels).text, "\u2013");
});
test("daura", () => {
  assert.equal(formatDaura({ dauraJuzNumbers: [5, 6], dauraRemarksId: "r4" }, labels), "Juz 5, 6");
  assert.equal(formatDaura({ dauraJuzNumbers: [], dauraRemarksId: "r4" }, labels), "Exam");
  assert.equal(formatDaura({ dauraJuzNumbers: null }, labels), "\u2013");
  assert.equal(formatDaura({ dauraJuzNumbers: [1], daura2JuzNumbers: [2, 3] }, labels, true), "D1: Juz 1 \u00b7 D2: Juz 2, 3");
  assert.equal(formatDaura({ dauraRemarksId: "r1" }, labels, true), "Sick");
});
