// One small chart per calculation, drawn with plain HTML/SVG in the card's own two colors.
import type { Chart, ChartItem } from "../engine/types.ts";
import { parseDay, dayKey } from "../engine/parse.ts";

type Of<K extends Chart["kind"]> = Extract<Chart, { kind: K }>;

const tick = (label: string, n: number, i: number): string => {
  if (n === 12 || n === 7) return label[0];
  if (n === 24) return i % 6 === 0 ? label.replace(" ", "\u00a0") : "";
  return label;
};

function Bars({ chart }: { chart: Of<"bars"> }) {
  const max = Math.max(...chart.items.map((it) => it.value), 0) || 1;
  const n = chart.items.length;
  const peak = chart.items[chart.peak];
  return (
    <figure className={`chart bars n${n}`} role="img" aria-label={`Peak: ${peak?.label}, ${peak?.display}`}>
      <div className="bars-row">
        {chart.items.map((it, i) => (
          <div key={i} className={`bar${i === chart.peak ? " is-peak" : ""}`}>
            {i === chart.peak && <span className="bar-tag">{it.display}</span>}
            <div className="bar-fill" style={{ height: `${Math.max(1.5, (it.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="bars-labels" aria-hidden="true">
        {chart.items.map((it, i) => <span key={i}>{tick(it.label, n, i)}</span>)}
      </div>
    </figure>
  );
}

function Rank({ items, kind }: { items: ChartItem[]; kind: "rank" | "compare" }) {
  const max = Math.max(...items.map((it) => it.value), 0) || 1;
  return (
    <ol className={`chart rank ${kind}`}>
      {items.map((it, i) => (
        <li key={i} className={i === 0 ? "is-top" : ""}>
          <span className="rank-label">{it.label}</span>
          <span className="rank-value">{it.display}</span>
          <span className="rank-bar" style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }} />
        </li>
      ))}
    </ol>
  );
}

function Ring({ fraction }: { fraction: number }) {
  const r = 40, c = 2 * Math.PI * r;
  return (
    <figure className="chart ring" role="img" aria-label={`${Math.round(fraction * 100)} percent`}>
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} className="ring-track" />
        <circle cx="50" cy="50" r={r} className="ring-arc" strokeDasharray={`${c * Math.min(1, Math.max(0, fraction))} ${c}`} transform="rotate(-90 50 50)" />
      </svg>
    </figure>
  );
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();

/** The streak drawn on real month calendars: 1–2 big months for short streaks, 12 small ones otherwise. */
function Calendar({ chart }: { chart: Of<"heatmap"> }) {
  const s = parseDay(chart.streak[0])!, e = parseDay(chart.streak[1])!;
  const from = parseDay(chart.from)!, to = parseDay(chart.to)!;
  const span = monthsBetween(s, e) + 1;
  let months: Date[];
  if (span <= 2) {
    months = Array.from({ length: span }, (_, i) => addMonths(s, i));
  } else {
    let first = new Date(s.getFullYear(), s.getMonth(), 1);
    const lastAllowed = new Date(to.getFullYear(), to.getMonth(), 1);
    if (monthsBetween(first, lastAllowed) < 11) first = addMonths(lastAllowed, -11);
    if (first < new Date(from.getFullYear(), from.getMonth(), 1) && monthsBetween(new Date(from.getFullYear(), from.getMonth(), 1), lastAllowed) >= 11) first = new Date(from.getFullYear(), from.getMonth(), 1);
    months = Array.from({ length: 12 }, (_, i) => addMonths(first, i));
  }
  const active = new Set(chart.active);
  const size = months.length === 1 ? "m1" : months.length === 2 ? "m2" : "m12";
  return (
    <figure className={`chart cal ${size}`} role="img" aria-label={`Streak from ${chart.streak[0]} to ${chart.streak[1]}`}>
      {months.map((m) => {
        const offset = (m.getDay() + 6) % 7;
        const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
        return (
          <div key={m.getTime()} className="cal-month">
            <span className="cal-name">{size === "m12" ? MONTH_SHORT[m.getMonth()] : `${MONTH_LONG[m.getMonth()]} ${m.getFullYear()}`}</span>
            <div className="cal-grid">
              {Array.from({ length: offset }, (_, i) => <span key={`x${i}`} className="d x" />)}
              {Array.from({ length: days }, (_, i) => {
                const k = dayKey(new Date(m.getFullYear(), m.getMonth(), i + 1));
                const cls = k >= chart.streak[0] && k <= chart.streak[1] ? "d s" : active.has(k) ? "d a" : "d";
                return <span key={k} className={cls}>{size === "m1" ? i + 1 : null}</span>;
              })}
            </div>
          </div>
        );
      })}
    </figure>
  );
}

export function ChartView({ chart }: { chart?: Chart }) {
  if (!chart) return null;
  switch (chart.kind) {
    case "bars": return <Bars chart={chart} />;
    case "rank": return <Rank items={chart.items} kind="rank" />;
    case "compare": return <Rank items={chart.items} kind="compare" />;
    case "ring": return <Ring fraction={chart.fraction} />;
    case "heatmap": return <Calendar chart={chart} />;
  }
}
