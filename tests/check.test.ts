import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCopy, mergeCaption, numberTokens, templateCaption } from "../src/engine/check.ts";
import type { Copy, Result } from "../src/engine/types.ts";

const r = (id: string, facts: Record<string, string>, op: Result["op"] = "total"): Result => ({ id, op, angle: "", facts, receipt: { calc: "", columns: [], period: "", exclusions: [], filters: [], rows: 1, table: [] } });
const results = [r("s1", { value: "2,350 km", count: "181" }), r("s2", { value: "12", start: "Sun, Mar 9", end: "Thu, Mar 20" }, "streak")];
const copy = (over: Partial<Copy> = {}): Copy => ({
  opener: { title: "Your 2025 moves", line: "181 workouts later, here we are." },
  slides: [
    { id: "s1", kicker: "Distance", big: "2,350 km", line: "That's 2,350 km on your own legs.", sub: "" },
    { id: "s2", kicker: "Streak", big: "12", line: "Days in a row, Sun, Mar 9 to Thu, Mar 20.", sub: "" },
  ],
  persona: { name: "The Early Bird", why: "Mornings were yours." },
  skipped: [],
  ...over,
});

test("tokens normalize thousands separators", () => {
  assert.deepEqual(numberTokens("2,350 km and 3.2/5 at 11:43 PM"), ["2350", "3.2", "5", "11:43"]);
});

test("clean copy passes", () => {
  assert.deepEqual(checkCopy(copy(), results, ["2025"]), []);
});

test("invented, rounded or spelled-out numbers are rejected", () => {
  const bad = copy({
    slides: [
      { id: "s1", kicker: "Distance", big: "2,350 km", line: "That's about 2,400 km.", sub: "" },
      { id: "s2", kicker: "Streak", big: "12", line: "Twelve days, twice your usual.", sub: "" },
    ],
  });
  const p = checkCopy(bad, results, ["2025"]);
  assert.ok(p.some((x) => x.id === "s1" && x.text.includes("2,400")));
  assert.ok(p.some((x) => x.id === "s2" && /Twelve/.test(x.issue)));
  assert.ok(p.some((x) => x.id === "s2" && /twice/.test(x.issue)));
});

test("a number from another card is not allowed on this card", () => {
  const p = checkCopy(copy({ slides: [{ id: "s2", kicker: "Streak", big: "12", line: "12 days, after 181 workouts.", sub: "" }] }), results, []);
  assert.ok(p.some((x) => x.id === "s2" && x.issue.includes('"181"')));
});

test("hero value must be copied exactly", () => {
  const p = checkCopy(copy({ slides: [{ id: "s1", kicker: "Distance", big: "2350 km", line: "Far.", sub: "" }] }), results, []);
  assert.ok(p.some((x) => x.field === "big"));
});

test("'one' is allowed as a pronoun", () => {
  assert.deepEqual(checkCopy(copy({ persona: { name: "The One", why: "Every single one counted." } }), results, ["2025"]), []);
});

test("failed cards fall back to template captions built from facts only", () => {
  const p = checkCopy(copy({ slides: [{ id: "s1", kicker: "Distance", big: "2,350 km", line: "Nearly 3,000 km!", sub: "" }] }), results, []);
  const m = mergeCaption(results[0], copy().slides[0] && { id: "s1", kicker: "Distance", big: "2,350 km", line: "Nearly 3,000 km!", sub: "" }, p);
  assert.equal(m.checked, "template");
  assert.equal(m.caption.big, "2,350 km");
  assert.deepEqual(checkCopy({ ...copy(), slides: [m.caption] }, results, []).filter((x) => x.id === "s1"), []);
  for (const res of results) assert.deepEqual(checkCopy({ ...copy(), slides: [templateCaption(res)] }, results, []).filter((x) => x.id === res.id), [], `template for ${res.id} passes its own check`);
});

test("the period label may appear on any card, other numbers may not", () => {
  const c = copy({ slides: [{ id: "s2", kicker: "Streak", big: "12", line: "12 days in a row in 2025.", sub: "" }] });
  assert.deepEqual(checkCopy(c, results, ["2025"], ["2025"]).filter((x) => x.id === "s2"), []);
  assert.ok(checkCopy(c, results, ["2025"]).some((x) => x.id === "s2"));
});
