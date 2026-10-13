// Screen state: home -> working -> story. Home and Working are redesigned in slice 4.
import { useEffect, useRef, useState } from "react";
import { makeStory, httpApi, type Step } from "./pipeline.ts";
import { SAMPLES, loadSample, type Sample } from "./samples.ts";
import { StoryView } from "./ui/Story.tsx";
import type { Story } from "./engine/types.ts";

export function App() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);

  // Dev only: ?replay=bank-account.csv shows a story saved by `npm run check:live`, without calling the AI.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const name = new URLSearchParams(location.search).get("replay");
    if (!name) return;
    fetch(`/__live/${encodeURIComponent(name)}.json`).then((r) => r.json()).then(setStory).catch((e) => setError(String(e)));
  }, []);

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

  if (story) return <StoryView story={story} onRestart={() => { setStory(null); setSteps([]); }} />;

  return (
    <main className="bare">
      <h1>Anywrap</h1>
      <p>Drop an export, or pick a sample.</p>
      <input type="file" accept=".csv,.tsv,.txt,.json,.jsonl" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="row">{SAMPLES.map((s: Sample) => <button key={s.file} onClick={() => run(loadSample(s))}>{s.label}</button>)}</div>
      <ol>{steps.map((s) => <li key={s.id}>{s.text}{s.state === "active" ? "…" : " ✓"}{s.guess ? ` · ${s.guess.source}: ${s.guess.row_means}` : ""}</li>)}</ol>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
