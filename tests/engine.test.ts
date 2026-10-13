// Reader + runner on the 5 samples, checked against numbers recomputed here independently
// (plain loops over the raw files, no engine code). Run with TZ=Europe/Paris (npm test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readText, AnywrapError } from "../src/engine/read.ts";
import { summarize, hasSignal } from "../src/engine/summary.ts";
import { runPlan } from "../src/engine/run.ts";
import { parseDate, parseNumber } from "../src/engine/parse.ts";
import type { Plan, Result } from "../src/engine/types.ts";

const load = (f: string) => { const text = readFileSync(new URL(`../public/samples/${f}`, import.meta.url), "utf8"); return readText(f, text); };
const fact = (rs: Result[], id: string, key = "value") => { const r = rs.find((x) => x.id === id); assert.ok(r, `card ${id} missing`); return r!.facts[key]; };
const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n >= 1000 ? 0 : 2, minimumFractionDigits: n >= 1000 ? 0 : 2 }).format(n);
const int = (n: number) => new Intl.NumberFormat("en-US").format(n);
const base = { derive: [], fields: [], exclude: [], palette: "ink" as const };
const naiveCSV = (f: string, sep = ",") => readFileSync(new URL(`../public/samples/${f}`, import.meta.url), "utf8").trim().split("\n").slice(1).map((l) => l.split(sep));

test("reader: separators, nested JSON, Excel ISBNs, duplicate headers", () => {
  const run = load("running-log.csv");
  assert.equal(run.columns.length, 19);
  assert.ok(run.columns.includes("Distance (2)") && run.columns.includes("Elapsed Time (2)"));
  const sleep = load("sleep-diary.csv");
  assert.deepEqual(sleep.columns.slice(0, 4), ["date", "coucher", "réveil", "durée (h)"]);
  const yt = load("watch-history.json");
  assert.ok(yt.columns.includes("subtitles.name") && yt.columns.includes("details.name"));
  const gr = load("reading-list.csv");
  const p = summarize(gr);
  assert.ok(p.columns.find((c) => c.name === "ISBN")!.examples![0].match(/^\d{10}$/), "Excel =\"…\" stripped");
  assert.ok(gr.rows.some((r) => r[gr.columns.indexOf("My Review")].includes("\n")), "quoted multi-line field kept");
});

test("summary: types, decimal comma, day/month order, booleans", () => {
  const s = summarize(load("sleep-diary.csv"));
  const col = (n: string) => s.columns.find((c) => c.name === n)!;
  assert.equal(col("date").date?.order, "DMY");
  assert.equal(col("durée (h)").number?.decimal, ",");
  assert.ok(col("coucher").time_of_day);
  assert.ok(col("café après 16h").boolean);
  assert.equal(s.sample_rows.length, 5);
  const b = summarize(load("bank-account.csv"));
  assert.equal(b.columns.find((c) => c.name === "Posting Date")!.date?.order, "MDY");
  assert.ok(b.columns.find((c) => c.name === "Amount")!.number!.negatives > 0);
  assert.ok(JSON.stringify(b).length < 6000, "summary stays small");
  assert.ok(hasSignal(b));
});

test("reader: rejects binary, empty and tiny files", () => {
  assert.throws(() => readText("x.png", "\x89PNG\r\n\x1a\n\u0000\u0000"), (e: AnywrapError) => e.code === "binary");
  assert.throws(() => readText("x.csv", "   \n"), (e: AnywrapError) => e.code === "empty");
  assert.throws(() => readText("x.csv", "a,b\n1,2\n3,4\n"), (e: AnywrapError) => e.code === "too_small");
});

