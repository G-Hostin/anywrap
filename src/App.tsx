// Screen state: home -> working -> story. File problems go back to Home (nothing was sent);
// AI or network problems stay on Working with "Try again".
// Two builds share this file: the local app (a local server holds the key) and the web build (`--mode web`,
// no server: samples replay a recorded AI run, and the visitor's own Gemini key reads their files).
import { useCallback, useEffect, useRef, useState } from "react";
import { makeStory, httpApi, type Api, type Step } from "./pipeline.ts";
import { loadSample, type Sample } from "./samples.ts";
import { AnywrapError, MAX_BYTES, type ErrorCode } from "./engine/read.ts";
import { Home, type Health } from "./ui/Home.tsx";
import { Working } from "./ui/Working.tsx";
import { StoryView } from "./ui/Story.tsx";
import { KeyDialog } from "./ui/KeyDialog.tsx";
import { browserApi, replayApi } from "./web/api.ts";
import { loadRecorded } from "./web/recorded.ts";
import { getKey, setKey, forgetKey, isRemembered } from "./web/key.ts";
import { DEFAULT_MODEL } from "./ai/gemini.ts";
import type { Story } from "./engine/types.ts";

const WEB = import.meta.env.MODE === "web";

type Input = { name: string; text: string; bytes: number };
type Job = { get: () => Promise<Input>; label: { name: string; bytes: number }; api: () => Promise<{ api: Api; replay?: NonNullable<Story["replay"]> }> };
type Screen =
  | { at: "home"; error: string }
  | { at: "working"; name: string; bytes: number; steps: Step[]; error: string; replay: boolean }
  | { at: "story"; story: Story };

const FILE_ERRORS: ErrorCode[] = ["empty", "binary", "too_big", "too_small", "no_table", "no_signal"];

export function App() {
  const [screen, setScreen] = useState<Screen>({ at: "home", error: "" });
  const [health, setHealth] = useState<Health>(WEB ? { state: "ok", hasKey: !!getKey(), model: DEFAULT_MODEL } : { state: "loading" });
  const [keyAsk, setKeyAsk] = useState<{ fileName?: string; error?: string } | null>(null);
  const [remembered, setRemembered] = useState(WEB && isRemembered());
  const abort = useRef<AbortController | null>(null);
  const last = useRef<Job | null>(null);
  const pending = useRef<Job | null>(null); // web: a file waiting for a key

  useEffect(() => {
    if (WEB) return;
    fetch("/api/health").then((r) => r.json()).then((h) => setHealth({ state: "ok", hasKey: !!h.hasKey, model: String(h.model) })).catch(() => setHealth({ state: "down" }));
  }, []);

  // Dev only: ?replay=bank-account.csv shows a story saved by `npm run check:live`, without calling the AI.
  useEffect(() => {
    if (!import.meta.env.DEV || WEB) return;
    const name = new URLSearchParams(location.search).get("replay");
    if (!name) return;
    fetch(`/__live/${encodeURIComponent(name)}.json`).then((r) => r.json()).then((story) => setScreen({ at: "story", story })).catch(() => {});
  }, []);

  const run = useCallback(async (job: Job) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    last.current = job;
    const { api, replay } = await job.api();
    setScreen({ at: "working", name: job.label.name, bytes: job.label.bytes, steps: [], error: "", replay: !!replay });
    try {
      const input = await job.get();
      if (!ctrl.signal.aborted) setScreen((s) => (s.at === "working" ? { ...s, bytes: input.bytes } : s));
      const story = await makeStory(input, api, (step) => {
        if (ctrl.signal.aborted) return;
        setScreen((s) => (s.at === "working" ? { ...s, steps: [...s.steps.filter((p) => p.id !== step.id), step] } : s));
      }, ctrl.signal, { timeZone: replay?.timeZone });
      if (!ctrl.signal.aborted) setScreen({ at: "story", story: replay ? { ...story, replay } : story });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const err = e instanceof AnywrapError ? e : new AnywrapError("api", (e as Error).message || "Something went wrong.");
      if (err.code === "aborted") return;
      if (FILE_ERRORS.includes(err.code)) setScreen({ at: "home", error: `${job.label.name}: ${err.message}` });
      else if (err.code === "no_key") {
        setHealth((h) => (h.state === "ok" ? { ...h, hasKey: false } : h));
        setScreen({ at: "home", error: "" });
        if (WEB) { forgetKey(); setRemembered(false); pending.current = job; setKeyAsk({ fileName: job.label.name, error: err.message }); }
      }
      else setScreen((s) => (s.at === "working" ? { ...s, error: err.message } : { at: "home", error: err.message }));
    }
  }, []);

  const liveApi = useCallback(async () => ({ api: WEB ? browserApi(getKey()) : httpApi }), []);

  const onFile = useCallback((f: File) => {
    if (f.size > MAX_BYTES) { setScreen({ at: "home", error: `${f.name}: this file is ${(f.size / 1048576).toFixed(0)} MB. Anywrap reads files up to 50 MB.` }); return; }
    const job: Job = { get: () => f.text().then((text) => ({ name: f.name, text, bytes: f.size })), label: { name: f.name, bytes: f.size }, api: liveApi };
    if (WEB && !getKey()) { pending.current = job; setKeyAsk({ fileName: f.name }); return; }
    run(job);
  }, [run, liveApi]);

  const onSample = useCallback((s: Sample) => {
    const sampleApi = async () => {
      if (!WEB) return liveApi();
      const rec = await loadRecorded(s.file);
      if (!rec) return liveApi();
      return { api: replayApi(rec), replay: { model: rec.model, recordedAt: rec.recordedAt, timeZone: rec.timeZone } };
    };
    run({ get: () => loadSample(s), label: { name: s.file, bytes: 0 }, api: sampleApi });
  }, [run, liveApi]);

  const saveKey = useCallback((key: string, remember: boolean) => {
    setKey(key, remember);
    setRemembered(remember);
    setHealth((h) => (h.state === "ok" ? { ...h, hasKey: true } : h));
    setKeyAsk(null);
    const job = pending.current;
    pending.current = null;
    if (job) run(job);
  }, [run]);

  const dropKey = useCallback(() => {
    forgetKey();
    setRemembered(false);
    setHealth((h) => (h.state === "ok" ? { ...h, hasKey: false } : h));
  }, []);

  const home = useCallback(() => { abort.current?.abort(); setScreen({ at: "home", error: "" }); }, []);

  const dialog = keyAsk && (
    <KeyDialog fileName={keyAsk.fileName} error={keyAsk.error} onSave={saveKey} onClose={() => { pending.current = null; setKeyAsk(null); }} />
  );

  if (screen.at === "story") return <StoryView story={screen.story} onRestart={home} />;
  if (screen.at === "working") {
    return (
      <Working
        fileName={screen.name}
        fileSize={screen.bytes}
        steps={screen.steps}
        error={screen.error}
        replay={screen.replay}
        onCancel={home}
        onHome={home}
        onRetry={() => last.current && run(last.current)}
      />
    );
  }
  return (
    <>
      <Home
        health={health}
        error={screen.error}
        onFile={onFile}
        onSample={onSample}
        web={WEB ? { hasKey: health.state === "ok" && health.hasKey, remembered, onAddKey: () => setKeyAsk({}), onForgetKey: dropKey } : undefined}
      />
      {dialog}
    </>
  );
}
