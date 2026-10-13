// File -> story. The AI is called twice (plan, then captions); everything in between happens here, locally.
import { readText, AnywrapError } from "./engine/read.ts";
import { summarize, hasSignal } from "./engine/summary.ts";
import { runPlan } from "./engine/run.ts";
import { checkCopy, missingCaptions, mergeCaption, type Problem } from "./engine/check.ts";
import { nf, sizeLabel } from "./engine/format.ts";
import { normalizePlan } from "./engine/plan.ts";
import type { Plan, Copy, Story, Card, Summary, RunOutput, Table } from "./engine/types.ts";

export type PlanBody = { summary: Summary; repair?: { plan: Plan; errors: string[]; counts: RunOutput["counts"] } };
export type WriteBody = { story: unknown; retry?: { previous: Copy; problems: Problem[] } };
export type Api = {
  plan(body: PlanBody, signal?: AbortSignal): Promise<{ plan: unknown; sent: string; seconds: number }>;
  write(body: WriteBody, signal?: AbortSignal): Promise<{ copy: Copy; sent: string; seconds: number }>;
};

export type StepId = "read" | "plan" | "compute" | "write";
export type Step = { id: StepId; state: "active" | "done"; text: string; guess?: Plan["dataset"] };

/** Browser adapter: talks to the local server, which holds the key and the prompts. */
export const httpApi: Api = {
  async plan(body, signal) { return post("/api/plan", body, signal); },
  async write(body, signal) { return post("/api/write", body, signal); },
};

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new AnywrapError("aborted", "Cancelled.");
    throw new AnywrapError("api", "Couldn't reach the local Anywrap server. Is it still running?");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new AnywrapError(res.status === 503 ? "no_key" : "api", data.error || `The local server answered ${res.status}.`);
  return data;
}

const MIN_CARDS = 3;
const MIN_SHOWN = 6; // the writer may skip a card, but never thin the story below this

