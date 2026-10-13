// The only place that talks to the AI provider. The key stays here, on the local server.
import { PLANNER, PLANNER_REPAIR, WRITER, WRITER_RETRY, PLAN_SCHEMA, COPY_SCHEMA } from "./prompts.ts";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const TIMEOUT_MS = 60_000;

export class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const hasKey = (): boolean => !!process.env.ANTHROPIC_API_KEY?.trim();

async function call(system: string, user: string, schema: object, maxTokens: number): Promise<{ json: unknown; usage: { input: number; output: number }; seconds: number }> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new UpstreamError(503, "No API key: add ANTHROPIC_API_KEY to .env and restart Anywrap.");
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }], output_config: { format: { type: "json_schema", schema } } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const timeout = (e as Error).name === "TimeoutError";
    throw new UpstreamError(504, timeout ? "The AI took longer than 60 seconds to answer." : "Couldn't reach the AI provider. Check your connection.");
  }
  if (!res.ok) {
    let detail = "";
    try { detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? ""; } catch { /* no body */ }
    const msg = res.status === 401 ? "The API key was rejected." : res.status === 429 ? "The AI provider is rate-limiting this key. Try again in a minute." : `The AI provider answered with an error (${res.status}).`;
    throw new UpstreamError(502, detail ? `${msg} ${detail.slice(0, 200)}` : msg);
  }
  const body = (await res.json()) as { content: { type: string; text?: string }[]; stop_reason: string; usage: { input_tokens: number; output_tokens: number } };
  if (body.stop_reason === "max_tokens") throw new UpstreamError(502, "The AI's answer was cut off.");
  const text = body.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new UpstreamError(502, "The AI's answer wasn't valid JSON."); }
  return { json, usage: { input: body.usage.input_tokens, output: body.usage.output_tokens }, seconds: (Date.now() - t0) / 1000 };
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

export const plan = (req: PlanRequest) => call(PLANNER, planUserMessage(req), PLAN_SCHEMA, 6000);
export const write = (req: WriteRequest) => call(WRITER, writeUserMessage(req), COPY_SCHEMA, 4000);
export const prompts = () => ({ planner: PLANNER, writer: WRITER });
