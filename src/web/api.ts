// Web build only. Two ways to answer the pipeline's two AI calls, with no Anywrap server in between:
// - browserApi: the visitor's own Gemini key, sent from this browser straight to Google;
// - replayApi: the plan and captions recorded from a real Gemini run on a sample file (no key needed).
// In both cases the file is read, summarized, computed and checked live in the browser, exactly as in the local app.
import { geminiPlan, geminiWrite, planUserMessage, writeUserMessage, AiError, DEFAULT_MODEL } from "../ai/gemini.ts";
import { AnywrapError } from "../engine/read.ts";
import type { Api } from "../pipeline.ts";
import type { Copy } from "../engine/types.ts";

/** timeZone: the zone the recorded run computed in; replays pin it so time-zoned timestamps give the same days. */
export type Recorded = { sample: string; model: string; recordedAt: string; timeZone: string; plan: unknown; copy: Copy };

function toAnywrap(e: unknown): unknown {
  if (!(e instanceof AiError)) return e;
  if (e.kind === "aborted") return new AnywrapError("aborted", "Cancelled.");
  if (e.kind === "bad_key") return new AnywrapError("no_key", "Google rejected this API key. Check it, or create a new one at aistudio.google.com/apikey.");
  return new AnywrapError("api", e.message);
}

export function browserApi(key: string, model = DEFAULT_MODEL): Api {
  const o = { key, model };
  return {
    async plan(body, signal) {
      try { const r = await geminiPlan(o, body, signal); return { plan: r.json, sent: planUserMessage(body), seconds: r.seconds }; }
      catch (e) { throw toAnywrap(e); }
    },
    async write(body, signal) {
      try { const r = await geminiWrite(o, body, signal); return { copy: r.json as Copy, sent: writeUserMessage(body), seconds: r.seconds }; }
      catch (e) { throw toAnywrap(e); }
    },
  };
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new AnywrapError("aborted", "Cancelled."));
    if (!ms) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new AnywrapError("aborted", "Cancelled.")); }, { once: true });
  });

/** The "sent" texts are rebuilt from what this browser actually computed, so "What the AI saw" stays exact. */
export function replayApi(rec: Recorded, delay = { plan: 2600, write: 2200 }): Api {
  return {
    async plan(body, signal) { await wait(delay.plan, signal); return { plan: rec.plan, sent: planUserMessage(body), seconds: delay.plan / 1000 }; },
    async write(body, signal) { await wait(delay.write, signal); return { copy: rec.copy, sent: writeUserMessage(body), seconds: delay.write / 1000 }; },
  };
}

