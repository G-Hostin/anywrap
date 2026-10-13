---
doc: scope
status: approved
---

# Anywrap

Drop any personal data export (a running log, a bank CSV, a watch history, a sleep diary) and get a year-in-review story. The AI picks the story; code computes every number, and each one comes with a receipt.

> How this plan was made: the idea is Gregory's. His coding agent researched existing tools, ran a feasibility spike and drafted these documents. Gregory approved the direction and delegated the remaining product and technical choices to the agent ("full autonomy, ask me as little as possible"). He can reopen any of them.

## The Unique Kernel
**The AI never sees your whole file, and it never writes a number.**
- It reads a short summary of the file (column names, detected types, ranges, a few example values), works out what the export is, then picks the stats that would make a good story. It picks from a fixed menu of calculations: total, top 5, record, streak, busiest month, comparison…
- Your browser runs those calculations on every row. The AI then writes the captions from the computed results. A checker rejects any number that is not in those results.
- Every card has a **receipt**: which calculation, which columns, which filters, how many rows.

Other "Wrapped for any data" experiments let the AI write and run its own code on your data, and warn that the results "aren't perfect" (Yirgachefe, Dec 2025). Anywrap is built so the AI can't make up a figure.

## Who It's For
Someone who has downloaded their own data and can't read it. Picture Maya, 29:
- She logs runs in one app, sleep in a tracker that exports a spreadsheet, and spends from a checking account that offers a CSV download.
- Most of these services give her no year-in-review, or a fixed one once a year.
- Data portability laws (GDPR Art. 15 and 20, CCPA) entitle her to these files, but they are full of IDs, timestamps and duplicate columns.

What she does today: opens the CSV, sees 19 columns, and closes it. Or she uploads the whole file to a chatbot, which sends every row away. It may miscount, and she can't easily check where a figure came from.

## The Core Loop
1. Open Anywrap and drop an export, or tap a sample.
2. In about 20 seconds, watch it work out what the file is ("a bank account export: one row = one transaction").
3. Flip through 6 to 8 full-screen cards.
4. Tap the receipt when a number is surprising.
5. Download the share image, and drop the next export.

She comes back with each new export: another app, or next year's file.

## Inspiration & Identity
- **Story format**: Spotify Wrapped (full-screen cards, giant numbers, playful second-person copy), without its branding, colors or name.
- **Navigation**: Instagram Stories (segmented progress bar, tap to advance).
- **Twist**: loud, poster-like cards on the front, a quiet paper receipt on the back. Fun to share, easy to trust.
- References: https://newsroom.spotify.com/wrapped/ (format only), store receipts (monospace, dashed separators).

## Why This Matters to the Learner
It is his idea ("could we make an AI tool that is a Wrapped generator?"), chosen over every alternative the agent proposed. The receipt angle turns a fun format into a demonstration of how to use AI on personal data without trusting it blindly.

## What "Working" Looks Like
Three very different files, dropped one after another, produce three different, correct stories (all fabricated sample data):
- a running log;
- a US bank account CSV;
- a French sleep diary from an app Anywrap has never seen: semicolons, decimal commas, day/month dates.

**The "oh, that's cool" beat**: on the French file, Anywrap says "This is a sleep diary: one row = one night". A card then reads "Late coffee nights: 3.2/5 sleep quality. Other nights: 4/5." Its receipt shows the exact calculation over 266 nights.

## The POC Boundary
- One file at a time: CSV, TSV or JSON (nested JSON included), up to 50 MB.
- File reading and summary in the browser; the AI plans from a fixed menu of calculations; the browser computes on every row; one automatic repair if a plan fails.
- AI captions with the number checker, and a plain fallback text when a caption fails the check.
- Story player: opener, 6 to 8 cards, closing card with a playful persona.
- A receipt on every card, plus a "What the AI saw" view showing the exact summary sent.
- Downloadable share image.
- 4 or 5 fabricated sample files, clearly labeled.
- Runs locally (`npm start`); the API key stays on the local server.

## Later
- A ZIP or a whole Google Takeout folder; several files at once.
- Video export of the story; shareable links.
- Captions in the file's language (French file, French story).
- Static hosting with a bring-your-own key.
- Excel files; comparing two years.

## Explicitly Cut
- **Accounts and storage**: nothing needs saving, and storing files would break the privacy promise.
- **Letting the AI write code**: its results can't be checked. That is exactly the weakness Anywrap is built against.
- **Spotify's name, logo, colors or fonts**: trademark risk.
- **Real personal data in the demo**: the repository and video are public.