export async function makeStory(
  input: { name: string; text: string; bytes: number },
  api: Api,
  onStep: (s: Step) => void = () => {},
  signal?: AbortSignal,
): Promise<Story> {
  const t0 = Date.now();
  const stop = () => { if (signal?.aborted) throw new AnywrapError("aborted", "Cancelled."); };

  // 1. read + summarize (browser only)
  onStep({ id: "read", state: "active", text: `Reading ${input.name}` });
  const table: Table = readText(input.name, input.text, input.bytes);
  const summary = summarize(table);
  if (!hasSignal(summary)) throw new AnywrapError("no_signal", "Anywrap found no numbers, dates or repeated values in this file, so there's no story to tell.");
  onStep({ id: "read", state: "done", text: `Read ${nf(table.rows.length)} rows, ${nf(table.columns.length)} columns` });
  stop();

  // 2. plan (AI sees the summary only)
  onStep({ id: "plan", state: "active", text: "Asking the AI what this file is" });
  const first = await api.plan({ summary }, signal);
  let plan = normalizePlan(first.plan);
  onStep({ id: "plan", state: "done", text: `The AI read a ${sizeLabel(new Blob([first.sent]).size)} summary`, guess: plan.dataset });
  stop();

  // 3. compute on every row, with one repair round if cards failed
  onStep({ id: "compute", state: "active", text: `Computing ${plan.slides.length} stats on every row` });
  let run = runPlan(table, plan, summary);
  let repairs = 0;
  if (run.errors.length) {
    repairs = 1;
    onStep({ id: "compute", state: "active", text: `Fixing ${run.errors.length} stat${run.errors.length > 1 ? "s" : ""} the engine couldn't run` });
    const fixed = await api.plan({ summary, repair: { plan, errors: run.errors, counts: run.counts } }, signal);
    const fixedPlan = normalizePlan(fixed.plan);
    const rerun = runPlan(table, fixedPlan, summary);
    if (rerun.results.length >= run.results.length) { plan = fixedPlan; run = rerun; }
    stop();
  }
  if (run.results.length < MIN_CARDS) {
    throw new AnywrapError("no_story", `Anywrap couldn't find a story in this file. ${run.errors.slice(0, 3).join("; ")}`);
  }
  onStep({ id: "compute", state: "done", text: `Computed ${run.results.length} stats from ${nf(run.rowsInPeriod)} rows` });

  // 4. captions (AI sees computed facts only), checked, retried once, templates as last resort
  onStep({ id: "write", state: "active", text: "Writing your story" });
  const facts = {
    dataset: plan.dataset,
    period: run.period,
    rows_in_period: nf(run.rowsInPeriod),
    cards: run.results.map(({ id, op, angle, facts }) => ({ id, op, angle, facts })),
  };
  const extra = [run.period, nf(run.rowsInPeriod)];
  const w1 = await api.write({ story: facts }, signal);
  const copies: Copy[] = [w1.copy];
  const review = (c: Copy) => [...checkCopy(c, run.results, extra, [run.period]), ...missingCaptions(c, run.results)];
  let problems = review(w1.copy);
  const caught = problems;
  let writeSent = w1.sent;
  let rewrites = 0;
  if (problems.length) {
    rewrites = 1;
    onStep({ id: "write", state: "active", text: `Rewriting ${problems.length} caption detail${problems.length > 1 ? "s" : ""} the checker rejected` });
    const w2 = await api.write({ story: facts, retry: { previous: w1.copy, problems } }, signal);
    copies.unshift(w2.copy); // prefer the retry
    writeSent = w2.sent;
    problems = review(w2.copy);
  }
  stop();

  const latest = copies[0];
  const problemsOf = review;
  const checks = copies.map((c) => ({ copy: c, problems: c === latest ? problems : problemsOf(c) }));
  const byId = new Map(run.results.map((r) => [r.id, r]));
  const skipped = new Set((latest.skipped || []).map((s) => s.id));
  const order = [...new Set([...(latest.slides || []).map((s) => s.id).filter((id) => byId.has(id)), ...run.results.map((r) => r.id)])];
  let ids = order.filter((id) => !skipped.has(id));
  const floor = Math.min(MIN_SHOWN, order.length);
  if (ids.length < floor) {
    const back = new Set([...ids, ...order.filter((id) => skipped.has(id)).slice(0, floor - ids.length)]);
    ids = order.filter((id) => back.has(id));
  }

  const cards: Card[] = ids.map((id) => {
    const r = byId.get(id)!;
    for (const { copy, problems: ps } of checks) {
      const cap = copy.slides?.find((s) => s.id === id);
      if (cap && !ps.some((p) => p.id === id)) return { result: r, ...mergeCaption(r, cap, []) };
    }
    const cap = latest.slides?.find((s) => s.id === id);
    return { result: r, ...mergeCaption(r, cap, checks[0].problems) };
  });

  const passing = (field: "opener" | "persona") => checks.find((c) => !c.problems.some((p) => p.id === field))?.copy;
  const opener = passing("opener")?.opener ?? { title: `Your ${run.period}`, line: plan.dataset.subject };
  const persona = passing("persona")?.persona ?? { name: "A person of habit", why: "Your file has a rhythm, and now you can see it." };

  onStep({ id: "write", state: "done", text: `Story ready: ${cards.length} cards` });
  return {
    file: { name: table.name, bytes: table.bytes, rows: table.rows.length, columns: table.columns.length },
    plan,
    cards,
    opener,
    persona,
    period: run.period,
    rowsInPeriod: run.rowsInPeriod,
    sent: { plan: first.sent, planReply: JSON.stringify(plan, null, 2), write: writeSent, repairs, rewrites, caught },
    dropped: [...run.errors, ...(latest.skipped || []).filter((s) => !ids.includes(s.id)).map((s) => `${s.id}: ${s.reason}`)],
    seconds: (Date.now() - t0) / 1000,
  };
}
