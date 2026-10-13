---
doc: prd
status: approved
---

# Anywrap — Product Requirements

A web app for people who have downloaded their own data but can't read it. They drop one export file and get a year-in-review story, where every number is computed by code and backed by a receipt.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

> Approval: Gregory delegated product decisions to his agent for this project (13 Oct: "full autonomy, ask me as little as possible"). The agent made the choices below, and they are labeled as such under **Product Decisions**. Gregory can reopen any of them.

## The Core Journey
Develops `scope.md > The Core Loop`.
1. **Arrive.** The home screen says what Anywrap does in one line, shows a large drop zone, offers 5 sample files, and states what leaves the browser.
2. **Drop a file**, or click a sample. Anywrap reads it locally and shows the file name, size and the number of rows and columns it found.
3. **Watch it work** (about 20 seconds). Each step appears as it completes:
   - "Read 777 rows, 7 columns" (in the browser);
   - "This looks like **a bank account export**. One row = one transaction." (the AI's guess, from the summary only);
   - "Computing 8 stats on all 777 rows" (in the browser);
   - "Writing your story" (the AI writes captions from the results).
4. **Play the story.** An opener card ("Your 2025 money year"), then 6 to 8 stat cards, then a closing card. The user moves with click/tap or arrow keys; a segmented progress bar shows the position.
5. **Check a number.** On any stat card, "Receipt" flips the card over to a paper receipt: what was computed, on which columns, with which filters, over how many rows, plus the underlying table (e.g. all 12 months).
6. **See what the AI saw.** From the closing card (or the header), a panel shows the exact summary sent to the AI and the plan it sent back, with their size next to the file's size.
7. **Keep it.** "Download card" saves the current card as a 1080×1920 PNG; "Wrap another file" goes back home.

Success: the user flips through a story about their own data, trusts a surprising number after reading its receipt, and downloads a card.

## Screens and Layout
Three screens in one page, plus two overlays. No navigation bar.
- **Home**: headline and one-line promise; drop zone (click to browse); a row of sample chips; a three-step "How it works" strip (Your browser reads the file → The AI picks the story from a summary → Your browser computes every number); a privacy line.
- **Working**: centered column with the file card and the step list; the AI's guess animates in when it arrives; "Cancel" link.
- **Story**: one portrait card (9:16) centered on a dark stage, sized to the window height; progress segments above; previous/next zones on the card's left and right; buttons under the card: Receipt, Download card, What the AI saw, Wrap another file.
- **Receipt** (overlay on the card): the card flips over to show its back.
- **What the AI saw** (side panel): two code blocks, "Sent to the AI" and "Plan it sent back", with sizes.

## Look and Feel
Carried from `scope.md > Inspiration & Identity`. Chosen by the agent under delegation.
- **Two materials.** Front of cards: loud poster style, with saturated duotone backgrounds, huge numbers and big confident type. Back of cards: a quiet paper receipt (off-white paper, monospace, dashed rules, a jagged bottom edge).
- **Type**: one characterful variable grotesque for headings and numbers (heavy weights, tight tracking), the same family for body; a monospace for receipts and the "What the AI saw" panel.
- **Color**: dark near-black stage. Each story gets one of 5 named palettes (warm, ink, sea, neon, dusk) chosen by the AI to fit the data; cards cycle through the palette's 3–4 color pairs. Never Spotify's green-on-black, logo, name in the UI, or its fonts.
- **Motion**: card transitions slide and scale quickly (about 300 ms); the hero number counts up once; the receipt flips in 3D. Everything respects `prefers-reduced-motion`.
- **Copy tone**: second person, warm, a little cheeky, never judgmental about money, health or habits.
- **Avoid**: generic AI-app styling (purple gradients, glassmorphism cards, emoji headers), and clip-art icons.

## Features and Behavior

### Reading the file
- Accepts `.csv`, `.tsv`, `.txt` (delimited) and `.json` / `.jsonl`, up to 50 MB.
- Finds the separator (comma, semicolon, tab, pipe), skips preamble lines before the header, handles quoted fields with line breaks, BOMs and Excel-style `="…"` values.
- For JSON, finds the largest list of records, even nested, and flattens nested fields (`subtitles.name`).
- Builds the **summary**: for each column, detected type (number with decimal style, date with day/month order, clock time, yes/no, text), fill rate, number of distinct values, range, frequent values, 3 examples; plus 5 sample rows. Long values are cut to 60 characters.
- [ ] A 777-row bank CSV shows "777 rows, 7 columns" before any AI call.
- [ ] The French sleep diary is read with `;`, decimal commas and day/month dates.
- [ ] The nested watch-history JSON yields a `subtitles.name` column.

### Understanding the file (AI, step 1)
- The AI receives only the summary and returns a **plan**:
  - its guess (source, what one row means, subject, confidence);
  - the period, usually the latest calendar year with good coverage;
  - column types and units;
  - exclusions (ads, wish-list items, removed videos…);
  - optional cleaned label columns (e.g. merchant names without store numbers);
  - 6 to 8 cards, each one calculation from the fixed menu;
  - a palette.
- The plan's format is enforced; unknown calculations or columns are impossible or reported.
- If the engine reports errors (unknown column, no rows left), the errors and the row counts are sent back once for a corrected plan.
- [ ] All 5 sample files are recognized correctly (source and row meaning).
- [ ] The guess is shown on the Working screen before the story is ready.

### Computing every number (browser)
- The menu: total, average (mean/median; clock times averaged across midnight), record, top, distinct count, timeline by month/weekday/hour, busiest day, streak, share, comparison between groups, first and last.
- Runs on every row of the file, in the browser, with the plan's filters and period.
- Each result carries its facts (formatted values), an optional data series for its chart, and a plain-language receipt.
- [ ] Numbers match an independent recalculation for each sample file (automated test).

### Writing the story (AI, step 2)
- The AI receives the computed facts only. It returns opener, card captions (kicker, hero value, line, optional sub-line), a closing persona, and the cards it chose to skip with reasons (dull, wrong-looking or embarrassing).
- **Number checker**: every number in a caption must appear in that card's facts. Spelled-out numbers and arithmetic words (twice, double, half…) are rejected. The hero value must be one of the card's facts.
- On a failure, the writer gets one retry with the list of problems. A caption that still fails is replaced with a plain template caption built from the facts, and its receipt says so.
- [ ] No caption on the 5 samples contains a number absent from its facts (automated test over the real AI output).

### The story
- Opener card (title + line + file name and period), 6–8 stat cards, closing card (persona name, one line, the three most striking values, row count).
- Each stat card shows a chart matched to its calculation:
  - **timeline**: bars, peak highlighted;
  - **top**: ranked list with bars;
  - **streak**: a month calendar with the streak highlighted;
  - **share**: a ring;
  - **comparison**: two or more bars;
  - **record and total**: the hero number alone, with the record's label.
- Click right/left half, arrow keys or space to move; Escape closes overlays.
- [ ] Every stat card has a visible chart or a deliberate hero-only layout, and no text overflows at 1280×720 or 390×844.

### Receipts
- The back of each stat card shows:
  - the calculation in plain words;
  - columns used;
  - period;
  - exclusions with how many rows each removed;
  - card filters;
  - rows used;
  - the data table behind the chart (up to 24 lines);
  - "Caption checked: every number found in the results" (or "Template caption").
- [ ] The coffee comparison receipt on the sleep sample shows 266 nights, the two group means and the "A difference, not a cause" note.

### What the AI saw
- Shows the exact JSON summary sent and the plan returned, with their sizes and the file size ("2.3 KB sent · file 55 KB").
- [ ] The panel's "sent" text is byte-for-byte what the server forwarded (same function builds both).

### Download card
- Renders the current card (front) to a 1080×1920 PNG with a small footer: "Anywrap · computed from 777 rows of transactions_export.csv".
- [ ] The downloaded PNG opens and matches the card on screen.

### Samples
- 5 fabricated files, labeled "Sample data, made up": running log (Strava-style), bank account (US), YouTube watch history (Takeout-style JSON), reading list (Goodreads-style), sleep diary (French, unknown app).

## States and Boundaries
- **First use / no key**: if the local server has no API key, the home screen shows a banner explaining how to add one; drop and samples are disabled.
- **Unsupported or unreadable file** (binary, PDF, image, >50 MB, empty): an inline message on Home saying what Anywrap accepts; nothing is sent.
- **Too little to tell** (fewer than 10 rows, or no number, date or repeated text column): message on Home, nothing is sent.
- **AI unreachable or slow** (error, or no answer after 60 s): Working screen shows the error and "Try again".
- **Partial plan**: cards whose calculation still fails after repair are dropped; with fewer than 3 cards left, show "Anywrap couldn't find a story in this file" with the reason.
- **No dates**: the period is "all rows" and the AI simply doesn't pick time-based cards.
- **Privacy boundary**: the file never leaves the browser. Only the summary goes to the local server, which forwards it to the AI provider. Nothing is stored or logged on disk.

## Product Decisions
All made by the agent under Gregory's delegation (13 Oct), unless noted.
- **Name: Anywrap**: says "a Wrapped for anything" without using Spotify's word in the product name; "Unwrap" is already an AI company.
- **The idea and the universal angle**: Gregory's idea; he approved the universal-export angle and the "no invented numbers" design after the spike.
- **Manual navigation, no auto-advance**: people stop to read and to open receipts; auto-advance would fight that.
- **Receipts on the back of the card**: the trust feature stays one click away without cluttering the poster.
- **English captions for every file**: the judges and the video are in English; captions in the file's language are deferred.
- **The AI picks the period and the palette**: no settings screen; fewer decisions for the user.
- **Show the AI's guess before the story**: it is the most impressive moment and it builds trust.

## What We're Building
Everything under **Features and Behavior** and **States and Boundaries**, for one file at a time, running locally.

## Deferred From the POC
- Several files or a whole Takeout ZIP, because it needs file grouping and merging.
- Choosing another year, or comparing two years: it needs a settings UI and a second plan.
- Captions in the file's language: the number checker and the fallbacks must be multilingual first.
- Video export and share links: share links need hosting and storage, which the privacy promise rules out for now.
- Public hosting with a bring-your-own key: key handling and abuse limits.

## Possible Later Enhancements
- A gallery of ready-made recipes for popular exports, learned from successful plans.
- Year-over-year cards ("you ran 40% more than in 2024").

## Non-Goals
- Not a data-analysis tool: no free-form questions, no spreadsheet view.
- No accounts, no saved history.
- Does not judge habits (spending, sleep, screen time).
- Does not claim causes: comparisons are labeled "a difference, not a cause".

## Open Questions
- None blocking `4-spec`.
