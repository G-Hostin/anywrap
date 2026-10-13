// Slice 1: the bare pipeline in the browser. Plain list of cards with text receipts.
import { useRef, useState } from "react";
import { makeStory, httpApi, type Step } from "./pipeline.ts";
import { SAMPLES, loadSample, type Sample } from "./samples.ts";
import type { Story } from "./engine/types.ts";

export function App() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function run(input: Promise<{ name: string; text: string; bytes: number }>) {
    if (busy.current) return;
    busy.current = true;
    setStory(null); setError(""); setSteps([]);
    try {
      const file = await input;
      const s = await makeStory(file, httpApi, (step) => setSteps((prev) => [...prev.filter((p) => p.id !== step.id), step]));
      setStory(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busy.current = false;
    }
  }

  const onFile = (f?: File | null) => f && run(f.text().then((text) => ({ name: f.name, text, bytes: f.size })));

  return (
    <main className="bare">
      <h1>Anywrap</h1>
      <p>Drop an export, or pick a sample.</p>
      <input type="file" accept=".csv,.tsv,.txt,.json,.jsonl" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="row">{SAMPLES.map((s: Sample) => <button key={s.file} onClick={() => run(loadSample(s))}>{s.label}</button>)}</div>
      <ol>{steps.map((s) => <li key={s.id}>{s.text}{s.state === "active" ? "…" : " ✓"}{s.guess ? ` · ${s.guess.source}: ${s.guess.row_means}` : ""}</li>)}</ol>
      {error && <p role="alert">{error}</p>}
      {story && (
        <section>
          <h2>{story.opener.title}</h2>
          <p>{story.opener.line}</p>
          {story.cards.map((c) => (
            <article key={c.result.id} className="bare-card">
              <small>{c.caption.kicker}</small>
              <strong>{c.caption.big}</strong>
              <p>{c.caption.line} {c.caption.sub}</p>
              <pre>{[c.result.receipt.calc, `rows: ${c.result.receipt.rows}`, ...c.result.receipt.filters.map((f) => `only ${f}`), c.checked === "template" ? "template caption" : "caption checked"].join("\n")}</pre>
            </article>
          ))}
          <h3>{story.persona.name}</h3>
          <p>{story.persona.why}</p>
        </section>
      )}
    </main>
  );
}
