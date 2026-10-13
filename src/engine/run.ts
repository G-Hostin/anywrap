// Runs the AI's plan on every row. Each result carries its facts (the only numbers the writer may use),
// a chart and a receipt that says exactly how the number was computed.
import { clean, parseNumber, parseDate, parseDay, parseDuration, parseTimeOfDay, dayKey, TRUE_WORDS, FALSE_WORDS, type DateOrder } from "./parse.ts";
import { nf, fmtMeasure, fmtGap, fmtDay, fmtDate, MONTHS, WEEKDAYS, hourLabel, trunc } from "./format.ts";
import type { Table, Plan, Field, Filter, Slide, Result, RunOutput, Chart, Receipt, Summary, ChartItem } from "./types.ts";

type Typed = (number | null)[] | (Date | null)[] | (boolean | null)[] | string[];

const quote = (v: unknown) => (typeof v === "string" ? `"${v}"` : String(v));
const listOf = (v: unknown) => (Array.isArray(v) ? v.map(quote).join(", ") : quote(v));

export function describeFilter(f: Filter): string {
  const v = f.value;
  switch (f.op) {
    case "eq": return `${f.col} is ${quote(v)}`;
    case "neq": return `${f.col} is not ${quote(v)}`;
    case "in": return `${f.col} is one of ${listOf(v)}`;
    case "not_in": return `${f.col} is none of ${listOf(v)}`;
    case "contains": return `${f.col} contains ${quote(v)}`;
    case "not_contains": return `${f.col} doesn't contain ${quote(v)}`;
    case "starts_with": return `${f.col} starts with ${quote(v)}`;
    case "gt": return `${f.col} is above ${v}`;
    case "gte": return `${f.col} is at least ${v}`;
    case "lt": return `${f.col} is below ${v}`;
    case "lte": return `${f.col} is at most ${v}`;
    case "empty": return `${f.col} is empty`;
    case "not_empty": return `${f.col} is not empty`;
    default: return `${f.col} ${String(f.op)} ${quote(v)}`;
  }
}

