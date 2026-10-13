// The poster faces: opener, one stat card per result, closing persona.
import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { Fit } from "./Fit.tsx";
import { ChartView } from "./charts.tsx";
import { nf } from "../engine/format.ts";
import type { Card, Story } from "../engine/types.ts";
import type { Pair } from "./palettes.ts";

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const ONE_NUMBER = /^[^\d:]*?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?[^\d:]*$/;

/** Counts the single number inside `text` up from zero once, keeping its format. */
function useCountUp(text: string, run: boolean): string {
  const [out, setOut] = useState(text);
  useEffect(() => {
    const m = text.match(ONE_NUMBER);
    if (!run || !m || reduced()) { setOut(text); return; }
    const token = m[1] + (m[2] ?? "");
    const target = Number(token.replace(/,/g, ""));
    const decimals = m[2] ? m[2].length - 1 : 0;
    const grouped = m[1].includes(",");
    const fmt = (v: number) => grouped ? new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v) : v.toFixed(decimals);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      setOut(text.replace(token, fmt(target * (1 - Math.pow(1 - p, 3)))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, run]);
  return out;
}

const faceStyle = (pair: Pair): CSSProperties => ({ background: pair.bg, color: pair.fg, ["--fg" as string]: pair.fg, ["--bg" as string]: pair.bg });

function Foot({ left, exportLeft }: { left: string; exportLeft?: string }) {
  return (
    <footer className="card-foot">
      <span className={exportLeft ? "screen-only" : ""}>{left}</span>
      {exportLeft && <span className="export-only">{exportLeft}</span>}
      <span className="wordmark">Anywrap</span>
    </footer>
  );
}

export function OpenerFace({ story, pair }: { story: Story; pair: Pair }) {
  return (
    <div className="face front opener" style={faceStyle(pair)}>
      <p className="found">{story.plan.dataset.source}</p>
      <Fit className="title" text={story.opener.title} maxFrac={0.2} lines={3} />
      <p className="lede">{story.opener.line}</p>
      <div className="opener-meta">
        <span className="file">{story.file.name}</span>
        <span>{nf(story.rowsInPeriod)} rows · {story.period}</span>
      </div>
      <Foot left="Tap or press → to start" exportLeft={story.period} />
    </div>
  );
}

export function StatFace({ card, pair, animate, fileName }: { card: Card; pair: Pair; animate: boolean; fileName: string }) {
  const { caption, result } = card;
  const big = useCountUp(caption.big, animate);
  const numeric = /\d/.test(caption.big) && caption.big.length <= 14;
  const lines = numeric ? 1 : caption.big.length > 18 ? 3 : 2;
  const hasChart = !!result.chart;
  return (
    <div className={`face front stat ${hasChart ? `with-chart chart-${result.chart!.kind}` : "hero-only"}`} style={faceStyle(pair)}>
      <p className="kicker">{caption.kicker}</p>
      <Fit className={`hero${numeric ? " is-num" : " is-text"}`} text={caption.big} display={big} maxFrac={hasChart ? 0.36 : 0.5} maxHFrac={hasChart ? 0.36 : 0.62} lines={hasChart ? Math.min(lines, 2) : lines} />
      {hasChart && <div className="chart-slot"><ChartView chart={result.chart} /></div>}
      <div className="copy">
        <p className="line">{caption.line}</p>
        {caption.sub && <p className="sub">{caption.sub}</p>}
      </div>
      <Foot left={`Computed from ${nf(result.receipt.rows)} rows`} exportLeft={`Computed from ${nf(result.receipt.rows)} rows of ${fileName}`} />
    </div>
  );
}

export function ClosingFace({ story, pair }: { story: Story; pair: Pair }) {
  const highlights = story.cards.filter((c) => c.caption.big.length <= 16).slice(0, 3);
  return (
    <div className="face front closing" style={faceStyle(pair)}>
      <p className="kicker">Your year, summed up</p>
      <Fit className="persona" text={story.persona.name} maxFrac={0.19} lines={3} />
      <p className="lede">{story.persona.why}</p>
      <ul className="highlights">
        {highlights.map((c) => (
          <li key={c.result.id}><span>{c.caption.kicker}</span><strong>{c.caption.big}</strong></li>
        ))}
      </ul>
      <Foot left={`${nf(story.file.rows)} rows of ${story.file.name}`} />
    </div>
  );
}

/** Two-sided card. The back (receipt) is added in slice 3. */
export function CardShell({ front, back, flipped, label }: { front: ReactNode; back?: ReactNode; flipped?: boolean; label: string }) {
  return (
    <div className={`card${flipped ? " is-flipped" : ""}`} aria-label={label} role="group">
      <div className="card-inner">
        {front}
        {back}
      </div>
    </div>
  );
}
