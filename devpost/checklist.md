---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast. Gregory delegated the build ("full autonomy, ask me as little as possible"). The agent verifies and commits every slice and runs its own visual reviews with screenshots. Gregory's hands-on review happens once, at the end.

## Slices

- [x] **1. Drop a sample and get a true story, card by card**
  Becomes usable: `npm run dev`, click a sample, see the AI's guess, then plain cards with captions and a text receipt under each. Every number is computed in the browser and checked.
  Why now: it is the kernel, end to end. Everything else is presentation around it. The spike proved the parts separately; this proves them wired together in the browser through the local server.
  PRD ref: `prd.md > The Core Journey` (steps 1–4), `prd.md > Reading the file`, `prd.md > Understanding the file (AI, step 1)`, `prd.md > Computing every number`, `prd.md > Writing the story (AI, step 2)`, `prd.md > Samples`
  Spec ref: `spec.md > File reader`, `spec.md > Value parsers`, `spec.md > Summary builder`, `spec.md > Plan runner`, `spec.md > Formatting`, `spec.md > Number checker`, `spec.md > Pipeline`, `spec.md > Local server`, `spec.md > Sample files`, `spec.md > File Structure`
  Build: Scaffold the project (Vite, React, TypeScript, Node server with Vite middleware). Port and harden the spike engine into `src/engine/`, with the bugs found in the spike fixed. Add prompts and JSON schemas on the server, the pipeline with repair and retry, the sample generator, and a minimal story view.
  Verify (mechanical): `npm test` passes: the reader and runner match numbers computed independently in the test for all 5 samples, and the checker cases pass. `npm run typecheck` is clean. `npm run check:live` on all 5 samples recognizes each file, reports 0 caption numbers outside the facts, and yields at least 6 cards per story. In the browser, a sample click produces cards.
  Learner check: Run `npm run dev`, click "Bank account", and read the cards: do the guess and the numbers make sense?
  Commit: `Drop a file and get a checked story`

