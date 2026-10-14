// The web build replays recorded AI answers for the samples. Replaying them through the real pipeline
// (read, summarize, compute on every row, check) must rebuild the recorded story exactly, so the site
// shows what the live run showed, whatever the visitor's time zone. `npm test` runs it under three zones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { makeStory } from "../src/pipeline.ts";
import { replayApi, type Recorded } from "../src/web/api.ts";

const REC = new URL("../src/web/recorded/", import.meta.url);
const SAMPLES = new URL("../public/samples/", import.meta.url);

for (const f of readdirSync(REC).filter((n) => n.endsWith(".json"))) {
  test(`replay rebuilds the recorded story: ${f}`, async () => {
    const rec = JSON.parse(readFileSync(new URL(f, REC), "utf8")) as Recorded;
    const text = readFileSync(new URL(rec.sample, SAMPLES), "utf8");
    const story = await makeStory({ name: rec.sample, text, bytes: Buffer.byteLength(text) }, replayApi(rec, { plan: 0, write: 0 }), undefined, undefined, { timeZone: rec.timeZone });
    assert.equal(story.sent.rewrites, 0, "the recorded captions should pass the checker on the first try");
    assert.deepEqual(story.cards.map((c) => c.checked), story.cards.map(() => "ai"), "every card keeps the AI caption (no template fallback)");
    assert.deepEqual(story.cards.map((c) => c.caption), rec.copy.slides, "same cards, same captions, same order");
    assert.deepEqual(story.opener, rec.copy.opener);
    assert.deepEqual(story.persona, rec.copy.persona);
  });
}
