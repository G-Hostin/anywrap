// Any export file -> one table of strings. Runs in the browser; the file never leaves it.
import { clean } from "./parse.ts";
import type { Table } from "./types.ts";

export const MAX_BYTES = 50 * 1024 * 1024;
export const MIN_ROWS = 10;

export type ErrorCode = "empty" | "binary" | "too_big" | "too_small" | "no_table" | "no_signal" | "no_key" | "api" | "no_story" | "aborted";

export class AnywrapError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function detectSep(text: string): string {
  const nl = text.indexOf("\n");
  const line = nl === -1 ? text : text.slice(0, nl);
  let best = ",", bestN = 0;
  for (const sep of [",", ";", "\t", "|"]) {
    let n = 0, inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === sep && !inQ) n++;
    }
    if (n > bestN) { best = sep; bestN = n; }
  }
  return best;
}

export function parseCSV(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false, i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      // fast path: copy up to the next quote
      const next = text.indexOf('"', i);
      if (next === -1) { field += text.slice(i); i = n; continue; }
      field += text.slice(i, next); i = next; continue;
    }
    if (c === '"' && field === "") { inQ = true; i++; continue; }
    if (c === sep) { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function dedupeHeaders(h: string[]): string[] {
  const seen: Record<string, number> = {};
  return h.map((x, i) => {
    let name = clean(x) || `column ${i + 1}`;
    if (seen[name]) { seen[name]++; name = `${name} (${seen[name]})`; } else seen[name] = 1;
    return name;
  });
}

type Found = { arr: Record<string, unknown>[]; path: string };
const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

function findRecords(v: unknown, path = "$", depth = 0): Found | null {
  let best: Found | null = null;
  const consider = (f: Found | null) => { if (f && (!best || f.arr.length > best.arr.length)) best = f; };
  if (Array.isArray(v)) {
    if (v.length && v.filter(isRecord).length >= v.length * 0.8) consider({ arr: v.filter(isRecord), path });
    if (depth < 4) for (const x of v.slice(0, 3)) if (x && typeof x === "object") consider(findRecords(x, path + "[]", depth + 1));
  } else if (isRecord(v) && depth < 4) {
    for (const [k, x] of Object.entries(v)) consider(findRecords(x, `${path}.${k}`, depth + 1));
  }
  return best;
}

function flatten(obj: Record<string, unknown>, prefix = "", out: Record<string, string> = {}, depth = 0): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) out[key] = "";
    else if (Array.isArray(v)) {
      if (v.length && isRecord(v[0]) && depth < 4) flatten(v[0], key, out, depth + 1);
      else out[key] = v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
    } else if (isRecord(v)) {
      if (depth < 4) flatten(v, key, out, depth + 1);
    } else out[key] = String(v);
  }
  return out;
}

function tryJSON(t: string): unknown {
  try { return JSON.parse(t); } catch { /* not plain JSON */ }
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  try { return lines.map((l) => JSON.parse(l)); } catch { return null; }
}

export function readText(name: string, raw: string, bytes = raw.length): Table {
  if (bytes > MAX_BYTES) throw new AnywrapError("too_big", `This file is ${(bytes / 1048576).toFixed(0)} MB. Anywrap reads files up to 50 MB.`);
  const text = raw.replace(/^\uFEFF/, "");
  if (!text.trim()) throw new AnywrapError("empty", "This file is empty.");
  if (text.slice(0, 4096).includes("\u0000") || /^%PDF|^\x89PNG|^PK\u0003\u0004|^GIF8|^\xFF\xD8/.test(text.slice(0, 8))) {
    throw new AnywrapError("binary", "This looks like a binary file (PDF, image, archive…). Anywrap reads CSV, TSV and JSON exports.");
  }
  let table: Table;
  const t = text.trimStart();
  const data = t.startsWith("[") || t.startsWith("{") ? tryJSON(t) : null;
  if (data) {
    const found = findRecords(data);
    if (!found) throw new AnywrapError("no_table", "This JSON file has no list of records to read.");
    const records = found.arr.map((r) => flatten(r));
    const columns: string[] = [];
    const seen = new Set<string>();
    for (const r of records) for (const k of Object.keys(r)) if (!seen.has(k) && columns.length < 80) { seen.add(k); columns.push(k); }
    table = { name, format: "json", note: found.path === "$" ? "a list of records" : `records found at ${found.path}`, columns, rows: records.map((r) => columns.map((c) => r[c] ?? "")), bytes };
  } else {
    const sep = detectSep(text);
    const all = parseCSV(text, sep);
    if (!all.length) throw new AnywrapError("no_table", "Anywrap couldn't find a table in this file.");
    const widths: Record<number, number> = {};
    for (const r of all.slice(0, 60)) widths[r.length] = (widths[r.length] || 0) + 1;
    const mode = +Object.entries(widths).sort((a, b) => b[1] - a[1])[0][0];
    if (mode < 2) throw new AnywrapError("no_table", "Anywrap couldn't find columns in this file. It reads CSV, TSV and JSON exports.");
    const hi = all.findIndex((r) => r.length === mode);
    const columns = dedupeHeaders(all[hi]);
    const rows = all.slice(hi + 1).map((r) => columns.map((_, i) => r[i] ?? ""));
    const sepName = sep === "\t" ? "tabs" : sep === ";" ? "semicolons" : sep === "|" ? "pipes" : "commas";
    table = { name, format: "csv", note: `separated by ${sepName}${hi ? `, ${hi} line(s) skipped before the header` : ""}`, columns, rows, bytes };
  }
  if (table.rows.length < MIN_ROWS) throw new AnywrapError("too_small", `Only ${table.rows.length} row(s) here. Anywrap needs at least ${MIN_ROWS} to find a story.`);
  return table;
}
