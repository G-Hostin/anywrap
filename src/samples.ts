// The five fabricated sample exports shipped in public/samples/ (scripts/make-samples.ts).
export type Sample = { file: string; label: string; detail: string };

export const SAMPLES: Sample[] = [
  { file: "running-log.csv", label: "Running log", detail: "Fitness app CSV, 19 columns" },
  { file: "bank-account.csv", label: "Bank account", detail: "US checking account CSV" },
  { file: "sleep-diary.csv", label: "Sleep diary", detail: "French app, semicolons, decimal commas" },
  { file: "watch-history.json", label: "Watch history", detail: "Video history, nested JSON" },
  { file: "reading-list.csv", label: "Reading list", detail: "Book tracker library export" },
];

export async function loadSample(s: Sample): Promise<{ name: string; text: string; bytes: number }> {
  const res = await fetch(`/samples/${s.file}`);
  if (!res.ok) throw new Error(`Couldn't load the sample ${s.file}.`);
  const text = await res.text();
  return { name: s.file, text, bytes: new Blob([text]).size };
}
