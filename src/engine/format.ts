// Human-readable values. Every number a person sees is produced here, never by the AI.
import type { Field } from "./types.ts";

export const nf = (n: number, digits = 0): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const hourLabel = (h: number): string => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

export const clockLabel = (minutes: number): string => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export const fmtDay = (d: Date, withYear = false): string =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });

export const fmtDate = (d: Date): string => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const trunc = (s: string, n = 60): string => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function fmtDuration(sec: number): string {
  const s = Math.abs(sec);
  const sign = sec < 0 ? "-" : "";
  if (s < 60) return `${sign}${nf(s)} s`;
  if (s < 3600) return `${sign}${nf(s / 60)} min`;
  if (s < 36000) {
    const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    return m ? `${sign}${h} h ${String(m).padStart(2, "0")} min` : `${sign}${h} h`;
  }
  return `${sign}${nf(s / 3600)} hours`;
}

const digitsFor = (n: number): number => (Math.abs(n) >= 100 || Number.isInteger(n) ? 0 : 1);

/** Format a measured value using the plan's declared type and unit. */
export function fmtMeasure(n: number, f?: Pick<Field, "type" | "unit">): string {
  if (f?.type === "duration") return fmtDuration(n);
  if (f?.type === "time_of_day") return clockLabel(n);
  const u = String(f?.unit ?? "").trim();
  if (/^[A-Z]{3}$/.test(u)) {
    const big = Math.abs(n) >= 1000;
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: u, maximumFractionDigits: big ? 0 : 2, minimumFractionDigits: big ? 0 : 2 }).format(n);
    } catch {
      return `${nf(n, big ? 0 : 2)} ${u}`;
    }
  }
  if (u.startsWith("/")) return `${nf(n, Number.isInteger(n) ? 0 : 1)}${u}`;
  if (u === "%") return `${nf(n, 1)}%`;
  if (u === "m" && Math.abs(n) >= 1000) return `${nf(n / 1000, Math.abs(n) >= 100000 ? 0 : 1)} km`;
  return `${nf(n, digitsFor(n))}${u ? " " + u : ""}`;
}

/** Format the gap between two measured values (scores become "points", clock times become durations). */
export function fmtGap(n: number, f?: Pick<Field, "type" | "unit">): string {
  if (f?.type === "time_of_day") return fmtDuration(n * 60);
  if (String(f?.unit ?? "").startsWith("/")) return `${nf(n, Number.isInteger(n) ? 0 : 1)} points`;
  return fmtMeasure(n, f);
}

/** File and message sizes, written the same way everywhere: "55.1 KB", "1.1 MB". */
export const sizeLabel = (bytes: number): string =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`;
