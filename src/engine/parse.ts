// Value parsers: numbers, dates, clock times, durations, yes/no. Locale-tolerant, no dependencies.

export const clean = (v: unknown): string => {
  let s = String(v ?? "").trim();
  const m = s.match(/^="(.*)"$/s); // Excel-style ="0123"
  if (m) s = m[1];
  return s;
};

const NUM_DOT = /^\d{1,3}(,\d{3})+(\.\d+)?$|^\d+(\.\d+)?$|^\.\d+$/;
const NUM_COMMA = /^\d{1,3}(\.\d{3})+(,\d+)?$|^\d+(,\d+)?$|^,\d+$/;

export function parseNumber(raw: unknown, decimal: "." | "," = "."): number | null {
  let s = clean(raw);
  if (!s || s.length > 40) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[\s\u00a0\u202f']/g, "").replace(/^[A-Z]{3}(?=[-+\d.,])/, "").replace(/(?<=\d)[A-Z]{3}$/, "").replace(/[$€£¥₹%]/g, "").replace(/^[−–]/, "-");
  if (s.endsWith("-")) { neg = !neg; s = s.slice(0, -1); }
  let sign = 1;
  if (s[0] === "-") { sign = -1; s = s.slice(1); } else if (s[0] === "+") s = s.slice(1);
  if (decimal === ",") { if (!NUM_COMMA.test(s)) return null; s = s.replace(/\./g, "").replace(",", "."); }
  else { if (!NUM_DOT.test(s)) return null; s = s.replace(/,/g, ""); }
  const n = Number(s) * sign * (neg ? -1 : 1);
  return Number.isFinite(n) ? n : null;
}

const MONTHS: [string, number][] = [["janvier", 0], ["janv", 0], ["january", 0], ["jan", 0], ["fevrier", 1], ["fevr", 1], ["february", 1], ["feb", 1], ["fev", 1], ["mars", 2], ["march", 2], ["mar", 2], ["avril", 3], ["april", 3], ["avr", 3], ["apr", 3], ["mai", 4], ["may", 4], ["juin", 5], ["june", 5], ["jun", 5], ["juillet", 6], ["juil", 6], ["july", 6], ["jul", 6], ["aout", 7], ["august", 7], ["aug", 7], ["septembre", 8], ["september", 8], ["sept", 8], ["sep", 8], ["octobre", 9], ["october", 9], ["oct", 9], ["novembre", 10], ["november", 10], ["nov", 10], ["decembre", 11], ["december", 11], ["dec", 11]];
const monthIndex = (name: string): number => { const hit = MONTHS.find(([k]) => name === k || (name.startsWith(k) && k.length >= 3)); return hit ? hit[1] : -1; };

// Timestamps with a time zone (or epoch numbers) are read as wall-clock time in `zone`, by default this device's.
// Replays of a recorded run pin the recording's zone, so day boundaries (and every number) match it.
let zoneFmt: Intl.DateTimeFormat | null = null;
export function setTimeZone(zone?: string): void {
  zoneFmt = zone ? new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }) : null;
}
function wall(u: Date): Date {
  if (!zoneFmt) return u;
  const p = Object.fromEntries(zoneFmt.formatToParts(u).map((x) => [x.type, x.value]));
  return new Date(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
}

function build(y: number, mo: number, d: number, hh?: string, mi?: string, ss?: string, ap?: string, tz?: string): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  let h = hh ? +hh : 0;
  if (ap) { if (h > 12 || h === 0) return null; if (h === 12) h = 0; if (ap.toLowerCase() === "pm") h += 12; }
  const min = mi ? +mi : 0, sec = ss ? +ss : 0;
  if (h > 23 || min > 59 || sec > 59) return null;
  if (tz) {
    let off = 0;
    const t = tz.toUpperCase();
    if (!["Z", "UTC", "GMT"].includes(t)) {
      const m = t.match(/([+-])(\d{2}):?(\d{2})?/);
      if (!m) return null;
      off = (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0));
    }
    const u = new Date(Date.UTC(y, mo - 1, d, h, min, sec) - off * 60000);
    return new Date(Date.UTC(y, mo - 1, d)).getUTCDate() === d ? wall(u) : null;
  }
  const date = new Date(y, mo - 1, d, h, min, sec);
  return date.getDate() === d ? date : null;
}

