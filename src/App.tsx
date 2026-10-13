// Screen state: home -> working -> story. File problems go back to Home (nothing was sent);
// AI or network problems stay on Working with "Try again".
import { useCallback, useEffect, useRef, useState } from "react";
import { makeStory, httpApi, type Step } from "./pipeline.ts";
import { loadSample, type Sample } from "./samples.ts";
import { AnywrapError, MAX_BYTES, type ErrorCode } from "./engine/read.ts";
import { Home, type Health } from "./ui/Home.tsx";
import { Working } from "./ui/Working.tsx";
import { StoryView } from "./ui/Story.tsx";
import type { Story } from "./engine/types.ts";

type Input = { name: string; text: string; bytes: number };
type Screen =
  | { at: "home"; error: string }
  | { at: "working"; name: string; bytes: number; steps: Step[]; error: string }
  | { at: "story"; story: Story };

const FILE_ERRORS: ErrorCode[] = ["empty", "binary", "too_big", "too_small", "no_table", "no_signal"];

export function App() {
  const [screen, setScreen] = useState<Screen>({ at: "home", error: "" });
  const [health, setHealth] = useState<Health>({ state: "loading" });
  const abort = useRef<AbortController | null>(null);
  const last = useRef<() => Promise<Input>>(null);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((h) => setHealth({ state: "ok", hasKey: !!h.hasKey, model: String(h.model) })).catch(() => setHealth({ state: "down" }));
  }, []);

  // Dev only: ?replay=bank-account.csv shows a story saved by `npm run check:live`, without calling the AI.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const name = new URLSearchParams(location.search).get("replay");
    if (!name) return;
    fetch(`/__live/${encodeURIComponent(name)}.json`).then((r) => r.json()).then((story) => setScreen({ at: "story", story })).catch(() => {});
  }, []);

  const run = useCallback(async (get: () => Promise<Input>, label: { name: string; bytes: number }) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    last.current = get;
    setScreen({ at: "working", name: label.name, bytes: label.bytes, steps: [], error: "" });
    try {
      const input = await get();
      if (!ctrl.signal.aborted) setScreen((s) => (s.at === "working" ? { ...s, bytes: input.bytes } : s));
      const story = await makeStory(input, httpApi, (step) => {
        if (ctrl.signal.aborted) return;
        setScreen((s) => (s.at === "working" ? { ...s, steps: [...s.steps.filter((p) => p.id !== step.id), step] } : s));
      }, ctrl.signal);
      if (!ctrl.signal.aborted) setScreen({ at: "story", story });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const err = e instanceof AnywrapError ? e : new AnywrapError("api", (e as Error).message || "Something went wrong.");
      if (err.code === "aborted") return;
      if (FILE_ERRORS.includes(err.code)) setScreen({ at: "home", error: `${label.name}: ${err.message}` });
      else if (err.code === "no_key") { setHealth((h) => (h.state === "ok" ? { ...h, hasKey: false } : h)); setScreen({ at: "home", error: "" }); }
      else setScreen((s) => (s.at === "working" ? { ...s, error: err.message } : { at: "home", error: err.message }));
    }
  }, []);

  const onFile = useCallback((f: File) => {
    if (f.size > MAX_BYTES) { setScreen({ at: "home", error: `${f.name}: this file is ${(f.size / 1048576).toFixed(0)} MB. Anywrap reads files up to 50 MB.` }); return; }
    run(() => f.text().then((text) => ({ name: f.name, text, bytes: f.size })), { name: f.name, bytes: f.size });
  }, [run]);

  const onSample = useCallback((s: Sample) => run(() => loadSample(s), { name: s.file, bytes: 0 }), [run]);

  const home = useCallback(() => { abort.current?.abort(); setScreen({ at: "home", error: "" }); }, []);

  if (screen.at === "story") return <StoryView story={screen.story} onRestart={home} />;
  if (screen.at === "working") {
    return (
      <Working
        fileName={screen.name}
        fileSize={screen.bytes}
        steps={screen.steps}
        error={screen.error}
        onCancel={home}
        onHome={home}
        onRetry={() => last.current && run(last.current, { name: screen.name, bytes: screen.bytes })}
      />
    );
  }
  return <Home health={health} error={screen.error} onFile={onFile} onSample={onSample} />;
}
