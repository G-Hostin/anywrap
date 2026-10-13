// What the AI is allowed to see: a short description of each column, never the file.
import { clean, parseNumber, parseDate, parseTimeOfDay, dayKey, TRUE_WORDS, FALSE_WORDS } from "./parse.ts";
import { trunc } from "./format.ts";
import type { Table, Summary, ColumnProfile } from "./types.ts";

const strided = <T,>(a: T[], max: number): T[] => (a.length <= max ? a : a.filter((_, i) => i % Math.ceil(a.length / max) === 0));

export function summarize(table: Table): Summary {
  const { columns, rows } = table;
  const wide = columns.length > 30;
  const cut = wide ? 40 : 60;
  const profiles: ColumnProfile[] = columns.map((name, ci) => {
    const vals: string[] = [];
    for (const r of rows) { const v = clean(r[ci]); if (v !== "") vals.push(v); }
    const freq = new Map<string, number>();
    for (const v of vals) freq.set(v, (freq.get(v) || 0) + 1);
    const p: ColumnProfile = { name, filled: `${vals.length}/${rows.length}`, distinct: freq.size };
    if (!vals.length) return p;
    const sample = strided(vals, 400);
    const share = (f: (v: string) => unknown) => sample.filter((v) => f(v) !== null).length / sample.length;

    const numDot = share((v) => parseNumber(v, ".")), numComma = share((v) => parseNumber(v, ","));
    if (Math.max(numDot, numComma) >= 0.8) {
      const dec = numComma > numDot ? "," : ".";
      let min = Infinity, max = -Infinity, negatives = 0;
      for (const v of vals) { const n = parseNumber(v, dec); if (n === null) continue; if (n < min) min = n; if (n > max) max = n; if (n < 0) negatives++; }
      p.number = { decimal: numDot === numComma ? "no decimals seen" : dec, min, max, negatives };
    }
    if (!p.number && share(parseTimeOfDay) >= 0.8) p.time_of_day = true;
    if (!p.number && !p.time_of_day) {
      const mdy = share((v) => parseDate(v, "MDY")), dmy = share((v) => parseDate(v, "DMY"));
      if (Math.max(mdy, dmy) >= 0.8) {
        const order = dmy > mdy ? "DMY" : "MDY";
        let lo = Infinity, hi = -Infinity, withTime = false;
        const perYear: Record<string, number> = {};
        for (const v of vals) {
          const d = parseDate(v, order);
          if (!d) continue;
          const t = d.getTime();
          if (t < lo) lo = t;
          if (t > hi) hi = t;
          perYear[d.getFullYear()] = (perYear[d.getFullYear()] || 0) + 1;
          if (!withTime && (d.getHours() || d.getMinutes())) withTime = true;
        }
        p.date = {
          order: mdy === dmy ? "unambiguous (ISO, or no day above 12)" : order,
          min: dayKey(new Date(lo)), max: dayKey(new Date(hi)), rows_per_year: perYear,
          has_time_of_day: withTime, tz_in_text: /(Z|[+-]\d{2}:?\d{2}|UTC|GMT)$/i.test(vals[0]),
        };
      }
    }
    if (!p.number && !p.date && freq.size <= 3 && [...freq.keys()].every((v) => TRUE_WORDS.has(v.toLowerCase()) || FALSE_WORDS.has(v.toLowerCase()))) p.boolean = true;
    p.examples = [...freq.keys()].slice(0, 3).map((v) => trunc(v, cut));
    if (!p.number && !p.date && freq.size < rows.length * 0.9) {
      p.top_values = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([v, n]) => [trunc(v, 50), n]);
    }
    if (!p.number && !p.date) p.avg_length = Math.round(vals.reduce((a, v) => a + v.length, 0) / vals.length);
    return p;
  });
  const n = rows.length;
  const picks = (wide ? [0, Math.floor(n / 2), n - 1] : [0, 1, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1]).filter((v, i, a) => v >= 0 && v < n && a.indexOf(v) === i);
  const sample_rows = picks.map((i) => Object.fromEntries(columns.map((c, ci) => [c, trunc(clean(rows[i][ci]), cut)] as [string, string]).filter(([, v]) => v !== "")));
  return { file: table.name, format: table.format, note: table.note, row_count: n, columns: profiles, sample_rows };
}

/** True when the table has nothing a story could be built on (no number, date, clock time or repeated text). */
export function hasSignal(s: Summary): boolean {
  return s.columns.some((c) => c.number || c.date || c.time_of_day || (c.top_values && c.top_values[0] && c.top_values[0][1] > 1));
}