test("bank: spending, income, coffee visits, merchant cleanup", () => {
  const t = load("bank-account.csv");
  const plan: Plan = {
    ...base,
    dataset: { source: "bank", row_means: "transaction", subject: "money", confidence: "high" },
    period: { date: "Posting Date", from: "2025-01-01", to: "2025-12-31", label: "2025" },
    derive: [{ name: "Merchant", from: "Description", op: "regex_replace", arg: "\\s*(#\\S+.*|PPD ID:.*|\\d{4,}.*)$", replacement: "" }],
    fields: [{ col: "Posting Date", type: "date", order: "MDY" }, { col: "Amount", type: "number", unit: "USD", scale: -1 }],
    slides: [
      { id: "spent", op: "total", angle: "", measure: "Amount", where: [{ col: "Details", op: "eq", value: "DEBIT" }] },
      { id: "cafe", op: "total", angle: "", where: [{ col: "Description", op: "contains", value: "bean there" }] },
      { id: "top", op: "top", angle: "", group: "Merchant", by: "sum", measure: "Amount", k: 3, where: [{ col: "Details", op: "eq", value: "DEBIT" }] },
      { id: "big", op: "record", angle: "", measure: "Amount", dir: "max", show: ["Merchant"], where: [{ col: "Type", op: "eq", value: "DEBIT_CARD" }] },
    ],
  };
  const out = runPlan(t, plan, summarize(t));
  assert.deepEqual(out.errors, []);
  const rows = naiveCSV("bank-account.csv").filter((r) => r[1].endsWith("/2025"));
  const spent = -rows.filter((r) => r[0] === "DEBIT").reduce((a, r) => a + Number(r[3]), 0);
  assert.equal(fact(out.results, "spent"), usd(spent));
  assert.equal(fact(out.results, "cafe"), int(rows.filter((r) => r[2].includes("BEAN THERE")).length));
  assert.equal(fact(out.results, "top", "top1"), "OAKWOOD APTS RENT");
  assert.equal(fact(out.results, "top", "top1_value"), usd(1650 * 12));
  assert.equal(fact(out.results, "big"), usd(1299.99));
  assert.equal(fact(out.results, "big", "label"), "BRIGHTSPARK ELECTRONICS");
  assert.equal(out.rowsInPeriod, rows.length);
});

test("running: picks km column, streak, hours, receipts count exclusions", () => {
  const t = load("running-log.csv");
  const plan: Plan = {
    ...base,
    dataset: { source: "strava", row_means: "activity", subject: "training", confidence: "high" },
    period: { date: "Activity Date", from: "2025-01-01", to: "2025-12-31", label: "2025" },
    fields: [{ col: "Distance", type: "number", unit: "km" }, { col: "Moving Time", type: "duration", unit: "s" }],
    exclude: [{ col: "Activity Type", op: "in", value: ["Walk"] }],
    slides: [
      { id: "km", op: "total", angle: "", measure: "Distance" },
      { id: "time", op: "total", angle: "", measure: "Moving Time" },
      { id: "streak", op: "streak", angle: "", date: "Activity Date" },
      { id: "hours", op: "timeline", angle: "", date: "Activity Date", unit: "hour", by: "count" },
      { id: "long", op: "record", angle: "", measure: "Distance", dir: "max", show: ["Activity Name"], where: [{ col: "Activity Type", op: "eq", value: "Run" }] },
    ],
  };
  const out = runPlan(t, plan, summarize(t));
  assert.deepEqual(out.errors, []);
  const rows = naiveCSV("running-log.csv").map((l) => l.join(",")).map((l) => l.match(/^(\d+),"([^"]+)",([^,]*),([^,]*),/)!).filter(Boolean);
  const all = readFileSync(new URL("../public/samples/running-log.csv", import.meta.url), "utf8").trim().split("\n").slice(1);
  const parsed = all.map((l) => { const m = l.match(/^\d+,"([^"]+)",[^,]*,([^,]*),("[^"]*"|[^,]*),(\d+),([\d.]+),/)!; return { date: parseDate(m[1])!, type: m[2], km: Number(m[5]) }; });
  assert.equal(parsed.length, rows.length);
  const y = parsed.filter((p) => p.date.getFullYear() === 2025 && p.type !== "Walk");
  const km = y.reduce((a, p) => a + p.km, 0);
  assert.equal(fact(out.results, "km"), `${int(Math.round(km))} km`);
  const keys = [...new Set(y.map((p) => Date.UTC(p.date.getFullYear(), p.date.getMonth(), p.date.getDate()) / 864e5))].sort((a, b) => a - b);
  let best = 1, cur = 1;
  for (let j = 1; j < keys.length; j++) { cur = keys[j] === keys[j - 1] + 1 ? cur + 1 : 1; best = Math.max(best, cur); }
  assert.equal(fact(out.results, "streak"), String(best));
  assert.equal(fact(out.results, "long"), "21.1 km");
  assert.equal(fact(out.results, "long", "label"), "Half Marathon - race day!");
  const r = out.results.find((x) => x.id === "km")!;
  assert.equal(r.receipt.exclusions[0].removed, parsed.filter((p) => p.type === "Walk").length);
  assert.equal(r.receipt.rows, y.length);
});

