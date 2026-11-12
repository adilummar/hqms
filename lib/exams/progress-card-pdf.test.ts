// Renders real PDFs (Arabic font, one page per card) in a child process.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const bundle = ".tmp-card-pdf-test.mjs";
const run = (names: string) => {
  const out = execFileSync(process.execPath, [bundle, names], { encoding: "utf8" }).trim().split("\n").pop()!;
  const [bytes, pages, head] = out.split("|");
  return { bytes: Number(bytes), pages: Number(pages), head };
};

test("PDF renderer: valid PDF, one A4 page per card, Arabic font bundled", () => {
  assert.ok(existsSync("lib/fonts/NotoNaskhArabic-Regular.ttf") && existsSync("lib/fonts/NotoNaskhArabic-Bold.ttf"));
  execFileSync(
    process.execPath,
    ["node_modules/esbuild/bin/esbuild", "lib/exams/progress-card-pdf.fixture.mts", "--bundle", "--platform=node", "--format=esm", "--packages=external", "--alias:@=.", `--outfile=${bundle}`, "--log-level=error"],
    { stdio: "inherit" }
  );
  try {
    const one = run("A");
    assert.equal(one.head, "%PDF-");
    assert.equal(one.pages, 1);
    assert.ok(one.bytes > 5_000);
    const three = run("A,B,C"); // combined PDF: each student starts a new page
    assert.equal(three.pages, 3);
  } finally {
    rmSync(bundle, { force: true });
  }
});
