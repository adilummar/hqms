import { test } from "node:test";
import assert from "node:assert/strict";
import { ownClassesFirst, classLabel } from "./class-order";

const cs = [
  { id: "1", name: "HA", tutorId: "x" },
  { id: "2", name: "HC", tutorId: "me" },
  { id: "3", name: "HB", tutorId: null },
];

test("own class comes first, others stay available", () => {
  assert.deepEqual(ownClassesFirst(cs, "me").map((c) => c.id), ["2", "1", "3"]);
  assert.equal(classLabel(cs[1], "me"), "HC (My class)");
  assert.equal(classLabel(cs[0], "me"), "HA");
});

test("no tutor match keeps a stable name order", () => {
  assert.deepEqual(ownClassesFirst(cs, "nobody").map((c) => c.id), ["1", "3", "2"]);
  assert.deepEqual(ownClassesFirst(cs, undefined).map((c) => c.id), ["1", "3", "2"]);
});