const T = String.raw`(?:[T\s,]+(?:at\s+)?(\d{1,2})[:h](\d{2})(?::(\d{2})(?:[.,]\d+)?)?\s*([AaPp][Mm])?)?\s*(Z|UTC|GMT|[+-]\d{2}:?\d{2}|[+-]\d{2})?`;
const RE_ISO = new RegExp(String.raw`^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})${T}$`);
const RE_NUMERIC = new RegExp(String.raw`^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})${T}$`);
const RE_WORDS = new RegExp(String.raw`^(?:[a-z]+\.?,?\s+)?(?:(\d{1,2})(?:st|nd|rd|th|er)?\s+([a-z]{3,9})\.?|([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?),?\s+(\d{4})${T.toLowerCase()}$`);

export type DateOrder = "MDY" | "DMY";

export function parseDate(raw: unknown, order: DateOrder = "MDY"): Date | null {
  const s = clean(raw);
  if (!s || s.length > 60) return null;
  let m: RegExpMatchArray | null;
  if (/^\d{10}(\.\d+)?$/.test(s) || /^\d{13}$/.test(s)) {
    const d = wall(new Date(s.length === 13 ? +s : +s * 1000));
    const y = d.getFullYear();
    return y >= 1995 && y <= 2040 ? d : null;
  }
  if ((m = s.match(RE_ISO))) return build(+m[1], +m[2], +m[3], m[4], m[5], m[6], m[7], m[8]);
  if ((m = s.match(RE_NUMERIC))) {
    const a = +m[1], b = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    const [mo, d] = order === "DMY" ? [b, a] : [a, b];
    return build(y, mo, d, m[4], m[5], m[6], m[7], m[8]);
  }
  const low = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if ((m = low.match(RE_WORDS))) {
    const mi = monthIndex(m[2] || m[3]);
    if (mi < 0) return null;
    return build(+m[5], mi + 1, +(m[1] || m[4]), m[6], m[7], m[8], m[9], m[10]);
  }
  return null;
}

/** "YYYY-MM-DD" from the AI's plan, read as a local calendar day. */
export function parseDay(s: string): Date | null {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getDate() === +m[3] ? d : null;
}

export function parseTimeOfDay(raw: unknown): number | null {
  const m = clean(raw).match(/^(\d{1,2})[:h](\d{2})(?::(\d{2}))?\s*([ap]m)?$/i);
  if (!m) return null;
  let h = +m[1];
  if (m[4]) { if (h > 12 || h === 0) return null; if (h === 12) h = 0; if (m[4].toLowerCase() === "pm") h += 12; }
  return h < 24 && +m[2] < 60 ? h * 60 + +m[2] : null; // minutes after midnight
}

const DUR: Record<string, number> = { ms: 0.001, s: 1, sec: 1, min: 60, h: 3600 };
export function parseDuration(raw: unknown, unit = "s", decimal: "." | "," = "."): number | null {
  const s = clean(raw);
  if (!s) return null;
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.\d+)?$/);
  if (m) return +(m[1] || 0) * 3600 + +m[2] * 60 + +m[3];
  const n = parseNumber(s, decimal);
  return n === null ? null : n * (DUR[unit] ?? 1);
}

export const TRUE_WORDS = new Set(["true", "yes", "y", "oui", "vrai", "si", "sí", "ja", "x", "1"]);
export const FALSE_WORDS = new Set(["false", "no", "n", "non", "faux", "nein", "0"]);

export const dayKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
