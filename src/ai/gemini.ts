// The Gemini API call, shared by the local server (key from .env) and the web build (the visitor's own key,
// sent from their browser straight to Google). Nothing else in the app talks to the AI provider.
import { PLANNER, PLANNER_REPAIR, WRITER, WRITER_RETRY, PLAN_SCHEMA, COPY_SCHEMA } from "./prompts.ts";

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const TIMEOUT_MS = 90_000;
const RETRIES = 2; // free-tier keys hit short rate limits; wait and retry before giving up

export type AiErrorKind = "bad_key" | "quota" | "timeout" | "network" | "aborted" | "refused" | "bad_answer" | "upstream";

export class AiError extends Error {
  kind: AiErrorKind;
  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export type GeminiOptions = { key: string; model?: string; thinking?: string };
export type PlanRequest = { summary: unknown; repair?: { plan: unknown; errors: string[]; counts: unknown } };
export type WriteRequest = { story: unknown; retry?: { previous: unknown; problems: unknown[] } };
export type AiResult = { json: unknown; usage: { input: number; output: number }; seconds: number };

type GeminiBody = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new AiError("aborted", "Cancelled.")); }, { once: true });
  });

async function call(o: GeminiOptions, system: string, user: string, schema: object, maxTokens: number, signal?: AbortSignal): Promise<AiResult> {
  const t0 = Date.now();
  const model = o.model || DEFAULT_MODEL;
  const request = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      maxOutputTokens: maxTokens,
      thinkingConfig: { thinkingLevel: o.thinking || "high" },
    },
  });

  let res: Response;
  for (let attempt = 0; ; attempt++) {
    try {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": o.key, "content-type": "application/json" },
        body: request,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (e) {
      if (signal?.aborted) throw new AiError("aborted", "Cancelled.");
      if ((e as Error).name === "TimeoutError") throw new AiError("timeout", `The AI took longer than ${TIMEOUT_MS / 1000} seconds to answer.`);
      throw new AiError("network", "Couldn't reach the AI provider. Check your connection.");
    }
    if ((res.status === 429 || res.status === 503) && attempt < RETRIES) { await sleep(5000 * (attempt + 1), signal); continue; }
    break;
  }

  const body = (await res.json().catch(() => ({}))) as GeminiBody;
  if (!res.ok) {
    const detail = body.error?.message ?? "";
    if (res.status === 403 || (res.status === 400 && /api key/i.test(detail))) throw new AiError("bad_key", "Google rejected this API key.");
    if (res.status === 429) throw new AiError("quota", "The free Gemini quota is used up for now. Try again in a minute, or tomorrow if the daily limit is reached.");
    throw new AiError("upstream", `The AI provider answered with an error (${res.status}).${detail ? " " + detail.slice(0, 200) : ""}`);
  }
  if (body.promptFeedback?.blockReason) throw new AiError("refused", `The AI provider refused the request (${body.promptFeedback.blockReason}).`);
  const cand = body.candidates?.[0];
  if (cand?.finishReason === "MAX_TOKENS") throw new AiError("bad_answer", "The AI's answer was cut off.");
  const text = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new AiError("bad_answer", "The AI's answer wasn't valid JSON."); }
  const u = body.usageMetadata ?? {};
  return { json, usage: { input: u.promptTokenCount ?? 0, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) }, seconds: (Date.now() - t0) / 1000 };
}

export function planUserMessage(req: PlanRequest): string {
  let msg = "SUMMARY:\n" + JSON.stringify(req.summary);
  if (req.repair) msg += `\n\nYOUR PLAN:\n${JSON.stringify(req.repair.plan)}\n\n${PLANNER_REPAIR}\nERRORS:\n${req.repair.errors.join("\n")}\nROW COUNTS: ${JSON.stringify(req.repair.counts)}`;
  return msg;
}

export function writeUserMessage(req: WriteRequest): string {
  let msg = "RESULTS:\n" + JSON.stringify(req.story);
  if (req.retry) msg += `\n\nYOUR PREVIOUS ANSWER:\n${JSON.stringify(req.retry.previous)}\n\n${WRITER_RETRY}\nPROBLEMS:\n${JSON.stringify(req.retry.problems)}`;
  return msg;
}

export const geminiPlan = (o: GeminiOptions, req: PlanRequest, signal?: AbortSignal) => call(o, PLANNER, planUserMessage(req), PLAN_SCHEMA, 12000, signal);
export const geminiWrite = (o: GeminiOptions, req: WriteRequest, signal?: AbortSignal) => call(o, WRITER, writeUserMessage(req), COPY_SCHEMA, 8000, signal);
export const prompts = () => ({ planner: PLANNER, writer: WRITER });
