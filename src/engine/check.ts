// The number checker: every number in a caption must come from that card's computed facts.
// Captions that still fail after one retry are replaced by template captions built from the facts.
import type { Caption, Copy, Result } from "./types.ts";

const NUM = /\d+(?:[.,:]\d+)*/g;
const THOUSANDS = /^\d{1,3}(,\d{3})+(\.\d+)?$/;
const norm = (tok: string) => (THOUSANDS.test(tok) ? tok.replace(/,/g, "") : tok);
export const numberTokens = (text: string): string[] => (String(text || "").match(NUM) || []).map(norm);

// Spelled-out numbers and arithmetic words smuggle numbers past a digit check. "one" stays allowed:
// it is far more often a pronoun ("every single one") than a count.
const WORDS = /\b(zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|millions?|billions?|dozens?|twice|thrice|double[ds]?|triple[ds]?|halfs?|halves|quarters?)\b/gi;

export type Problem = { id: string; field: string; text: string; issue: string };

function allowedFor(r: Result): Set<string> {
  return new Set(Object.values(r.facts).flatMap(numberTokens));
}

/** `extra` (period label, row count) may appear in the opener and persona; `everywhere` (the period label) on any card. */
export function checkCopy(copy: Copy, results: Result[], extra: string[], everywhere: string[] = []): Problem[] {
  const problems: Problem[] = [];
  const byId = new Map(results.map((r) => [r.id, r]));
  const anywhere = everywhere.flatMap(numberTokens);
  const global = new Set([...results.flatMap((r) => Object.values(r.facts).flatMap(numberTokens)), ...extra.flatMap(numberTokens)]);
  const scan = (id: string, field: string, text: string, allowed: Set<string>) => {
    for (const tok of numberTokens(text)) if (!allowed.has(tok)) problems.push({ id, field, text, issue: `"${tok}" is not in the computed results` });
    for (const w of String(text || "").match(WORDS) || []) problems.push({ id, field, text, issue: `"${w}" is a number written in words; use only the digits from the facts` });
  };
  scan("opener", "title", copy.opener?.title, global);
  scan("opener", "line", copy.opener?.line, global);
  scan("persona", "name", copy.persona?.name, new Set());
  scan("persona", "why", copy.persona?.why, global);
  for (const s of copy.slides || []) {
    const r = byId.get(s.id);
    if (!r) { problems.push({ id: s.id, field: "id", text: s.id, issue: "no card has this id" }); continue; }
    const allowed = new Set([...allowedFor(r), ...anywhere]);
    for (const field of ["kicker", "big", "line", "sub"] as const) scan(s.id, field, s[field], allowed);
    const facts = Object.values(r.facts).map((v) => v.trim().toLowerCase());
    if (!facts.includes(String(s.big || "").trim().toLowerCase())) problems.push({ id: s.id, field: "big", text: s.big, issue: "the hero value must be copied exactly from one of the card's facts" });
  }
  return problems;
}

/** Cards the writer neither captioned nor listed in "skipped": they go back for a rewrite like any other problem. */
export function missingCaptions(copy: Copy, results: Result[]): Problem[] {
  const done = new Set([...(copy.slides || []).map((s) => s.id), ...(copy.skipped || []).map((s) => s.id)]);
  return results.filter((r) => !done.has(r.id)).map((r) => ({ id: r.id, field: "id", text: "", issue: "this card has no caption: write one" }));
}

/** A plain caption built only from facts, used when the AI's caption fails the check twice. */
export function templateCaption(r: Result): Caption {
  const f = r.facts;
  const t = (kicker: string, big: string, line: string, sub = ""): Caption => ({ id: r.id, kicker, big, line, sub });
  switch (r.op) {
    case "total": return t("In total", f.value, f.count ? `Added up over ${f.count} rows.` : "Rows in this period.");
    case "average": return t("On average", f.value, `Averaged over ${f.count} values.`);
    case "record": return t("Your record", f.value, [f.label, f.date ? `on ${f.date}` : ""].filter(Boolean).join(", ") + ".");
    case "top": return t("Your number one", f.top1, `${f.top1_value} in total.`, f.top2 ? `Next: ${f.top2}, with ${f.top2_value}.` : "");
    case "distinct": return t("Variety", f.value, "Different values in this period.");
    case "timeline": return t("Your peak", f.peak, `${f.peak_value} at the top.`, `${f.low} was the quietest, at ${f.low_value}.`);
    case "peak_day": return t("Your biggest day", f.date, `${f.value} on that one day.`);
    case "streak": return t("Longest streak", f.value, `Days in a row, from ${f.start} to ${f.end}.`);
    case "share": return t("The share", f.value, `${f.matched} of ${f.total} rows.`);
    case "compare": return t("A difference", f.gap, `${f.high}: ${f.high_value}.`, `${f.low}: ${f.low_value}.`);
    case "first_last": return t("First and last", f.first_date, `First: ${f.first}.`, `Last on ${f.last_date}: ${f.last}.`);
    default: return t("Your year", Object.values(f)[0] ?? "", "");
  }
}

/** Keeps AI fields that passed, replaces the card with a template when any of big/line/sub failed. */
export function mergeCaption(r: Result, ai: Caption | undefined, problems: Problem[]): { caption: Caption; checked: "ai" | "template" } {
  const mine = problems.filter((p) => p.id === r.id);
  if (ai && !mine.length) return { caption: { ...ai, sub: ai.sub || "" }, checked: "ai" };
  const tpl = templateCaption(r);
  const kickerOk = ai && !mine.some((p) => p.field === "kicker");
  return { caption: { ...tpl, kicker: kickerOk ? ai!.kicker : tpl.kicker }, checked: "template" };
}
