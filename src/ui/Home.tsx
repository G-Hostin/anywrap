// Home: what Anywrap does, a drop zone printed like a receipt slip, sample files, and how it keeps numbers honest.
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Fit } from "./Fit.tsx";
import { pairFor } from "./palettes.ts";
import { SAMPLES, type Sample } from "../samples.ts";
import type { Palette } from "../engine/types.ts";

export type Health = { state: "loading" } | { state: "ok"; hasKey: boolean; model: string } | { state: "down" };

// Three real cards from the sample files (values computed by Anywrap on those files).
const SHOWCASE: { palette: Palette; pair: number; kicker: string; big: string; line: string; file: string }[] = [
  { palette: "neon", pair: 0, kicker: "Your number one channel", big: "Kitchen Lab", line: "23% of everything you watched.", file: "watch-history.json" },
  { palette: "tide", pair: 1, kicker: "Lights out", big: "11:43 PM", line: "Your average bedtime, across 266 nights.", file: "sleep-diary.csv" },
  { palette: "ember", pair: 0, kicker: "Total ground covered", big: "2,350 km", line: "Runs, rides, swims and walks in 2025.", file: "running-log.csv" },
];

function MiniCard({ s, i }: { s: (typeof SHOWCASE)[number]; i: number }) {
  const pair = pairFor(s.palette, s.pair);
  return (
    <div className={`mini mini-${i}`} aria-hidden="true">
      <div className="face front stat hero-only" style={{ background: pair.bg, color: pair.fg, ["--fg" as string]: pair.fg }}>
        <p className="kicker">{s.kicker}</p>
        <Fit className={`hero ${/\d/.test(s.big) ? "is-num" : "is-text"}`} text={s.big} maxFrac={0.5} maxHFrac={0.62} lines={/\d/.test(s.big) ? 1 : 2} />
        <div className="copy"><p className="line">{s.line}</p></div>
        <footer className="card-foot"><span>{s.file}</span><span className="wordmark">Anywrap</span></footer>
      </div>
    </div>
  );
}

type Props = {
  health: Health;
  error: string;
  onFile: (f: File) => void;
  onSample: (s: Sample) => void;
};

export function Home({ health, error, onFile, onSample }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const ready = health.state === "ok" && health.hasKey;

  // the whole page accepts a dropped file
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: globalThis.DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const enter = (e: globalThis.DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setOver(true); };
    const leave = (e: globalThis.DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setOver(false); };
    const overFn = (e: globalThis.DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; setOver(false);
      const f = e.dataTransfer?.files?.[0];
      if (f && ready) onFile(f);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", overFn);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", overFn);
      window.removeEventListener("drop", drop);
    };
  }, [onFile, ready]);

  const pick = () => { if (ready) input.current?.click(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
  const stop = (e: DragEvent) => e.preventDefault();

  return (
    <div className={`home${over ? " is-over" : ""}`}>
      <header className="home-top">
        <span className="wordmark">Anywrap</span>
        <span className="home-tag">A year-in-review for any data export</span>
      </header>

      {health.state === "ok" && !health.hasKey && (
        <div className="banner" role="alert">
          <strong>Add an Anthropic API key to start.</strong> Create a file named <code>.env</code> next to <code>package.json</code> with
          the line <code>ANTHROPIC_API_KEY=your-key</code>, then restart Anywrap. The key stays on this computer.
        </div>
      )}
      {health.state === "down" && (
        <div className="banner" role="alert"><strong>Can't reach the local Anywrap server.</strong> Start it with <code>npm start</code>, then reload this page.</div>
      )}

      <main className="home-main">
        <section className="home-left">
          <h1 className="headline">Every export has a story.</h1>
          <p className="promise">
            Drop a CSV or JSON file from any app and flip through your year. The AI picks the story; your browser computes
            every number, and each one comes with a receipt.
          </p>

          <div
            className={`slip${ready ? "" : " is-disabled"}`}
            role="button"
            tabIndex={ready ? 0 : -1}
            aria-disabled={!ready}
            aria-label="Choose an export file"
            onClick={pick}
            onKeyDown={onKey}
            onDragOver={stop}
          >
            <div className="slip-paper">
              <p className="slip-title">{over ? "Let go to wrap it" : "Drop an export here"}</p>
              <p className="slip-sub">or click to choose a file</p>
              <hr />
              <p className="slip-row"><span>CSV, TSV</span><i /><b>yes</b></p>
              <p className="slip-row"><span>JSON, JSON Lines</span><i /><b>yes</b></p>
              <p className="slip-row"><span>Largest file</span><i /><b>50 MB</b></p>
              <p className="slip-row"><span>Rows sent to the AI</span><i /><b>none</b></p>
            </div>
          </div>
          <input
            ref={input}
            type="file"
            accept=".csv,.tsv,.txt,.json,.jsonl,.ndjson,text/csv,application/json"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }}
          />
          {error && <p className="home-error" role="alert">{error}</p>}

          <div className="samples">
            <p>No export at hand? Try a sample. The data is made up.</p>
            <ul>
              {SAMPLES.map((s) => (
                <li key={s.file}>
                  <button className="chip" onClick={() => onSample(s)} disabled={!ready}>
                    <span>{s.label}</span>
                    <small>{s.detail}</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="home-right" aria-label="Example cards from the sample files">
          <div className="fan">{SHOWCASE.map((s, i) => <MiniCard key={s.file} s={s} i={i} />)}</div>
          <p className="fan-note">Real cards from the sample files</p>
        </section>
      </main>

      <section className="how" aria-labelledby="how-title">
        <h2 id="how-title">How the numbers stay honest</h2>
        <ol>
          <li>
            <h3>Your browser reads the file</h3>
            <p>Every row stays on this computer. Anywrap writes a short summary: column names, value types, ranges, a few examples.</p>
          </li>
          <li>
            <h3>The AI picks the story</h3>
            <p>From that summary only, it works out what the file is and chooses stats from a fixed menu of calculations.</p>
          </li>
          <li>
            <h3>Your browser computes every number</h3>
            <p>The AI then writes the captions from the results. A checker rejects any number that the calculations didn't produce.</p>
          </li>
        </ol>
        <p className="how-foot">
          {health.state === "ok" ? `Model: ${health.model}. ` : ""}The summary and the computed results go to Claude (Anthropic) through the local
          server, which holds your key. Nothing is stored.
        </p>
      </section>
    </div>
  );
}
