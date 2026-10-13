---
doc: spec
status: approved
---

# Anywrap — Technical Spec

> Approval: technical choices made by the agent under Gregory's delegation (13 Oct, "full autonomy"), grounded in the feasibility spike of 13 Oct (5 fabricated exports, 2 models, every number re-checked independently). Gregory can reopen any of them.

## How This Works, In Plain Language
Anywrap has three pieces.

1. **The page in your browser** does the heavy work on your file.
   - It reads the file and turns it into a table.
   - It writes a short summary: column names, what kind of values each column holds, ranges, a few examples.
   - Later it runs the calculations on every row and draws the story.
   - The file itself never leaves the page.
2. **A tiny local server** keeps the API key out of the browser and forwards two kinds of requests to the AI:
   - "here is a summary, plan a story";
   - "here are the computed results, write the captions".

   The prompts live on the server, so the page can't make it ask anything else. It refuses any request over 64 KB, so a whole file can't be sent even by mistake.
3. **The AI (Claude)** is used twice:
   - as a planner: it reads the summary, says what the file is, and picks calculations from a fixed menu;
   - as a writer: it turns computed results into short captions.

   Both answers must match a strict format (JSON schema) enforced by the API.

Between the two AI calls, the browser computes everything. After the writer answers, a checker compares every number in the captions with the computed results and rejects any number that isn't there.

Why this shape: the alternative is letting the AI write and run code on the data (what Yirgachefe does) or sending the whole file to a chatbot. Both make numbers impossible to trace. Here every number has one source, a named calculation, and that source is printed on the card's receipt.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.
1. The user drops `transactions_export.csv` on **Home**.
   - `engine/read.ts` detects the separator and finds the header: 777 rows, 7 columns.
   - `engine/summary.ts` builds the summary (about 2 KB).
   - The **Working** screen prints "Read 777 rows, 7 columns".
2. `pipeline.ts` POSTs the summary to `/api/plan`. The server adds the planner prompt and the plan schema, and calls the Anthropic Messages API. The plan comes back: guess, period 2025, amount × −1 in USD, a "Merchant" label cleaned by a regular expression, 8 cards, palette.
   - **Working** prints the guess: "a bank account export · one row = one transaction".
3. `engine/run.ts` runs the plan on all 777 rows and returns one result per card: facts, chart series and receipt. If a card errors (unknown column, no rows left), `pipeline.ts` sends the errors and row counts back once to `/api/plan` for a repair, then reruns.
4. `pipeline.ts` POSTs the facts (not the rows) to `/api/write` and gets the captions.
   - `engine/check.ts` checks every caption. If anything fails, it asks once more with the list of problems; whatever still fails gets a template caption.
5. **Story** shows the cards (`ui/Card.tsx` and `ui/charts.tsx`). "Receipt" flips a card to `ui/Receipt.tsx`, "What the AI saw" opens `ui/AiSaw.tsx` with the exact strings sent, and "Download card" renders the card to a PNG with `html-to-image`.

