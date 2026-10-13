// The AI answers in a flat format where every property is present ("" / [] / 0 mean "not used"),
// because the API can only enforce small schemas. This turns that answer into a clean Plan.
import type { Plan, Filter, Field, Derive, Slide } from "./types.ts";

type Raw = Record<string, unknown>;
const s = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const posInt = (v: unknown): number | undefined => (typeof v === "number" && v > 0 ? Math.round(v) : undefined);

function filter(f: Raw): Filter {
  const op = String(f.op) as Filter["op"];
  const values = (arr<unknown>(f.values).length ? arr<unknown>(f.values) : Array.isArray(f.value) ? (f.value as unknown[]) : []).map(String);
  if (op === "in" || op === "not_in") return { col: String(f.col), op, value: values.length ? values : s(f.value) ? [String(f.value)] : [] };
  if (op === "empty" || op === "not_empty") return { col: String(f.col), op };
  const value = Array.isArray(f.value) ? values[0] ?? "" : f.value ?? values[0] ?? "";
  return { col: String(f.col), op, value: typeof value === "string" ? value : (value as string | number | boolean) };
}

export function normalizePlan(raw: unknown): Plan {
  const r = (raw ?? {}) as Raw;
  const ds = (r.dataset ?? {}) as Raw;
  const pr = (r.period ?? null) as Raw | null;
  const period = pr && s(pr.date) && s(pr.from) && s(pr.to) ? { date: String(pr.date), from: String(pr.from), to: String(pr.to), label: s(pr.label) ?? `${pr.from} to ${pr.to}` } : null;
  // a card filter like "date >= period start" repeats the period and only clutters the receipt
  const restatesPeriod = (f: Filter) => !!period && f.col === period.date && ["gt", "gte", "lt", "lte"].includes(f.op) && (f.value === period.from || f.value === period.to);
  const derive: Derive[] = arr<Raw>(r.derive).map((d) => ({ name: String(d.name), from: String(d.from), op: d.op as Derive["op"], ...(s(d.arg) !== undefined || d.arg === "" ? { arg: String(d.arg ?? "") } : {}), replacement: String(d.replacement ?? "") }));
  const fields: Field[] = arr<Raw>(r.fields).map((f) => {
    const out: Field = { col: String(f.col), type: f.type as Field["type"] };
    if (f.decimal === "." || f.decimal === ",") out.decimal = f.decimal;
    if (s(f.unit)) out.unit = String(f.unit);
    if (typeof f.scale === "number" && f.scale !== 0 && f.scale !== 1) out.scale = f.scale;
    if (out.type === "number" && out.unit && /^(ms|s|sec|secs|seconds?|min|mins|minutes?)$/i.test(out.unit)) {
      out.type = "duration";
      out.unit = /^ms$/i.test(out.unit) ? "ms" : /^m/i.test(out.unit) ? "min" : "s";
    }
    if (f.order === "MDY" || f.order === "DMY") out.order = f.order;
    const tv = arr<unknown>(f.true_values).map(String).filter(Boolean);
    if (tv.length) out.true_values = tv;
    return out;
  });
  const slides: Slide[] = arr<Raw>(r.slides).map((x) => {
    const out: Slide = { id: String(x.id), op: x.op as Slide["op"], angle: String(x.angle ?? "") };
    for (const k of ["measure", "group", "date", "split"] as const) if (s(x[k])) out[k] = String(x[k]);
    if (s(x.by)) out.by = x.by as Slide["by"];
    if (s(x.unit)) out.unit = x.unit as Slide["unit"];
    if (s(x.stat)) out.stat = x.stat as Slide["stat"];
    if (s(x.dir)) out.dir = x.dir as Slide["dir"];
    const show = arr<unknown>(x.show).map(String).filter(Boolean).filter((c) => c !== s(x.measure) && c !== period?.date);
    if (show.length) out.show = show;
    if (posInt(x.k)) out.k = posInt(x.k);
    if (posInt(x.min_rows)) out.min_rows = posInt(x.min_rows);
    const match = arr<Raw>(x.match).map(filter);
    if (match.length) out.match = match;
    const where = arr<Raw>(x.where).map(filter).filter((f) => !restatesPeriod(f));
    if (where.length) out.where = where;
    // a measure only matters for sums, means and records; models sometimes fill it in anyway
    const usesMeasure = out.op === "total" || out.op === "average" || out.op === "record" || out.op === "compare"
      || ((out.op === "top" || out.op === "timeline" || out.op === "peak_day") && (out.by === "sum" || out.by === "mean"));
    if (!usesMeasure) delete out.measure;
    return out;
  });
  return {
    dataset: { source: String(ds.source ?? "a data export"), row_means: String(ds.row_means ?? "one row = one record"), subject: String(ds.subject ?? "your year"), confidence: (ds.confidence as Plan["dataset"]["confidence"]) ?? "low" },
    period,
    derive,
    fields,
    exclude: arr<Raw>(r.exclude).map(filter),
    slides,
    palette: (["ember", "ink", "tide", "neon", "dusk"].includes(String(r.palette)) ? r.palette : "ink") as Plan["palette"],
  };
}
