// Home: says what Anywrap does in one look (a raw export turning into story cards), a drop zone,
// three very different sample files with the cards they produced, and how the numbers stay honest.
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Fit } from "./Fit.tsx";
import { pairFor } from "./palettes.ts";
import { SAMPLES, type Sample } from "../samples.ts";
import type { Palette } from "../engine/types.ts";

export type Health = { state: "loading" } | { state: "ok"; hasKey: boolean; model: string } | { state: "down" };

type Mini = { palette: Palette; pair: number; kicker: string; big: string; line: string; file: string };

// Every value below was computed by Anywrap on the sample files (saved Gemini stories, 13 Oct 2026).
const HERO_FILE = {
  name: "bank-account.csv",
  meta: "790 rows · 7 columns",
  lines: [
    "Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #",
    "CREDIT,02/28/2026,ACME ROBOTICS PAYROLL PPD ID: 9001,2380.55,ACH_CREDIT,29059.60,",
    "DEBIT,02/27/2026,METRO TRANSIT FARE,-2.50,DEBIT_CARD,26679.05,",
    "DEBIT,02/27/2026,BEAN THERE CAFE #1203 AUSTIN TX,-5.09,DEBIT_CARD,26681.55,",
    "DEBIT,02/26/2026,ATM WITHDRAWAL 00431 CONGRESS AVE,-100.00,ATM,26686.64,",
    "DEBIT,02/26/2026,METRO TRANSIT FARE,-2.50,DEBIT_CARD,26786.64,",
  ],
};
const HERO_CARDS: Mini[] = [
  { palette: "ink", pair: 1, kicker: "The grand total", big: "$36,520", line: "Spent across 651 purchases in 2025.", file: "bank-account.csv" },
  { palette: "ink", pair: 0, kicker: "Your favorite stop", big: "BEAN THERE CAFE", line: "252 visits, 39% of your purchases.", file: "bank-account.csv" },
  { palette: "ink", pair: 2, kicker: "Longest streak", big: "65 days", line: "In a row with at least one purchase.", file: "bank-account.csv" },
];

type Case = { sample: string; title: string; tags: string[]; lines: string[]; readAs: string; cards: Mini[] };
const CASES: Case[] = [
  {
    sample: "sleep-diary.csv",
    title: "A sleep diary",
    tags: ["CSV", "semicolons", "French headers", "decimal commas"],
    lines: [
      "date;coucher;réveil;durée (h);qualité (1-5);réveils nocturnes;café après 16h;notes",
      '02/03/2025;22:55;07:08;"8,2";4;1;non;voisins bruyants',
      '03/03/2025;00:01;08:04;"8,1";4;1;non;',
      '07/03/2025;01:03;09:51;"8,8";4;2;oui;',
    ],
    readAs: "One row is one night of sleep",
    cards: [
      { palette: "tide", pair: 0, kicker: "Weekday rhythm", big: "Friday", line: "Your longest nights: 7.7 h on average.", file: "sleep-diary.csv" },
      { palette: "tide", pair: 2, kicker: "The coffee gap", big: "0.8 points", line: "Sleep quality after a coffee past 4 PM: 3.2/5. Without: 4/5.", file: "sleep-diary.csv" },
    ],
  },
  {
    sample: "watch-history.json",
    title: "A video watch history",
    tags: ["JSON", "nested", "ads mixed in", "UTC times"],
    lines: [
      '[{ "header": "…", "title": "Watched Ramen from scratch",',
      '   "subtitles": [{ "name": "Kitchen Lab", "url": "…" }],',
      '   "time": "2026-01-31T21:49:11.152Z", "products": […] },',
      ' { "header": "…", "title": "Watched How does GPS actually work?", …',
    ],
    readAs: "One item is one video watched, ads left out",
    cards: [
      { palette: "neon", pair: 0, kicker: "Top channel", big: "Kitchen Lab", line: "523 videos, more than any other channel.", file: "watch-history.json" },
      { palette: "neon", pair: 1, kicker: "Daily streak", big: "365", line: "Days in a row with at least one video.", file: "watch-history.json" },
    ],
  },
  {
    sample: "running-log.csv",
    title: "A fitness tracker log",
    tags: ["CSV", "19 columns", "distance twice, in km and m"],
    lines: [
      "Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Max Heart Rate,…",
      '11873400001,"Nov 1, 2024, 10:02:51 AM",Morning Walk,Walk,legs felt heavy,3446,4.61,178,…',
      '11873400003,"Nov 5, 2024, 6:48:32 AM",Morning Run,Run,,1870,5.04,178,…',
      '11873400004,"Nov 7, 2024, 6:16:01 AM",Morning Run,Run,,2009,5.86,174,…',
    ],
    readAs: "One row is one workout",
    cards: [
      { palette: "ember", pair: 0, kicker: "Ground covered", big: "2,350 km", line: "Across 181 workouts in 2025.", file: "running-log.csv" },
      { palette: "ember", pair: 2, kicker: "Favorite move", big: "Run", line: "132 of your 181 workouts.", file: "running-log.csv" },
    ],
  },
];

