// Turns the stories saved by `npm run check:live` (real Gemini runs, scripts/.live/) into the recorded AI answers
// the web build replays for the samples: the plan and the captions only. Everything else is recomputed in the browser.
// Usage: npm run record [-- YYYY-MM-DD]   (runs with TZ=Europe/Paris, the zone check:live computes in)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import type { Story } from "../src/engine/types.ts";
import type { Recorded } from "../src/web/api.ts";

const LIVE = new URL("./.live/", import.meta.url);
const OUT = new URL("../src/web/recorded/", import.meta.url);
const day = process.argv[2] || new Date().toISOString().slice(0, 10);
mkdirSync(OUT, { recursive: true });

for (const f of readdirSync(LIVE).filter((n) => n.endsWith(".json"))) {
  const story = JSON.parse(readFileSync(new URL(f, LIVE), "utf8")) as Story & { model?: string };
  const slideIds = new Set(story.plan.slides.map((s) => s.id));
  // cards the writer chose to leave out come back as "id: reason" in story.dropped
  const skipped = story.dropped
    .map((d) => d.match(/^([^:]+): (.*)$/))
    .filter((m): m is RegExpMatchArray => !!m && slideIds.has(m[1]) && !story.cards.some((c) => c.result.id === m[1]))
    .map((m) => ({ id: m[1], reason: m[2] }));
  const rec: Recorded = {
    sample: story.file.name,
    model: story.model || "gemini-3.5-flash-lite",
    recordedAt: day,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    plan: story.plan,
    copy: { opener: story.opener, slides: story.cards.map((c) => c.caption), persona: story.persona, skipped },
  };
  writeFileSync(new URL(f, OUT), JSON.stringify(rec, null, 1) + "\n");
  console.log(`${f}: ${rec.copy.slides.length} captions, ${skipped.length} skipped`);
}