## Stack
- **TypeScript** everywhere. The engine is plain TypeScript with no dependencies, shared by the browser (through Vite), the tests and the scripts (through Node's built-in type stripping, so no build step on the Node side). Use only erasable syntax (no enums, no parameter properties) and import with `.ts` extensions.
- **React 19** + **Vite 8** (`@vitejs/plugin-react`) for the page: three screens and lots of small stateful pieces (story position, flipped card, overlays). Docs: https://react.dev, https://vite.dev/guide/.
- **Node 26 `node:http`** for the server: three routes, no framework. Vite runs inside it as middleware in dev (`--dev`); the built `dist/` is served otherwise. Docs: https://nodejs.org/api/http.html, https://vite.dev/guide/ssr#setting-up-the-dev-server (middleware mode), https://nodejs.org/api/typescript.html.
- **html-to-image** (MIT) for the share PNG: renders a DOM node with its web fonts. https://github.com/bubkoo/html-to-image.
- **Fonts** (OFL, self-hosted with Fontsource, no CDN): Bricolage Grotesque Variable (weight, width and optical-size axes) for everything on the posters and the app; JetBrains Mono Variable for receipts and the "What the AI saw" panel. https://fontsource.org.
- **Charts**: hand-written SVG (bars, ranked list, year heat-map, ring). A chart library would bring its own look and weight for five simple shapes.
- **Anthropic Messages API**, model `claude-sonnet-5-5` (overridable with `ANTHROPIC_MODEL`), with structured outputs (`output_config.format` = `json_schema`). https://docs.claude.com/en/docs/build-with-claude/structured-outputs. Checked on 13 Oct with both `claude-sonnet-5-5` and `claude-haiku-5-5`. In the spike, Sonnet needed 0 repairs on 5 files, against 2 for Haiku.
- **Tests**: Node's built-in test runner (`node --test`), no extra framework.

## Where It Runs and How Someone Tries It
- Requirements: Node 26 or later, an Anthropic API key.
- Setup:
  ```
  npm install
  cp .env.example .env    # then paste your key into .env
  npm run dev             # http://localhost:5173
  ```
  `npm run build && npm start` serves the production build on the same port.
- Pitfall on this machine: the shell exports `NODE_ENV=production`, which makes `npm install` skip devDependencies. Install with `NODE_ENV=development npm install`. The server never reads `NODE_ENV`; dev mode is the explicit `--dev` flag.
- Demo recording: `npm start`, browser window at 1280×720 or larger, the three demo samples (running log, bank account, sleep diary).
- Deployment: none for the PoC (the video and the public repository are what the rules require). A public deployment would expose the key or need a bring-your-own-key flow; deferred in the PRD.

## Look and Feel
From `prd.md > Look and Feel`.
- **Stage**: the app background is a deep blue-black ink `#0E0B2A`; the story stage takes the darkest color of the story's palette.
- **Posters**: duotone pairs, about 3–4 per palette:
  - **ember**: `#FF5B1F`/`#2B0B00`, `#FFD23F`/`#3A1600`, `#B5123C`/`#FFE2D4`, `#2B0B00`/`#FF8A5C`;
  - **ink**: `#2340FF`/`#EAF0FF`, `#0B103F`/`#9DB3FF`, `#C9D6FF`/`#0B103F`, `#EAF0FF`/`#2340FF`;
  - **tide**: `#00A396`/`#F0FFF9`, `#07343A`/`#7FF5DE`, `#BFF5E8`/`#07343A`, `#F0FFF9`/`#00756C`;
  - **neon**: `#E8FF3A`/`#1C1F00`, `#2A0F5C`/`#E8FF3A`, `#FF4FD8`/`#1C0016`, `#1C1F00`/`#E8FF3A`;
  - **dusk**: `#6B2BD9`/`#FFE7F5`, `#FF7AB8`/`#2B0638`, `#2B0638`/`#FFB86B`, `#FFB86B`/`#2B0638`.
- **Type on the posters**: Bricolage Grotesque.
  - Hero number: weight 800, width 75 (condensed), optical size 96, 26–34% of the card width, tight tracking, line height 0.85.
  - Kicker: weight 600, normal width, sentence case (no all-caps labels).
  - Caption: weight 500, 1.25 line height.
- **Receipts**: paper `#F6F3EC` with `#1D1A16` ink, JetBrains Mono at 12.5–13 px, dashed rules, label/value rows with dot leaders, and a jagged bottom edge in CSS (`mask` with a repeating triangle gradient).
- **App type**: Bricolage Grotesque everywhere; the Home headline is set huge and condensed, as the page's one bold element.
- **Home layout**:
  - left: headline, one-line promise, the drop zone drawn as a receipt slip ("Drop an export here", accepted formats printed as receipt lines), sample chips;
  - right: three sample poster cards fanned out, slightly rotated;
  - below: the three-step "How it works" strip, a real sequence, so it is numbered.
- **Working**: the receipt slip prints line by line (each step appends a line with a dot leader and "done"); the guess arrives as a bigger printed line.
- **Motion**: card change = translateX plus scale, 280 ms ease-out; the hero number counts up over 700 ms on first view; the receipt flip is a 3D rotateY, 450 ms; receipt lines print with a 120 ms stagger. With `prefers-reduced-motion`: no count-up, no flip (cross-fade), no print stagger.
- **Copy**: sentence case, second person, plain verbs. Buttons say what they do ("Download card", "Wrap another file").
- **Avoid**: Spotify's green, logo, name in the UI, or its fonts; purple-gradient AI styling; emoji; a `→` after every link.

## Components

### File reader — `src/engine/read.ts`
- Detects the separator from the header line (comma, semicolon, tab, pipe; quotes respected).
- Parses CSV with quoted multi-line fields; picks as header the first row whose width matches the most common width (skips bank preambles); dedupes header names ("Distance (2)"); strips BOM and `="…"`.
- For JSON or JSON Lines, finds the largest array of records (depth ≤ 4) and flattens nested objects and first array elements with dotted keys.
- Rejects empty, binary (NUL bytes in the first 4 KB), files over 50 MB, and tables under 10 rows, each with a message.
- PRD ref: `prd.md > Reading the file`, `prd.md > States and Boundaries`.

### Value parsers — `src/engine/parse.ts`
- Numbers with `.` or `,` decimals, thousands separators, currency signs and codes, parentheses negatives.
- Dates: ISO with time zones; DMY/MDY with an explicit order; "Nov 1, 2024, 10:02:51 AM"; French and English month names; Unix seconds and milliseconds.
- Clock times; durations ("1:23:45", or a number with a unit); yes/no values in several languages.
- PRD ref: `prd.md > Reading the file`.

### Summary builder — `src/engine/summary.ts`
For each column:
- the type, detected on a sample of up to 400 values (80% must parse);
- for numbers, the decimal style and range;
- for dates, the day/month order (the order that parses more values wins), the range and rows per year;
- the fill rate, number of distinct values, 3 examples, top values for repeated text and average length.

Plus 5 sample rows (first, second, a third of the way, two thirds of the way, last). Values are cut to 50–60 characters. The output is the exact object sent to the AI.
PRD ref: `prd.md > Reading the file`, `prd.md > What the AI saw`.

### Plan runner — `src/engine/run.ts`
Executes a plan in this order: derived label columns, typed columns (cached), exclusions (counting the rows each one removes), period, then each card's own filters and its calculation from the menu. The menu: total, average, record, top, distinct, timeline, peak day, streak, share, compare, first and last.

Each result carries:
- `facts`: formatted strings, the only numbers the writer may use;
- `series`: data for the chart and the receipt table;
- `receipt`: calculation in words, columns, period, exclusions with their counts, filters and rows used.

Errors are collected per card, never thrown.
PRD ref: `prd.md > Computing every number`, `prd.md > Receipts`.

### Plan normalizer — `src/engine/plan.ts`
The API can only enforce small schemas (it rejects large ones with "compiled grammar is too large"), so the plan schema has no optional properties and no union types: every property is required, and "not used" is written as `""`, `[]` or `0`. This module turns that answer back into a clean `Plan`, dropping empty values and splitting a filter's `value`/`values` by operator.
PRD ref: `prd.md > Understanding the file (AI, step 1)`.

### Formatting — `src/engine/format.ts`
- Currency for 3-letter codes; km/m/mi with smart units; durations ("180 hours", "1 h 45 min"); clock times ("11:43 PM"); "/5"-style scores; counts with thousands separators.
- Dates as "Sat, Aug 30"; weekday and month names in English.
- PRD ref: `prd.md > Computing every number`.

### Number checker — `src/engine/check.ts`
- Extracts numeric tokens from every caption field and compares them, after removing thousands separators, with the numeric tokens of that card's facts. Opener and persona may use any card's facts, the period label and the row count.
- Rejects spelled-out numbers (two to twenty, tens, hundred, thousand, million, dozen) and arithmetic words (twice, double, triple, half, quarter). The hero value must equal one of the card's facts.
- Builds template captions per calculation when a caption still fails after the retry.
- PRD ref: `prd.md > Writing the story (AI, step 2)`.

### Pipeline — `src/pipeline.ts`
- Orchestrates: read, summary, plan (with the repair call when needed), run, write (with the retry when needed), check, assembled story.
- Reports progress steps to **Working** through a callback.
- Keeps the exact request bodies for **What the AI saw**.
- Drops cards that still fail; fewer than 3 usable cards is a "no story" error.
- PRD ref: `prd.md > The Core Journey`.

### Local server — `server/index.ts`, `server/anthropic.ts`, `server/prompts.ts`
- `GET /api/health` returns `{ hasKey, model }`.
- `POST /api/plan` takes `{ summary, repair? }`; `POST /api/write` takes `{ facts, problems? }`.
- Bodies over 64 KB get a 413. Each call has a 60 s timeout. Errors are returned as `{ error }` without upstream headers. The key is loaded from `.env` (`process.loadEnvFile`) and never logged.
- The prompts and JSON schemas are fixed in `prompts.ts`.
- In `--dev`, Vite runs as middleware; otherwise `dist/` is served with correct MIME types.
- PRD ref: `prd.md > Understanding the file (AI, step 1)`, `prd.md > States and Boundaries`.

### Screens — `src/App.tsx`, `src/ui/Home.tsx`, `src/ui/Working.tsx`, `src/ui/Story.tsx`
- `App` holds the screen state (home, working with progress, story, error) and the story.
- `Home`: drop zone (drag and drop plus click to browse), sample chips (fetched from `/samples/`), the no-key banner, inline file errors.
- `Working`: the printing receipt and a cancel link (AbortController).
- `Story`: the card stage, progress segments, keyboard and click navigation, and the action buttons.
- PRD ref: `prd.md > Screens and Layout`, `prd.md > The story`, `prd.md > Samples`.

### Card, charts, receipt — `src/ui/Card.tsx`, `src/ui/charts.tsx`, `src/ui/Receipt.tsx`, `src/ui/palettes.ts`
- Opener, stat and closing layouts. Chart per calculation:
  - timeline: bars with the peak highlighted;
  - top: ranked bars;
  - streak: a month calendar with the streak highlighted (1–2 big months with day numbers for short streaks, 12 small months for long ones);
  - share: ring;
  - compare: bars;
  - record, total, average, distinct and first/last: hero-only.
- The receipt is the card's back face.
- PRD ref: `prd.md > The story`, `prd.md > Receipts`, `prd.md > Look and Feel`.

### What the AI saw — `src/ui/AiSaw.tsx`
Side panel showing the exact strings sent to `/api/plan` and `/api/write` and the plan received, with byte sizes and the file size.
PRD ref: `prd.md > What the AI saw`.

### Share image — inside `src/ui/Story.tsx`
`html-to-image` `toPng` on the front face, with a `pixelRatio` that yields 1080×1920, plus a temporary footer line.
PRD ref: `prd.md > Download card`.

### Sample files — `scripts/make-samples.ts`, `public/samples/`
Five fabricated exports with a fixed random seed, copied from the spike and corrected (real original publication years for the public-domain books, Paris-local times for the watch history).
PRD ref: `prd.md > Samples`.

## Data Model
Nothing persists: no storage, no cookies. State lives in React memory for one file at a time.
- `Table`: `{ name, format, note, columns: string[], rows: string[][] }`.
- `Summary`: `{ file, format, note, row_count, columns: ColumnProfile[], sample_rows }`.
- `Plan`: `{ dataset, period, derive[], fields[], exclude[], slides[], palette }`, the schema enforced by the API.
- `Result`: `{ id, op, angle, facts: Record<string,string>, series?, receipt }`.
- `Copy`: `{ opener, slides[], persona, skipped[] }`.
- `Story`: `{ file, rowsTotal, plan, results, cards: { result, caption, checked: 'ai' | 'template' }[], opener, persona, palette, sent: { plan: string, write: string }, timings }`.

Leaving the page or pressing "Wrap another file" drops everything.

## File Structure
```
projet/
├── index.html                 # Vite entry
├── package.json               # scripts: dev, build, start, test, typecheck, samples, check:live
├── tsconfig.json              # strict, noEmit, allowImportingTsExtensions
├── vite.config.ts
├── .env.example               # ANTHROPIC_API_KEY=, ANTHROPIC_MODEL=
├── LICENSE                    # MIT
├── README.md                  # what it is, run instructions, how the kernel works
├── server/
│   ├── index.ts               # node:http server, routes, static or Vite middleware
│   ├── anthropic.ts           # Messages API call with schema, timeout, clean errors
│   └── prompts.ts             # planner and writer prompts, JSON schemas
├── src/
│   ├── main.tsx
│   ├── App.tsx                # screen state machine
│   ├── pipeline.ts            # file → story orchestration
│   ├── styles.css
│   ├── engine/
│   │   ├── types.ts
│   │   ├── read.ts            # CSV / JSON → Table
│   │   ├── parse.ts           # numbers, dates, clock times, durations, booleans
│   │   ├── summary.ts         # what the AI sees
│   │   ├── plan.ts            # AI's flat plan → clean Plan
│   │   ├── run.ts             # plan → results with receipts
│   │   ├── format.ts          # human-readable values
│   │   └── check.ts           # number checker + template captions
│   └── ui/
│       ├── Home.tsx
│       ├── Working.tsx
│       ├── Story.tsx
│       ├── Card.tsx
│       ├── Receipt.tsx
│       ├── charts.tsx
│       ├── AiSaw.tsx
│       └── palettes.ts
├── public/samples/            # 5 fabricated exports (generated)
├── scripts/
│   ├── make-samples.ts        # regenerates public/samples
│   └── check-live.ts          # full pipeline on every sample against the real API
├── tests/
│   ├── engine.test.ts         # reader + runner vs independently computed numbers
│   └── check.test.ts          # number checker cases
└── devpost/                   # scope, PRD, spec, checklist, app map
```

## External Services and Dependencies
**Anthropic Messages API**: `POST https://api.anthropic.com/v1/messages`.
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`.
- Body: `{ model, max_tokens, system, messages: [{ role: "user", content }], output_config: { format: { type: "json_schema", schema } } }`.
- Response: the text block holds the JSON matching the schema.
- Schema limits: objects need `additionalProperties: false`; no numeric or length constraints; required properties come first. The compiled grammar has a size limit: the first plan schema (optional fields, `anyOf` unions) was rejected, and the flat all-required version works (see `Plan normalizer`).
- Cost: about 5k input and 3k output tokens per story with Sonnet (spike measurement), a few cents.
- Key: the owner's existing Anthropic key, in `.env`, never committed.

**Fontsource packages and html-to-image**: bundled at build time; no network at runtime besides the API.

## Important Failure Modes
- **The AI plans a calculation that can't run** (wrong column, filter that removes everything) → one repair call with the error list and row counts; cards still failing are dropped; fewer than 3 cards → "Anywrap couldn't find a story in this file", with the reasons.
- **A caption contains a number not in the results** → one retry with the problems; then a template caption marked "Template caption" on the receipt.
- **Odd file** (unknown date order, decimal comma, nested JSON) → the summary shows the detected types and the AI can override units, scale, order and decimal style in `fields`. If the reader finds no usable table → message on Home, nothing sent.
- **API down, no key, or slow** → banner on Home (no key) or error with "Try again" on Working (60 s timeout).

## What Was Simplified and Why
- **One file at a time** instead of whole Takeout archives: one file proves the kernel; archives mean unzipping and merging tables.
- **Local server** instead of hosting: the key stays private and the video shows everything; hosting needs a bring-your-own-key flow.
- **English captions only**: the number checker's word list and the template captions are English; multilingual comes later.
- **The AI picks the period** instead of a year picker: no settings UI in the PoC.

## Decisions and Open Issues
- **Fixed menu of calculations instead of AI-written code** (agent decision, core of the kernel). Tradeoff: some stories the AI could imagine can't be expressed. The spike showed the menu covers the 5 very different files.
- **Structured outputs for both AI calls** (agent decision): removes malformed-plan failures, like the `op: [object]` plan Haiku produced in the spike.
- **Sonnet over Haiku**: better plans and captions, about 22 s per story against 16–25 s.
- **Prompts on the server**: the page can't turn the server into a general proxy for the key.
- **Genuine uncertainty**: does the browser stay responsive on a 50 MB file? The spike files were all under 1.2 MB. To check during the build with a generated 30 MB file; if the page freezes, move reading and running to a Web Worker.
- Open: none blocking.
