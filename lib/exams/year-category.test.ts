import { test } from "node:test";
import assert from "node:assert/strict";
import { yearCategoryOf, rankDescending } from "./year-category";

test("year of study maps to sub-junior / junior / senior", () => {
  assert.equal(yearCategoryOf("1st"), "sub_junior");
  assert.equal(yearCategoryOf("1"), "sub_junior");
  assert.equal(yearCategoryOf("2nd"), "junior");
  assert.equal(yearCategoryOf("2nd Year"), "junior");
  assert.equal(yearCategoryOf("3rd"), "senior");
  assert.equal(yearCategoryOf("4th"), null);
  assert.equal(yearCategoryOf(null), null);
  assert.equal(yearCategoryOf(""), null);
});

test("ties share a rank and the next rank is skipped", () => {
  assert.deepEqual(rankDescending([90, 80, 80, 70], (x) => x), [1, 2, 2, 4]);
  assert.deepEqual(rankDescending([], (x: number) => x), []);
});
