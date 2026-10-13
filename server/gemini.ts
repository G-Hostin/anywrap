// The only place that talks to the AI provider (Google Gemini). The key stays here, on the local server.
import { PLANNER, PLANNER_REPAIR, WRITER, WRITER_RETRY, PLAN_SCHEMA, COPY_SCHEMA } from "./prompts.ts";

export const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
const THINKING = process.env.GEMINI_THINKING?.trim() || "high"; // minimal | low | medium | high
const TIMEOUT_MS = 90_000;
const RETRIES = 2; // free-tier keys hit short rate limits; wait and retry before giving up

export class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const hasKey = (): boolean => !!process.env.GEMINI_API_KEY?.trim();

type GeminiBody = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(system: string, user: string, schema: object, maxTokens: number): Promise<{ json: unknown; usage: { input: number; output: number }; seconds: number }> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new UpstreamError(503, "No API key: add GEMINI_API_KEY to .env and restart Anywrap.");
  const t0 = Date.now();
  const request = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      maxOutputTokens: maxTokens,
      thinkingConfig: { thinkingLevel: THINKING },
    },
  });

  let res: Response;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: request,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      const timeout = (e as Error).name === "TimeoutError";
      throw new UpstreamError(504, timeout ? `The AI took longer than ${TIMEOUT_MS / 1000} seconds to answer.` : "Couldn't reach the AI provider. Check your connection.");
    }
    if ((res.status === 429 || res.status === 503) && attempt < RETRIES) { await sleep(5000 * (attempt + 1)); continue; }
    break;
  }

  const body = (await res.json().catch(() => ({}))) as GeminiBody;
  if (!res.ok) {
    const detail = body.error?.message ?? "";
    const rejected = res.status === 403 || (res.status === 400 && /api key/i.test(detail));
    const msg = rejected ? "The API key was rejected."
      : res.status === 429 ? "The free Gemini quota is used up for now. Try again in a minute, or tomorrow if the daily limit is reached."
      : `The AI provider answered with an error (${res.status}).`;
    throw new UpstreamError(502, detail && res.status !== 429 ? `${msg} ${detail.slice(0, 200)}` : msg);
  }
  if (body.promptFeedback?.blockReason) throw new UpstreamError(502, `The AI provider refused the request (${body.promptFeedback.blockReason}).`);
  const cand = body.candidates?.[0];
  if (cand?.finishReason === "MAX_TOKENS") throw new UpstreamError(502, "The AI's answer was cut off.");
  const text = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new UpstreamError(502, "The AI's answer wasn't valid JSON."); }
  const u = body.usageMetadata ?? {};
  return { json, usage: { input: u.promptTokenCount ?? 0, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) }, seconds: (Date.now() - t0) / 1000 };
}

export type PlanRequest = { summary: unknown; repair?: { plan: unknown; errors: string[]; counts: unknown } };
export type WriteRequest = { story: unknown; retry?: { previous: unknown; problems: unknown[] } };

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

export const plan = (req: PlanRequest) => call(PLANNER, planUserMessage(req), PLAN_SCHEMA, 12000);
export const write = (req: WriteRequest) => call(WRITER, writeUserMessage(req), COPY_SCHEMA, 8000);
export const prompts = () => ({ planner: PLANNER, writer: WRITER });