export function runPlan(table: Table, plan: Plan, summary?: Summary): RunOutput {
  const errors: string[] = [];
  const columns = [...table.columns];
  const rows = table.rows;
  const derived = new Map<string, { from: string; values: string[] }>();

  const colIndex = (c: string): number => {
    const i = columns.indexOf(c);
    if (i < 0) throw new Error(`unknown column "${c}"`);
    return i;
  };
  const rawColumn = (c: string): string[] => {
    const d = derived.get(c);
    if (d) return d.values;
    const i = colIndex(c);
    return rows.map((r) => clean(r[i]));
  };

  for (const dv of plan.derive || []) {
    try {
      if (!dv.name || columns.includes(dv.name)) throw new Error(`name "${dv.name}" is empty or already used`);
      const src = rawColumn(dv.from);
      const arg = dv.arg ?? "";
      if (arg.length > 300) throw new Error("pattern too long");
      let fn: (v: string) => string;
      if (dv.op === "copy") fn = (v) => v;
      else if (dv.op === "strip_prefix") fn = (v) => (v.toLowerCase().startsWith(arg.toLowerCase()) ? v.slice(arg.length).trim() : v);
      else if (dv.op === "strip_suffix") fn = (v) => (v.toLowerCase().endsWith(arg.toLowerCase()) ? v.slice(0, v.length - arg.length).trim() : v);
      else if (dv.op === "regex_replace") { const re = new RegExp(arg, "gi"); fn = (v) => v.replace(re, dv.replacement ?? "").replace(/\s{2,}/g, " ").trim(); }
      else if (dv.op === "extract") { const re = new RegExp(arg, "i"); fn = (v) => { const m = v.match(re); return m ? (m[1] ?? m[0]).trim() : ""; }; }
      else throw new Error(`unknown derive op "${String(dv.op)}"`);
      columns.push(dv.name);
      derived.set(dv.name, { from: dv.from, values: src.map(fn) });
    } catch (e) {
      errors.push(`derive "${dv.name}": ${(e as Error).message}`);
    }
  }

  const declared = new Map<string, Field>((plan.fields || []).map((f) => [f.col, f]));
  const profileOf = (c: string) => summary?.columns.find((p) => p.name === c);
  const fieldOf = (c: string, role: "measure" | "date" | "any" = "any"): Field => {
    const f = declared.get(c);
    if (f) return f;
    const p = profileOf(c);
    if (role === "date" || (role === "any" && p?.date)) return { col: c, type: "date", order: p?.date?.order === "DMY" ? "DMY" : "MDY" };
    if (role === "measure" || (role === "any" && p?.number)) return { col: c, type: "number", decimal: p?.number?.decimal === "," ? "," : "." };
    return { col: c, type: "text" };
  };

  const toBool = (f: Field, v: unknown): boolean | null => {
    if (typeof v === "boolean") return v;
    const s = clean(v).toLowerCase();
    if ((f.true_values || []).some((t) => String(t).toLowerCase() === s) || TRUE_WORDS.has(s)) return true;
    if (FALSE_WORDS.has(s)) return false;
    return null;
  };

  const cache = new Map<string, Typed>();
  const typed = (c: string, role: "measure" | "date" | "any" = "any"): Typed => {
    const key = `${c}\u0000${role}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const f = fieldOf(c, role), raw = rawColumn(c), scale = f.scale ?? 1;
    let out: Typed;
    if (f.type === "number") out = raw.map((v) => { const n = parseNumber(v, f.decimal || "."); return n === null ? null : n * scale; });
    else if (f.type === "duration") out = raw.map((v) => { const n = parseDuration(v, f.unit || "s", f.decimal || "."); return n === null ? null : n * scale; });
    else if (f.type === "date") out = raw.map((v) => parseDate(v, (f.order || "MDY") as DateOrder));
    else if (f.type === "time_of_day") out = raw.map(parseTimeOfDay);
    else if (f.type === "boolean") out = raw.map((v) => toBool(f, v));
    else out = raw;
    cache.set(key, out);
    return out;
  };
  const isNumeric = (c: string) => ["number", "duration", "time_of_day"].includes(fieldOf(c).type);

  const groupKey = (c: string): string[] => {
    const f = fieldOf(c);
    const vals = typed(c);
    if (f.type === "boolean") return (vals as (boolean | null)[]).map((b) => (b === null ? "" : `${c}: ${b ? "yes" : "no"}`));
    if (f.type === "date") return (vals as (Date | null)[]).map((d) => (d ? dayKey(d) : ""));
    if (f.type === "text") return vals as string[];
    return rawColumn(c);
  };

  const test = (flt: Filter): ((i: number) => boolean) => {
    const f = fieldOf(flt.col);
    const vals = typed(flt.col);
    const ord = ["gt", "gte", "lt", "lte"].includes(flt.op);
    const numericText = f.type === "text" && ord;
    const norm = (x: unknown): unknown => {
      if (f.type === "date") return parseDay(String(x))?.getTime() ?? NaN;
      if (f.type === "boolean") return toBool(f, x);
      if (["number", "duration", "time_of_day"].includes(f.type) || numericText) return typeof x === "number" ? x : parseNumber(String(x)) ?? NaN;
      return String(x ?? "").toLowerCase();
    };
    const val = (v: unknown): unknown => {
      if (v instanceof Date) return v.getTime();
      if (numericText) return parseNumber(String(v));
      return typeof v === "string" ? v.toLowerCase() : v;
    };
    const ref = Array.isArray(flt.value) ? flt.value.map(norm) : norm(flt.value);
    const refs = Array.isArray(ref) ? ref : [ref];
    const num = (v: unknown) => (v === null || v === undefined || Number.isNaN(v) ? null : (v as number));
    const r0 = num(refs[0]);
    const fn: Record<string, (v: unknown) => boolean> = {
      eq: (v) => v === refs[0], neq: (v) => v !== refs[0],
      in: (v) => refs.includes(v), not_in: (v) => !refs.includes(v),
      contains: (v) => typeof v === "string" && v.includes(String(refs[0])),
      not_contains: (v) => !(typeof v === "string" && v.includes(String(refs[0]))),
      starts_with: (v) => typeof v === "string" && v.startsWith(String(refs[0])),
      gt: (v) => num(v) !== null && r0 !== null && (v as number) > r0,
      gte: (v) => num(v) !== null && r0 !== null && (v as number) >= r0,
      lt: (v) => num(v) !== null && r0 !== null && (v as number) < r0,
      lte: (v) => num(v) !== null && r0 !== null && (v as number) <= r0,
      empty: (v) => v === null || v === "",
      not_empty: (v) => v !== null && v !== "",
    };
    const g = fn[flt.op];
    if (!g) throw new Error(`unknown filter op "${String(flt.op)}"`);
    if (ord && r0 === null) throw new Error(`filter on "${flt.col}" needs a number or a YYYY-MM-DD date`);
    return (i) => g(val((vals as unknown[])[i]));
  };
  const applyWhere = (set: number[], where?: Filter[]) => {
    for (const f of where || []) { const t = test(f); set = set.filter(t); }
    return set;
  };

  // exclusions, then period
  let base = rows.map((_, i) => i);
  const counts: Record<string, string | number> = { rows_in_file: base.length };
  const exclusions: Receipt["exclusions"] = [];
  for (const f of plan.exclude || []) {
    try {
      const t = test(f);
      const before = base.length;
      base = base.filter((i) => !t(i));
      exclusions.push({ rule: describeFilter(f), removed: before - base.length });
      counts[`removed where ${describeFilter(f)}`] = before - base.length;
    } catch (e) {
      errors.push(`exclude "${describeFilter(f)}": ${(e as Error).message}`);
    }
  }
  let periodLabel = "all rows";
  let periodText = "all rows";
  let periodRange: [Date, Date] | null = null;
  if (plan.period?.date) {
    try {
      const ds = typed(plan.period.date, "date") as (Date | null)[];
      const from = parseDay(plan.period.from), to = parseDay(plan.period.to);
      if (!from || !to) throw new Error(`period dates must be YYYY-MM-DD, got "${plan.period.from}" and "${plan.period.to}"`);
      to.setHours(23, 59, 59, 999);
      const before = base.length;
      base = base.filter((i) => { const d = ds[i]; return !!d && d >= from && d <= to; });
      periodLabel = plan.period.label || `${plan.period.from} to ${plan.period.to}`;
      periodText = `${fmtDate(from)} to ${fmtDate(to)}, by "${plan.period.date}"`;
      periodRange = [from, to];
      counts.outside_period = before - base.length;
    } catch (e) {
      errors.push(`period: ${(e as Error).message}`);
    }
  }
  counts.rows_used = base.length;

  const results: Result[] = [];
  for (const s of plan.slides || []) {
    try {
      results.push(runSlide(s));
    } catch (e) {
      errors.push(`card ${s.id} (${s.op}): ${(e as Error).message}`);
    }
  }
  return { results, errors, period: periodLabel, rowsTotal: rows.length, rowsInPeriod: base.length, counts };

  function runSlide(s: Slide): Result {
    const set = applyWhere(base, s.where);
    if (!set.length) throw new Error("no rows left after its filters");
    const facts: Record<string, string> = {};
    const table: [string, string][] = [];
    let chart: Chart | undefined;
    let calc = "";
    let note: string | undefined;
    const used = new Set<string>();
    const use = (c?: string) => { if (c) used.add(c); return c; };

    const mf = s.measure ? fieldOf(use(s.measure)!, "measure") : undefined;
    const meas = s.measure ? (typed(s.measure, "measure") as (number | null)[]) : null;
    if (meas && !isNumeric(s.measure!) && mf?.type !== "number") throw new Error(`measure "${s.measure}" is not a number, duration or clock time`);
    const nums = (ix: number[]) => ix.map((i) => meas![i]).filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v));
    const show = (v: number) => fmtMeasure(v, mf);
    const label = (i: number, cols?: string[]) => (cols || []).map((c) => { use(c); return trunc(rawColumn(c)[i] ?? "", 70); }).filter(Boolean).join(", ");
    const periodDates = plan.period?.date ? (typed(plan.period.date, "date") as (Date | null)[]) : null;

    switch (s.op) {
      case "total": {
        if (!meas) {
          facts.value = nf(set.length);
          calc = "Counted the rows";
        } else {
          const v = nums(set);
          if (!v.length) throw new Error(`no numeric values in "${s.measure}"`);
          facts.value = show(v.reduce((a, b) => a + b, 0));
          facts.count = nf(v.length);
          calc = `Added up "${s.measure}" on every row`;
          table.push(["Rows with a value", nf(v.length)], ["Smallest", show(Math.min(...v))], ["Largest", show(Math.max(...v))]);
        }
        table.unshift(["Result", facts.value]);
        break;
      }
      case "average": {
        if (!meas) throw new Error("average needs a measure");
        const v = nums(set);
        if (!v.length) throw new Error(`no numeric values in "${s.measure}"`);
        let r: number;
        if (mf?.type === "time_of_day") {
          const a = v.map((m) => (m / 1440) * 2 * Math.PI);
          r = ((Math.atan2(a.reduce((x, y) => x + Math.sin(y), 0), a.reduce((x, y) => x + Math.cos(y), 0)) / (2 * Math.PI)) * 1440 + 1440) % 1440;
          calc = `Average clock time of "${s.measure}" (a circular average, so 11 PM and 1 AM average to midnight)`;
        } else if (s.stat === "median") {
          const o = [...v].sort((a, b) => a - b);
          r = o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2;
          calc = `Median of "${s.measure}"`;
        } else {
          r = v.reduce((a, b) => a + b, 0) / v.length;
          calc = `Average of "${s.measure}"`;
        }
        facts.value = show(r);
        facts.count = nf(v.length);
        table.push(["Result", facts.value], ["Values averaged", nf(v.length)]);
        if (mf?.type !== "time_of_day") table.push(["Smallest", show(Math.min(...v))], ["Largest", show(Math.max(...v))]);
        break;
      }
      case "record": {
        if (!meas) throw new Error("record needs a measure");
        const ranked = set.filter((i) => meas[i] !== null && meas[i] !== undefined).sort((a, b) => (s.dir === "min" ? meas[a]! - meas[b]! : meas[b]! - meas[a]!));
        if (!ranked.length) throw new Error(`no numeric values in "${s.measure}"`);
        const best = ranked[0];
        facts.value = show(meas[best]!);
        const lab = label(best, s.show);
        if (lab) facts.label = lab;
        const d = periodDates?.[best];
        if (d) facts.date = fmtDay(d);
        calc = `Row with the ${s.dir === "min" ? "lowest" : "highest"} "${s.measure}"`;
        ranked.slice(0, 5).forEach((i, k) => {
          const dd = periodDates?.[i];
          table.push([`${k + 1}. ${[dd ? fmtDay(dd) : "", label(i, s.show)].filter(Boolean).join(" · ") || `row ${i + 1}`}`, show(meas[i]!)]);
        });
        break;
      }
      case "top":
      case "distinct": {
        if (!s.group) throw new Error(`${s.op} needs a group column`);
        const g = groupKey(use(s.group)!);
        const acc = new Map<string, number>();
        const bySum = s.op === "top" && s.by === "sum" && !!meas;
        for (const i of set) {
          const keys = s.split ? String(g[i] ?? "").split(s.split).map((x) => x.trim()) : [String(g[i] ?? "").trim()];
          for (const k of keys) {
            if (!k) continue;
            acc.set(k, (acc.get(k) || 0) + (bySum ? meas![i] ?? 0 : 1));
          }
        }
        const sorted = [...acc.entries()].sort((a, b) => b[1] - a[1]);
        if (!sorted.length) throw new Error(`no values in "${s.group}"`);
        const fmt = (v: number) => (bySum ? show(v) : nf(v));
        if (s.op === "distinct") {
          facts.value = nf(sorted.length);
          calc = `Counted the different values of "${s.group}"`;
        } else {
          const tot = sorted.reduce((a, [, v]) => a + v, 0);
          const k = Math.max(1, Math.min(s.k || 5, 5));
          sorted.slice(0, k).forEach(([key, v], j) => { facts[`top${j + 1}`] = trunc(key, 60); facts[`top${j + 1}_value`] = fmt(v); });
          if (tot > 0) facts.top1_share = `${nf((sorted[0][1] / tot) * 100)}%`;
          facts.groups = nf(sorted.length);
          chart = { kind: "rank", items: sorted.slice(0, k).map(([key, v]): ChartItem => ({ label: trunc(key, 40), value: v, display: fmt(v) })) };
          calc = `Grouped rows by "${s.group}"${s.split ? ` (cells split on "${s.split}")` : ""} and ranked them by ${bySum ? `total "${s.measure}"` : "number of rows"}`;
        }
        sorted.slice(0, 12).forEach(([key, v]) => table.push([trunc(key, 44), fmt(v)]));
        if (sorted.length > 12) table.push([`… ${nf(sorted.length - 12)} more`, ""]);
        break;
      }
      case "timeline": {
        if (!s.date) throw new Error("timeline needs a date column");
        const ds = typed(use(s.date)!, "date") as (Date | null)[];
        const n = s.unit === "month" ? 12 : s.unit === "weekday" ? 7 : s.unit === "hour" ? 24 : 0;
        if (!n) throw new Error(`unknown unit "${String(s.unit)}"`);
        if (s.unit === "hour" && !set.some((i) => ds[i] && (ds[i]!.getHours() || ds[i]!.getMinutes()))) throw new Error(`"${s.date}" has no time of day`);
        const by = s.by && meas ? s.by : "count";
        const sum = Array(n).fill(0), cnt = Array(n).fill(0);
        for (const i of set) {
          const d = ds[i];
          if (!d) continue;
          const b = s.unit === "month" ? d.getMonth() : s.unit === "weekday" ? (d.getDay() + 6) % 7 : d.getHours();
          if (by !== "count") { const v = meas![i]; if (v === null || v === undefined) continue; sum[b] += v; } else sum[b] += 1;
          cnt[b]++;
        }
        const vals = sum.map((v, b) => (by === "mean" ? (cnt[b] ? v / cnt[b] : null) : v));
        const name = (b: number) => (s.unit === "month" ? MONTHS[b] : s.unit === "weekday" ? WEEKDAYS[b] : hourLabel(b));
        const live = vals.map((v, b) => [b, v] as [number, number | null]).filter((x): x is [number, number] => x[1] !== null && (by === "mean" || x[1] > 0));
        if (!live.length) throw new Error("no dated rows with values");
        const hi = live.reduce((a, b) => (b[1] > a[1] ? b : a));
        const lo = live.reduce((a, b) => (b[1] < a[1] ? b : a));
        const disp = (v: number) => (by === "count" ? nf(v) : show(v));
        facts.peak = name(hi[0]); facts.peak_value = disp(hi[1]);
        facts.low = name(lo[0]); facts.low_value = disp(lo[1]);
        chart = { kind: "bars", peak: hi[0], items: vals.map((v, b): ChartItem => ({ label: name(b), value: v ?? 0, display: v === null ? "–" : disp(v) })) };
        calc = `${by === "count" ? "Rows" : by === "mean" ? `Average "${s.measure}"` : `Total "${s.measure}"`} per ${s.unit} of "${s.date}"`;
        if (s.unit === "hour") note = "Hours are shown in this computer's time zone.";
        vals.forEach((v, b) => table.push([name(b), v === null ? "–" : disp(v)]));
        break;
      }
      case "peak_day": {
        if (!s.date) throw new Error("peak_day needs a date column");
        const ds = typed(use(s.date)!, "date") as (Date | null)[];
        const bySum = s.by === "sum" && !!meas;
        const acc = new Map<string, number>();
        for (const i of set) { const d = ds[i]; if (!d) continue; const k = dayKey(d); acc.set(k, (acc.get(k) || 0) + (bySum ? meas![i] ?? 0 : 1)); }
        const sorted = [...acc.entries()].sort((a, b) => b[1] - a[1]);
        if (!sorted.length) throw new Error(`no dates in "${s.date}"`);
        const fmt = (v: number) => (bySum ? show(v) : nf(v));
        facts.date = fmtDay(parseDay(sorted[0][0])!);
        facts.value = fmt(sorted[0][1]);
        calc = `Day with the ${bySum ? `highest total "${s.measure}"` : "most rows"} (by "${s.date}")`;
        sorted.slice(0, 7).forEach(([k, v], j) => table.push([`${j + 1}. ${fmtDay(parseDay(k)!, true)}`, fmt(v)]));
        break;
      }
      case "streak": {
        if (!s.date) throw new Error("streak needs a date column");
        const ds = typed(use(s.date)!, "date") as (Date | null)[];
        const keys = [...new Set(set.map((i) => ds[i]).filter((d): d is Date => !!d).map(dayKey))].sort();
        if (!keys.length) throw new Error(`no dates in "${s.date}"`);
        const dn = (k: string) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
        let best: [string, string] = [keys[0], keys[0]], cur: [string, string] = [keys[0], keys[0]];
        for (let j = 1; j < keys.length; j++) {
          cur = dn(keys[j]) === dn(keys[j - 1]) + 1 ? [cur[0], keys[j]] : [keys[j], keys[j]];
          if (dn(cur[1]) - dn(cur[0]) > dn(best[1]) - dn(best[0])) best = cur;
        }
        facts.value = nf(dn(best[1]) - dn(best[0]) + 1);
        facts.start = fmtDay(parseDay(best[0])!);
        facts.end = fmtDay(parseDay(best[1])!);
        facts.active_days = nf(keys.length);
        const from = periodRange ? dayKey(periodRange[0]) : keys[0];
        const to = periodRange ? dayKey(periodRange[1]) : keys[keys.length - 1];
        chart = { kind: "heatmap", from, to, active: keys, streak: best };
        calc = `Longest run of consecutive calendar days with at least one row (by "${s.date}")`;
        table.push(["Longest run", `${facts.value} days`], ["From", fmtDay(parseDay(best[0])!, true)], ["To", fmtDay(parseDay(best[1])!, true)], ["Days with at least one row", facts.active_days]);
        break;
      }
      case "share": {
        if (!s.match?.length) throw new Error("share needs a match filter");
        s.match.forEach((f) => use(f.col));
        const m = applyWhere(set, s.match);
        const frac = m.length / set.length;
        facts.value = `${nf(frac * 100)}%`;
        facts.matched = nf(m.length);
        facts.total = nf(set.length);
        chart = { kind: "ring", fraction: frac };
        calc = `Share of rows where ${s.match.map(describeFilter).join(" and ")}`;
        table.push(["Matching rows", facts.matched], ["All rows", facts.total], ["Share", facts.value]);
        break;
      }
      case "compare": {
        if (!s.group || !meas) throw new Error("compare needs a group and a measure");
        const g = groupKey(use(s.group)!);
        const acc = new Map<string, [number, number]>();
        for (const i of set) {
          const k = String(g[i] ?? "").trim();
          const v = meas[i];
          if (!k || v === null || v === undefined) continue;
          const a = acc.get(k) || [0, 0];
          a[0] += v; a[1]++;
          acc.set(k, a);
        }
        const minRows = Math.max(2, s.min_rows || 5);
        const groups = [...acc.entries()].filter(([, a]) => a[1] >= minRows).map(([k, a]) => [k, a[0] / a[1], a[1]] as [string, number, number]).sort((a, b) => b[1] - a[1]);
        if (groups.length < 2) throw new Error(`fewer than 2 groups of "${s.group}" with ${minRows}+ rows`);
        const hi = groups[0], lo = groups[groups.length - 1];
        facts.high = trunc(hi[0], 40); facts.high_value = show(hi[1]); facts.high_rows = nf(hi[2]);
        facts.low = trunc(lo[0], 40); facts.low_value = show(lo[1]); facts.low_rows = nf(lo[2]);
        facts.gap = fmtGap(hi[1] - lo[1], mf);
        chart = { kind: "compare", items: groups.slice(0, 6).map(([k, v]): ChartItem => ({ label: trunc(k, 28), value: v, display: show(v) })) };
        calc = `Average "${s.measure}" for each value of "${s.group}" (groups with at least ${minRows} rows)`;
        note = "A difference, not a cause.";
        groups.slice(0, 12).forEach(([k, v, n]) => table.push([`${trunc(k, 30)} (${nf(n)} rows)`, show(v)]));
        break;
      }
      case "first_last": {
        if (!s.date) throw new Error("first_last needs a date column");
        const ds = typed(use(s.date)!, "date") as (Date | null)[];
        const ix = set.filter((i) => ds[i]).sort((a, b) => ds[a]!.getTime() - ds[b]!.getTime());
        if (!ix.length) throw new Error(`no dates in "${s.date}"`);
        const a = ix[0], z = ix[ix.length - 1];
        facts.first = label(a, s.show) || `row ${a + 1}`; facts.first_date = fmtDay(ds[a]!);
        facts.last = label(z, s.show) || `row ${z + 1}`; facts.last_date = fmtDay(ds[z]!);
        calc = `Earliest and latest rows by "${s.date}"`;
        table.push([`First · ${fmtDay(ds[a]!, true)}`, facts.first], [`Last · ${fmtDay(ds[z]!, true)}`, facts.last]);
        break;
      }
      default:
        throw new Error(`unknown op "${String(s.op)}"`);
    }
    for (const f of s.where || []) use(f.col);
    const columnsUsed = [...used].map((c) => (derived.has(c) ? `${c} (cleaned from "${derived.get(c)!.from}")` : c));
    const receipt: Receipt = {
      calc,
      columns: columnsUsed,
      period: plan.period ? `${periodLabel} · ${periodText}` : periodText,
      exclusions,
      filters: (s.where || []).map(describeFilter),
      rows: set.length,
      table: table.slice(0, 24),
      ...(note ? { note } : {}),
    };
    return { id: s.id, op: s.op, angle: s.angle, facts, chart, receipt };
  }
}
