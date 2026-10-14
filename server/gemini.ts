// Local server side of the AI call: reads the key from .env and maps AI errors to HTTP statuses.
// The call itself (prompts, schemas, retries) lives in src/ai/, shared with the web build.
import { DEFAULT_MODEL, AiError, geminiPlan, geminiWrite, planUserMessage, writeUserMessage, prompts, type PlanRequest, type WriteRequest } from "../src/ai/gemini.ts";

export { planUserMessage, writeUserMessage, prompts };
export type { PlanRequest, WriteRequest };

export const MODEL = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
const THINKING = process.env.GEMINI_THINKING?.trim() || "high"; // minimal | low | medium | high

export class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const hasKey = (): boolean => !!process.env.GEMINI_API_KEY?.trim();

const STATUS: Record<AiError["kind"], number> = { bad_key: 502, quota: 502, timeout: 504, network: 504, aborted: 499, refused: 502, bad_answer: 502, upstream: 502 };

async function withKey<T>(fn: (o: { key: string; model: string; thinking: string }) => Promise<T>): Promise<T> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new UpstreamError(503, "No API key: add GEMINI_API_KEY to .env and restart Anywrap.");
  try {
    return await fn({ key, model: MODEL, thinking: THINKING });
  } catch (e) {
    if (e instanceof AiError) throw new UpstreamError(STATUS[e.kind], e.kind === "bad_key" ? "The API key in .env was rejected." : e.message);
    throw e;
  }
}

export const plan = (req: PlanRequest) => withKey((o) => geminiPlan(o, req));
export const write = (req: WriteRequest) => withKey((o) => geminiWrite(o, req));