- [x] **2. The story looks and moves like a year-in-review**
  Becomes usable: full-screen poster cards with the AI-chosen palette, hero number, kicker and caption, one chart per calculation, progress segments, click and keyboard navigation, opener and closing persona cards.
  Why now: the story player is what the video shows most; its layout constraints (long labels, big numbers) can force changes to captions and facts, so it should come before the secondary screens.
  PRD ref: `prd.md > The story`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Card, charts, receipt`, `spec.md > Look and Feel`
  Build: Card layouts (opener, stat, closing), palettes, SVG charts (bars, ranked list, year heat-map, ring, compare), navigation, count-up, reduced-motion handling.
  Verify (mechanical): `npm run build` succeeds. Browser screenshots of every card of 3 samples at 1280×720 and 390×844 show no overflow, which a DOM check confirms (no element wider than its card, no text clipped).
  Learner check: Play the running-log story with the arrow keys and say whether it feels like a Wrapped.
  Commit: `Play the story as poster cards`

- [x] **3. Every number shows its receipt, and you can see what the AI saw**
  Becomes usable: "Receipt" flips a card to its paper back (calculation, columns, exclusions with counts, filters, rows used, data table, caption check); "What the AI saw" opens the panel with the exact summary and plan, with sizes.
  Why now: this is the trust half of the kernel and the video's key beat; it relies on the card from slice 2.
  PRD ref: `prd.md > Receipts`, `prd.md > What the AI saw`
  Spec ref: `spec.md > Card, charts, receipt`, `spec.md > What the AI saw`
  Build: Receipt back face with flip and its reduced-motion fallback, the AI-saw side panel, Escape and focus handling.
  Verify (mechanical): On the sleep sample, the coffee comparison receipt shows 266 nights and both group means. The panel's "sent" text equals the request body the server logged in a dev-only test run (same string). Keyboard: Tab reaches Receipt, Enter flips, Escape closes.
  Learner check: Open the receipt of the most surprising card and say whether you would trust the number.
  Commit: `Show receipts and what the AI saw`

- [x] **4. Home, Working and every error state**
  Becomes usable: designed Home (headline, receipt-slip drop zone, sample chips, how-it-works strip, privacy line), the printing Working screen with the guess line and Cancel, and messages for no key, unsupported file, too little data, API errors and "no story".
  Why now: by now the story is final, so the first screens can promise exactly what it delivers. The error states also need the pipeline from slice 1 to produce them.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > States and Boundaries`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Screens`, `spec.md > Important Failure Modes`, `spec.md > Look and Feel`
  Build: Home and Working screens, drag-and-drop with click to browse, AbortController cancel, error rendering, no-key banner.
  Verify (mechanical): Screenshots of Home and Working at both sizes. Dropping a PNG, an empty CSV and a 5-row CSV shows the right message without any `/api` request (network log). Starting the server without a key shows the banner. A forced API error (bad model name) shows "Try again".
  Learner check: Drop one of your own exports (a CSV from any app) and see what happens.
  Commit: `Design home and working screens with error states`

- [x] **5. Download a card, handle big files, document the repo**
  Becomes usable: "Download card" saves a 1080×1920 PNG; a 30 MB file stays usable; the README explains the project and how to run it; the repository has an MIT license.
  Why now: polish and submission prerequisites, after the experience itself is complete.
  PRD ref: `prd.md > Download card`, `prd.md > Reading the file`
  Spec ref: `spec.md > Share image`, `spec.md > Decisions and Open Issues` (big-file uncertainty), `spec.md > Where It Runs and How Someone Tries It`
  Build: html-to-image export with the footer line; a timing test on a generated 30 MB CSV, with a Web Worker if the page freezes for more than 1 s; README, LICENSE and `.env.example`.
  Verify (mechanical): The downloaded PNG is 1080×1920 and its pixels match the card on screen in a visual check. Reading and summarizing the 30 MB file blocks the main thread for less than 1 s (worker) or the measured time is recorded. `npm run build && npm start` serves the app. The README commands run as written on a fresh clone.
  Learner check: Download the closing card of a story and open it on your phone.
  Commit: `Export share cards and document the project`

## Hands-on Checkpoints

- [ ] Final kick-the-tires exploration and feedback completed (Gregory, once, at the end; early feedback replaced by the agent's own screenshot reviews under the delegation)
  - Agent pre-check before handing over (13 Oct): live end-to-end in headless Chrome on the running-log sample.
    - Guess after 16 s, story after 27 s, 9 cards, 7/7 receipts complete.
    - Download works and "What the AI saw" shows 5.9 KB sent for a 40.7 KB file.
    - "Wrap another file" returns Home; no page errors.
  - `npm run check:live`: 5/5 again, with 0 repairs and 0 rewrites.

## Final Review

- [x] Final review complete — feedback resolved and learner confirms ready to ship
  - Gregory tried the app (13 Oct, evening): "really not bad, I like it, it's original", with one request: a little more design work. He gave the go-ahead to publish.
  - Design pass made in response, kept inside the existing scope:
    - the story plays like a deck: the neighbouring cards wait at the sides, the current card's colour lights the stage, and the controls sit together in one dock with a keyboard hint;
    - every card front is a ticket, with a perforated stub and two notches that echo the receipt on its back;
    - the Working screen is a small receipt printer feeding out the slip;
    - the home fan of example cards spreads out on hover, and the sample chips show their file format.
  - Copy fix found during that pass: the summary sent to the AI includes 5 example rows. The home slip, the receipt, "What the AI saw", the README and the app map now say so instead of "no rows".
  - Evidence: 47 cards captured at 1280×900 and 390×844 with no overflow, share PNGs still 1080×1920 without the notches, a live end-to-end run on the bank sample (guess after 8.5 s, story after 14.3 s, 7/7 receipts complete, no page errors), 18/18 tests and a clean build.

## Code Tour and App Map

- [ ] Learning wrap-up and `devpost/app-map.html` complete
  - `devpost/app-map.html` generated from commit `5e9c96e`. It has a flow diagram, a three-stop reference route (`makeStory` → `case "compare":` → `checkCopy`), "To change this, start here" pointers and a practice to reuse. Every path and search anchor was checked against the source. It renders offline with scripts disabled and makes no network requests.
  - Wrap-up activity: the app map is the take-home guide. No separate tour was run: Gregory delegated the build and asked to be consulted as little as possible. The route stays labeled as a reference, not as a completed tour.

## Revisions
- AI provider switched from Claude to Gemini's free tier (Gregory, 13 Oct, after the final review): he doesn't want his own Claude key behind the project. Only `server/gemini.ts` (renamed from `anthropic.ts`) talks to the provider; prompts, schemas, engine and checker are unchanged in role.
  - Model: `gemini-3.5-flash-lite` with `thinkingLevel: high`. With low thinking it misread the files (it called the sleep diary "sleep-diary.csv" and kept 4 cards). `gemini-3.8-flash`, `3.7-flash`, `3.6-flash` and `3.5-flash` answered 503 "high demand" or timed out that night.
  - Gemini needed a few guard rails that Claude didn't: the normalizer drops card filters that repeat the period, measures on ops that don't use one, and label columns that repeat the measure; seconds declared as plain numbers become durations. The writer must caption every card (a missing caption goes back for a rewrite like a wrong number), and the story keeps at least 6 cards. Prompts ask for plain group names, no causal wording on comparisons, no cards built on free-text notes. Tests: `tests/plan.test.ts`.
  - Evidence: `npm run check:live` 5/5 on Gemini (22–49 s per story, 0–1 repair, 0–1 rewrite; the checker caught "zero awakenings", a number written in words); a live end-to-end run in Chrome on the running log (guess after 14 s, story after 29 s, 7/7 receipts, no page errors); 47 cards captured at 1280×900 and 390×844 with no overflow.
- Slice 1: the API refused the first plan schema ("compiled grammar is too large"): optional properties and union types make the enforced grammar grow too fast. The plan schema now marks every property as required and uses "", [] or 0 for "not used"; the new `src/engine/plan.ts` turns that answer back into a clean plan. Filters carry `value` (text) plus `values` (list). Same behavior, same guarantees.
- Slice 1: the number checker now accepts the period label (e.g. "2025") on any card, not only on the opener and closing cards. The first live run had rejected "the books you finished in 2025".
- Slice 1 evidence:
  - `npm test`: 18 tests pass. They compare the engine with numbers recomputed independently on all 5 samples.
  - `npm run check:live`: 5/5 files recognized, 7–8 cards each, 0 template captions, 0 numbers outside the facts, 16–27 s per story. The summary sent is 2.2–6.8 KB, against 1.1 MB for the watch-history file.
  - Browser (headless Chrome): the bank sample ran end to end; only `/api/plan` and `/api/write` were called, with 2.2 KB and 1.9 KB bodies.
- Slice 2: the streak chart became a month calendar instead of a 53-week strip. The strip made a 5-day streak a few pixels wide; the calendar shows short streaks on 1–2 big months with day numbers, long ones on 12 small months. Spec `Card, charts, receipt` updated.
- Slice 2: comparison groups built from a yes/no column are labeled with the column name ("café après 16h: no"), not a bare "no".
- Slice 2: dev servers launched from a shell with `NODE_ENV=production` made Vite run the client in production mode. `--dev` now forces development mode.
- Slice 2: the writer prompt now asks for a stand-alone first caption line. The bank story had produced "visits to BEAN THERE CAFE…" after the hero number.
- Slice 2 evidence: 48 cards captured over 5 saved stories at 1280×900 and 390×844 (headless Chrome, `?replay=` dev mode). A DOM check (no element outside its card, no overlapping blocks) passes. The contact sheets were reviewed after one fix: a long text hero ("lofi beats to study to") had spilled over its chart, and hero text is now height-capped. `npm run build` passes.
- Slice 3: "What the AI saw" shows the JSON indented for reading. The sizes are those of the raw text actually sent, and the test compares the parsed JSON with the POSTed body (equal). PRD criterion reworded to match.
- Slice 3 evidence (live run of the sleep sample in headless Chrome, real API):
  - the coffee receipt shows 266 rows used, both group means (4/5 and 3.2/5) and "A difference, not a cause.";
  - keyboard: Receipt is reached by Tab, Enter flips, Escape flips back and returns focus to the button;
  - the panel's summary equals the summary POSTed to `/api/plan`: 2.3 KB for an 11.8 KB file;
  - Escape closes the panel, and the page reported no errors.
- Slice 4: file problems (binary, empty, too small, nothing to tell) go back to Home with the file name and the reason, and no AI call happens. AI or network problems stay on Working with "Try again" and "Choose another file". A missing key disables the drop zone and the samples, and shows how to add the key.
- Slice 4: the torn receipt edge was drawn upside down (teeth cut into the paper and a white band showed below). Fixed for the Home slip, the Working slip and the card receipts.
- Slice 4 evidence:
  - headless Chrome, Home at 1280×900 and 390×844: no horizontal overflow after clipping the fanned cards;
  - photo.png, empty.csv, tiny.csv (5 rows) and words.csv (no numbers, dates or repeats) each show the right message with zero `/api/plan` or `/api/write` requests;
  - the Working screen shows the AI's guess mid-run; Cancel returns Home and no story appears later;
  - a production build with no key shows the banner and disables 5/5 samples;
  - a production build with an invalid model shows "The AI provider answered with an error (404)…", and Try again retries.
- Slice 5: no Web Worker needed (the spec's open uncertainty). On a generated 30 MB bank CSV (388,376 rows), Node with the same engine reads it in 150 ms, summarizes it in 550 ms and runs 6 cards in 330 ms. In Chrome, from file drop to the AI request takes 609 ms, and the longest main-thread task is 530 ms.
- Slice 5: share images are drawn from an SVG snapshot of the card, scaled to 1080×1920 on a canvas, so text stays sharp. The export footer adds the file name ("Computed from 181 rows of running-log.csv").
- Slice 5 evidence:
  - downloaded stat card and closing card are 1080×1920 PNGs (143 KB and 200 KB), checked side by side with the on-screen cards (same fonts, colors, chart and layout);
  - a fresh copy of the tracked files (no `.env`) runs `npm install`, `npm run build`, `npm test` (18/18), `npm run typecheck` and `npm start` as the README says, and shows the no-key state as expected.
