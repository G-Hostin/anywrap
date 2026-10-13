// Runs the full pipeline on every sample against the real AI, through the same server code the app uses.
// Prints the guess, every caption with its receipt, and the checker's verdict. Exit code 1 on any failure.
// Usage: npm run check:live [-- sample-name ...]
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
if (existsSync(new URL(".env", ROOT))) process.loadEnvFile(new URL(".env", ROOT).pathname);
const ai = await import("../server/gemini.ts");
const { makeStory } = await import("../src/pipeline.ts");
const { checkCopy } = await import("../src/engine/check.ts");
type Api = import("../src/pipeline.ts").Api;

const api: Api = {
  async plan(body) { const r = await ai.plan(body); return { plan: r.json as never, sent: ai.planUserMessage(body), seconds: r.seconds }; },
  async write(body) { const r = await ai.write(body); return { copy: r.json as never, sent: ai.writeUserMessage(body), seconds: r.seconds }; },
};

const EXPECT: Record<string, RegExp> = {
  "running-log.csv": /strava|run|fitness|activit|workout|training/i,
  "bank-account.csv": /bank|checking|account|transaction/i,
  "watch-history.json": /youtube|watch|takeout|google/i,
  "reading-list.csv": /goodreads|book|reading|librar/i,
  "sleep-diary.csv": /sleep|sommeil/i,
};
const files = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(EXPECT);
let failed = 0;
mkdirSync(new URL("scripts/.live/", ROOT), { recursive: true });

for (const f of files) {
  const name = f.endsWith(".csv") || f.endsWith(".json") ? f : Object.keys(EXPECT).find((k) => k.startsWith(f))!;
  const text = readFileSync(new URL(`public/samples/${name}`, ROOT), "utf8");
  const t0 = Date.now();
  try {
    const story = await makeStory({ name, text, bytes: Buffer.byteLength(text) }, api);
    const results = story.cards.map((c) => c.result);
    const final = checkCopy({ opener: story.opener, persona: story.persona, slides: story.cards.map((c) => c.caption), skipped: [] }, results, [story.period, String(story.rowsInPeriod)], [story.period]);
    const guessOk = EXPECT[name]?.test(`${story.plan.dataset.source} ${story.plan.dataset.row_means}`) ?? true;
    const ok = guessOk && final.length === 0 && story.cards.length >= 6;
    if (!ok) failed++;
    console.log(`\n${ok ? "PASS" : "FAIL"}  ${name}  ${((Date.now() - t0) / 1000).toFixed(1)} s  ·  repairs ${story.sent.repairs}  ·  rewrites ${story.sent.rewrites}  ·  sent ${story.sent.plan.length} chars for a ${text.length} char file`);
    console.log(`  guess: ${story.plan.dataset.source} | ${story.plan.dataset.row_means} (${story.plan.dataset.confidence})${guessOk ? "" : "  <-- unexpected"}`);
    console.log(`  period: ${story.period} · ${story.rowsInPeriod} rows · palette ${story.plan.palette}`);
    console.log(`  OPENER: ${story.opener.title} | ${story.opener.line}`);
    for (const c of story.cards) {
      console.log(`  [${c.checked === "ai" ? "ai" : "TEMPLATE"}] ${c.caption.kicker} · ${c.caption.big} · ${c.caption.line} ${c.caption.sub}`);
      console.log(`      ${c.result.receipt.calc} · ${c.result.receipt.rows} rows${c.result.receipt.filters.length ? " · only " + c.result.receipt.filters.join(" and ") : ""}`);
    }
    console.log(`  PERSONA: ${story.persona.name} | ${story.persona.why}`);
    if (story.sent.caught.length) console.log(`  caught on first pass: ${story.sent.caught.map((p) => `${p.id}.${p.field} «${p.text}» ${p.issue}`).join(" | ")}`);
    if (story.dropped.length) console.log(`  dropped: ${story.dropped.join(" | ")}`);
    if (final.length) console.log(`  CHECKER: ${final.map((p) => `${p.id}.${p.field}: ${p.issue}`).join(" | ")}`);
    if (story.cards.length < 6) console.log(`  only ${story.cards.length} cards`);
    writeFileSync(new URL(`scripts/.live/${name}.json`, ROOT), JSON.stringify(story, null, 2));
  } catch (e) {
    failed++;
    console.log(`\nFAIL  ${name}: ${(e as Error).message}`);
  }
}
console.log(`\n${files.length - failed}/${files.length} passed`);
process.exit(failed ? 1 : 0);