test("sleep: decimal comma, circular bedtime, boolean compare", () => {
  const t = load("sleep-diary.csv");
  const plan: Plan = {
    ...base,
    dataset: { source: "sleep", row_means: "night", subject: "sleep", confidence: "high" },
    period: { date: "date", from: "2025-01-01", to: "2025-12-31", label: "2025" },
    fields: [{ col: "date", type: "date", order: "DMY" }, { col: "durée (h)", type: "number", decimal: ",", unit: "h" }, { col: "qualité (1-5)", type: "number", unit: "/5" }, { col: "coucher", type: "time_of_day" }, { col: "café après 16h", type: "boolean", true_values: ["oui"] }],
    slides: [
      { id: "avg", op: "average", angle: "", measure: "durée (h)" },
      { id: "bed", op: "average", angle: "", measure: "coucher" },
      { id: "coffee", op: "compare", angle: "", group: "café après 16h", measure: "qualité (1-5)" },
      { id: "share", op: "share", angle: "", match: [{ col: "café après 16h", op: "eq", value: true }] },
    ],
  };
  const out = runPlan(t, plan, summarize(t));
  assert.deepEqual(out.errors, []);
  const rows = naiveCSV("sleep-diary.csv", ";").filter((r) => r[0].endsWith("/2025"));
  const dur = rows.map((r) => Number(r[3].replace(/"/g, "").replace(",", ".")));
  assert.equal(fact(out.results, "avg"), `${(dur.reduce((a, b) => a + b, 0) / dur.length).toFixed(1)} h`);
  const q = (yes: boolean) => { const g = rows.filter((r) => (r[6] === "oui") === yes).map((r) => Number(r[4])); return g.reduce((a, b) => a + b, 0) / g.length; };
  const fmtQ = (n: number) => `${Number.isInteger(Math.round(n * 10) / 10) ? Math.round(n) : (Math.round(n * 10) / 10).toString()}/5`;
  assert.equal(fact(out.results, "coffee", "high"), "café après 16h: no");
  assert.equal(fact(out.results, "coffee", "high_value"), fmtQ(q(false)));
  assert.equal(fact(out.results, "coffee", "low_value"), fmtQ(q(true)));
  const yes = rows.filter((r) => r[6] === "oui").length;
  assert.equal(fact(out.results, "share"), `${Math.round((yes / rows.length) * 100)}%`, "boolean filter honors true_values (spike bug)");
  assert.match(fact(out.results, "bed"), /^(10|11|12):\d{2} (PM|AM)$/, "circular mean lands near midnight");
  assert.equal(out.results.find((r) => r.id === "coffee")!.receipt.note, "A difference, not a cause.");
});

test("watch history: ads excluded, nested channel, local hours", () => {
  const t = load("watch-history.json");
  const plan: Plan = {
    ...base,
    dataset: { source: "youtube", row_means: "video", subject: "watching", confidence: "high" },
    period: { date: "time", from: "2025-01-01", to: "2025-12-31", label: "2025" },
    exclude: [{ col: "details.name", op: "not_empty" }, { col: "titleUrl", op: "empty" }],
    slides: [
      { id: "n", op: "total", angle: "" },
      { id: "ch", op: "top", angle: "", group: "subtitles.name", by: "count", k: 3 },
      { id: "hour", op: "timeline", angle: "", date: "time", unit: "hour", by: "count" },
    ],
  };
  const out = runPlan(t, plan, summarize(t));
  assert.deepEqual(out.errors, []);
  const items = JSON.parse(readFileSync(new URL("../public/samples/watch-history.json", import.meta.url), "utf8")) as { time: string; details?: unknown; titleUrl?: string; subtitles?: { name: string }[] }[];
  const kept = items.filter((x) => !x.details && x.titleUrl && new Date(x.time).getFullYear() === 2025);
  assert.equal(fact(out.results, "n"), int(kept.length));
  const counts = new Map<string, number>();
  for (const x of kept) { const n = x.subtitles?.[0]?.name; if (n) counts.set(n, (counts.get(n) || 0) + 1); }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  assert.equal(fact(out.results, "ch", "top1"), top[0]);
  assert.equal(fact(out.results, "ch", "top1_value"), int(top[1]));
  const byHour = Array(24).fill(0);
  for (const x of kept) byHour[new Date(x.time).getHours()]++;
  const peak = byHour.indexOf(Math.max(...byHour));
  assert.equal(fact(out.results, "hour", "peak"), `${peak % 12 || 12} ${peak < 12 ? "AM" : "PM"}`);
});

test("reading list: to-read excluded, pages, authors", () => {
  const t = load("reading-list.csv");
  const plan: Plan = {
    ...base,
    dataset: { source: "goodreads", row_means: "book", subject: "reading", confidence: "high" },
    period: { date: "Date Read", from: "2025-01-01", to: "2025-12-31", label: "2025" },
    fields: [{ col: "Number of Pages", type: "number", unit: "pages" }],
    exclude: [{ col: "Exclusive Shelf", op: "neq", value: "read" }],
    slides: [
      { id: "books", op: "total", angle: "" },
      { id: "pages", op: "total", angle: "", measure: "Number of Pages" },
      { id: "authors", op: "top", angle: "", group: "Author", by: "count", k: 3 },
    ],
  };
  const out = runPlan(t, plan, summarize(t));
  assert.deepEqual(out.errors, []);
  const books = t.rows.filter((r) => r[t.columns.indexOf("Exclusive Shelf")] === "read" && r[t.columns.indexOf("Date Read")].startsWith("2025"));
  assert.equal(fact(out.results, "books"), String(books.length));
  assert.equal(fact(out.results, "pages"), `${int(books.reduce((a, r) => a + Number(r[t.columns.indexOf("Number of Pages")]), 0))} pages`);
  assert.equal(fact(out.results, "authors", "top1"), "Jane Austen");
});

test("runner: errors are reported per card, never thrown", () => {
  const t = load("bank-account.csv");
  const out = runPlan(t, {
    ...base,
    dataset: { source: "", row_means: "", subject: "", confidence: "low" },
    period: { date: "Posting Date", from: "2025-01-01", to: "2025-12-31", label: "2025" },
    slides: [
      { id: "a", op: "total", angle: "", measure: "Nope" },
      { id: "b", op: "total", angle: "", where: [{ col: "Details", op: "eq", value: "NEVER" }] },
      { id: "c", op: "total", angle: "" },
    ],
  });
  assert.equal(out.results.length, 1);
  assert.equal(out.errors.length, 2);
  assert.match(out.errors[0], /unknown column "Nope"/);
  assert.match(out.errors[1], /no rows left/);
});

test("parsers", () => {
  assert.equal(parseNumber("1.234,5", ","), 1234.5);
  assert.equal(parseNumber("(12.50)"), -12.5);
  assert.equal(parseNumber("$1,299.99"), 1299.99);
  assert.equal(parseNumber("EUR 12"), 12);
  assert.equal(parseNumber("12abc"), null);
  assert.equal(parseDate("03/04/2025", "DMY")!.getMonth(), 3);
  assert.equal(parseDate("03/04/2025", "MDY")!.getMonth(), 2);
  assert.equal(parseDate("13/04/2025", "MDY"), null);
  assert.equal(parseDate("12 janv. 2025")!.getMonth(), 0);
  assert.equal(parseDate("Nov 1, 2024, 10:02:51 AM")!.getHours(), 10);
  assert.equal(parseDate("2025-06-01T22:30:00Z")!.getHours(), 0, "UTC converted to Paris (UTC+2 in June)");
});
