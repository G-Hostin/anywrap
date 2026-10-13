// Plan normalizer clean-ups and the missing-caption check (added when the app moved to Gemini).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePlan } from "../src/engine/plan.ts";
import { missingCaptions } from "../src/engine/check.ts";
import type { Copy, Result } from "../src/engine/types.ts";

const raw = {
  dataset: { source: "Fitness export", row_means: "one workout", subject: "sport", confidence: "high" },
  period: { date: "Activity Date", from: "2025-01-01", to: "2025-12-31", label: "2025" },
  derive: [],
  fields: [{ col: "Moving Time", type: "number", decimal: ".", unit: "s", scale: 1, order: "", true_values: [] }],
  exclude: [],
  slides: [
    { id: "count", op: "total", angle: "", measure: "", group: "", date: "", by: "", unit: "", stat: "", dir: "", show: [], k: 0, split: "", min_rows: 0, match: [],
      where: [{ col: "Activity Date", op: "gte", value: "2025-01-01", values: [] }, { col: "Activity Type", op: "eq", value: "Run", values: [] }] },
    { id: "streak", op: "streak", angle: "", measure: "Distance", group: "", date: "Activity Date", by: "", unit: "", stat: "", dir: "", show: [], k: 0, split: "", min_rows: 0, match: [], where: [] },
    { id: "best", op: "record", angle: "", measure: "Distance", group: "", date: "", by: "", unit: "", stat: "", dir: "max", show: ["Activity Name", "Distance", "Activity Date"], k: 0, split: "", min_rows: 0, match: [], where: [] },
  ],
  palette: "ember",
};

test("seconds declared as a plain number become a duration", () => {
  const p = normalizePlan(raw);
  assert.deepEqual(p.fields[0], { col: "Moving Time", type: "duration", decimal: ".", unit: "s" });
});

test("card filters that repeat the period are dropped, others kept", () => {
  const p = normalizePlan(raw);
  assert.deepEqual(p.slides[0].where, [{ col: "Activity Type", op: "eq", value: "Run" }]);
});

test("a measure on an op that doesn't use one is ignored", () => {
  const p = normalizePlan(raw);
  assert.equal(p.slides[1].measure, undefined);
});

test("a record's label columns skip the measure and the period date", () => {
  const p = normalizePlan(raw);
  assert.deepEqual(p.slides[2].show, ["Activity Name"]);
});

test("cards with neither a caption nor a skip reason are reported", () => {
  const results = [{ id: "a" }, { id: "b" }, { id: "c" }] as Result[];
  const copy = { opener: { title: "", line: "" }, persona: { name: "", why: "" }, slides: [{ id: "a", kicker: "", big: "", line: "", sub: "" }], skipped: [{ id: "c", reason: "dull" }] } as Copy;
  assert.deepEqual(missingCaptions(copy, results).map((p) => p.id), ["b"]);
});