function MiniCard({ s, className }: { s: Mini; className: string }) {
  const pair = pairFor(s.palette, s.pair);
  const num = /\d/.test(s.big);
  return (
    <div className={`mini ${className}`} aria-hidden="true">
      <div className="face front stat hero-only" style={{ background: pair.bg, color: pair.fg, ["--fg" as string]: pair.fg }}>
        <p className="kicker">{s.kicker}</p>
        <Fit className={`hero ${num ? "is-num" : "is-text"}`} text={s.big} maxFrac={0.5} maxHFrac={0.62} lines={num ? 1 : 2} />
        <div className="copy"><p className="line">{s.line}</p></div>
        <footer className="card-foot"><span>{s.file}</span><span className="wordmark">Anywrap</span></footer>
      </div>
    </div>
  );
}

function RawFile({ name, meta, lines, className = "" }: { name: string; meta: string; lines: string[]; className?: string }) {
  return (
    <figure className={`raw ${className}`}>
      <figcaption><span className="raw-name">{name}</span><span>{meta}</span></figcaption>
      <pre>{lines.join("\n")}</pre>
    </figure>
  );
}

const UploadIcon = () => (
  <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
    <path d="M13 6h15l10 10v26H13z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M28 6v10h10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M25.5 36V22m0 0-5.5 5.5M25.5 22l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type Web = { hasKey: boolean; remembered: boolean; onAddKey: () => void; onForgetKey: () => void };
type Props = {
  health: Health;
  error: string;
  onFile: (f: File) => void;
  onSample: (s: Sample) => void;
  /** web build: no local server; samples replay a recorded AI run, own files use the visitor's Gemini key */
  web?: Web;
};

export function Home({ health, error, onFile, onSample, web }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const ready = web ? true : health.state === "ok" && health.hasKey;
  const sampleOf = (file: string) => SAMPLES.find((s) => s.file === file);

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
        <a className="home-link" href="https://github.com/G-Hostin/anywrap" target="_blank" rel="noreferrer">Code on GitHub</a>
      </header>

      {!web && health.state === "ok" && !health.hasKey && (
        <div className="banner" role="alert">
          <strong>Add a free Gemini API key to start.</strong> Get one at <code>aistudio.google.com/apikey</code>, create a file named <code>.env</code> next to
          <code>package.json</code> with the line <code>GEMINI_API_KEY=your-key</code>, then restart Anywrap. The key stays on this computer.
        </div>
      )}
      {!web && health.state === "down" && (
        <div className="banner" role="alert"><strong>Can't reach the local Anywrap server.</strong> Start it with <code>npm start</code>, then reload this page.</div>
      )}

      <main className="home-main">
        <section className="home-left">
          <h1 className="headline">Turn any data export into your year in review.</h1>
          <p className="promise">
            Your bank, your fitness tracker, your sleep app, your watch history: every app can give you your data as a file.
            Drop that CSV or JSON here and flip through your year as story cards. The AI picks the story, your browser
            computes every number, and each number comes with its receipt.
          </p>

          <div
            className={`drop${ready ? "" : " is-disabled"}`}
            role="button"
            tabIndex={ready ? 0 : -1}
            aria-disabled={!ready}
            aria-label="Choose an export file"
            onClick={pick}
            onKeyDown={onKey}
            onDragOver={stop}
          >
            <UploadIcon />
            <div>
              <p className="drop-title">
                {over ? "Let go to wrap it" : <><span className="when-pointer">Drop your export file here</span><span className="when-touch">Choose your export file</span></>}
              </p>
              <p className="drop-sub"><span className="when-pointer">or click to browse. </span>CSV or JSON, up to 50 MB. The file stays on this computer.</p>
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
          {web && (
            <p className="key-status">
              {web.hasKey
                ? <>Your Gemini key is saved {web.remembered ? "on this device" : "for this tab"}. <button className="link-inline" onClick={web.onForgetKey}>Forget it</button></>
                : <>Your own file needs a free Gemini API key: Anywrap will ask for it. <button className="link-inline" onClick={web.onAddKey}>Add a key now</button></>}
            </p>
          )}

          <div className="samples">
            <p>No export at hand? Try a sample file. The data is made up.{web ? " Samples replay a recorded AI run, so they need no key." : ""}</p>
            <ul>
              {SAMPLES.map((s) => (
                <li key={s.file}>
                  <button className="chip" onClick={() => onSample(s)} disabled={!ready}>
                    <span className="chip-name">{s.label}<em>{s.file.split(".").pop()}</em></span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="home-right" aria-label="Example: a bank export and three cards Anywrap made from it">
          <div className="demo">
            <RawFile name={HERO_FILE.name} meta={HERO_FILE.meta} lines={HERO_FILE.lines} className="raw-hero" />
            <div className="demo-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 4v15m0 0-6-6m6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span>becomes</span>
            </div>
            <div className="fan">{HERO_CARDS.map((s, i) => <MiniCard key={s.kicker} s={s} className={`mini-${i}`} />)}</div>
          </div>
          <p className="fan-note">A made-up bank export, and three of the cards Anywrap made from it</p>
        </section>
      </main>

      <section className="cases" aria-labelledby="cases-title">
        <div className="cases-head">
          <h2 id="cases-title">It reads files it has never seen</h2>
          <p>
            There is no template per app. Each file below has its own layout, language and quirks. The AI works out what
            the file is from a short summary, then picks the stats worth telling.
          </p>
        </div>
        <div className="case-list">
          {CASES.map((c) => {
            const s = sampleOf(c.sample);
            return (
              <article className="case" key={c.sample}>
                <h3>{c.title}</h3>
                <ul className="tags" aria-label="File format">{c.tags.map((t) => <li key={t}>{t}</li>)}</ul>
                <RawFile name={c.sample} meta="raw file" lines={c.lines} />
                <p className="read-as"><span>Anywrap reads it as</span>{c.readAs}</p>
                <div className="case-cards">{c.cards.map((m, i) => <MiniCard key={m.kicker} s={m} className={`case-mini case-mini-${i}`} />)}</div>
                {s && <button className="pill case-try" onClick={() => onSample(s)} disabled={!ready}>Make the full story</button>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="how" aria-labelledby="how-title">
        <h2 id="how-title">How the numbers stay honest</h2>
        <ol>
          <li>
            <h3>Your browser reads the file</h3>
            <p>The file stays on this computer. Anywrap writes a short summary of it: column names, value types, ranges and 5 example rows.</p>
          </li>
          <li>
            <h3>The AI picks the story</h3>
            <p>From that summary only, it works out what the file is and chooses stats from a fixed menu of calculations. It never writes a number.</p>
          </li>
          <li>
            <h3>Your browser computes every number</h3>
            <p>The AI then writes the captions from the results, and a checker rejects any number the calculations didn't produce.</p>
          </li>
          <li>
            <h3>Every card has a receipt</h3>
            <p>Flip a card to see how its number was made: the calculation, the columns, the period and the rows it used.</p>
          </li>
        </ol>
        {web ? (
          <p className="how-foot">
            On this site there is no Anywrap server. The samples replay the AI's answers from a real Gemini run, recorded so they
            work without a key; reading, computing and checking still run live in your browser. Your own files use your own
            Gemini key ({health.state === "ok" ? health.model : "Gemini"}), sent from your browser straight to Google with the summary and the computed results. Nothing is stored.
          </p>
        ) : (
          <p className="how-foot">
            {health.state === "ok" ? `Model: ${health.model}. ` : ""}The summary and the computed results go to Gemini (Google) through the local
            server, which holds your key. Nothing is stored.
          </p>
        )}
      </section>
    </div>
  );
}
