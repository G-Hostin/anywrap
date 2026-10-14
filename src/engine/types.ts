// Shared shapes. The Plan and Copy shapes mirror the JSON schemas in src/ai/prompts.ts.

export type Table = {
  name: string;
  format: "csv" | "json";
  note: string;
  columns: string[];
  rows: string[][];
  bytes: number;
};

export type ColumnProfile = {
  name: string;
  filled: string;
  distinct: number;
  number?: { decimal: string; min: number; max: number; negatives: number };
  date?: { order: string; min: string; max: string; rows_per_year: Record<string, number>; has_time_of_day: boolean; tz_in_text: boolean };
  time_of_day?: true;
  boolean?: true;
  examples?: string[];
  top_values?: [string, number][];
  avg_length?: number;
};

export type Summary = {
  file: string;
  format: "csv" | "json";
  note: string;
  row_count: number;
  columns: ColumnProfile[];
  sample_rows: Record<string, string>[];
};

export type FieldType = "number" | "duration" | "date" | "time_of_day" | "boolean" | "text";
export type Field = {
  col: string;
  type: FieldType;
  decimal?: "." | ",";
  unit?: string;
  scale?: number;
  order?: "MDY" | "DMY";
  true_values?: string[];
};

export type FilterOp = "eq" | "neq" | "in" | "not_in" | "contains" | "not_contains" | "starts_with" | "gt" | "gte" | "lt" | "lte" | "empty" | "not_empty";
export type Filter = { col: string; op: FilterOp; value?: string | number | boolean | string[] };

export type Derive = { name: string; from: string; op: "copy" | "strip_prefix" | "strip_suffix" | "regex_replace" | "extract"; arg?: string; replacement?: string };

export type Op = "total" | "average" | "record" | "top" | "distinct" | "timeline" | "peak_day" | "streak" | "share" | "compare" | "first_last";
export type Slide = {
  id: string;
  op: Op;
  angle: string;
  measure?: string;
  stat?: "mean" | "median";
  dir?: "max" | "min";
  show?: string[];
  group?: string;
  by?: "count" | "sum" | "mean";
  k?: number;
  split?: string;
  date?: string;
  unit?: "month" | "weekday" | "hour";
  match?: Filter[];
  min_rows?: number;
  where?: Filter[];
};

export type Palette = "ember" | "ink" | "tide" | "neon" | "dusk";

export type Plan = {
  dataset: { source: string; row_means: string; subject: string; confidence: "high" | "medium" | "low" };
  period: { date: string; from: string; to: string; label: string } | null;
  derive: Derive[];
  fields: Field[];
  exclude: Filter[];
  slides: Slide[];
  palette: Palette;
};

export type ChartItem = { label: string; value: number; display: string };
export type Chart =
  | { kind: "bars"; items: ChartItem[]; peak: number }
  | { kind: "rank"; items: ChartItem[] }
  | { kind: "heatmap"; from: string; to: string; active: string[]; streak: [string, string] }
  | { kind: "ring"; fraction: number }
  | { kind: "compare"; items: ChartItem[] };

export type Receipt = {
  calc: string;
  columns: string[];
  period: string;
  exclusions: { rule: string; removed: number }[];
  filters: string[];
  rows: number;
  table: [string, string][];
  note?: string;
};

export type Result = {
  id: string;
  op: Op;
  angle: string;
  facts: Record<string, string>;
  chart?: Chart;
  receipt: Receipt;
};

export type RunOutput = {
  results: Result[];
  errors: string[];
  period: string;
  rowsTotal: number;
  rowsInPeriod: number;
  counts: Record<string, string | number>;
};

export type Caption = { id: string; kicker: string; big: string; line: string; sub: string };
export type Copy = {
  opener: { title: string; line: string };
  slides: Caption[];
  persona: { name: string; why: string };
  skipped: { id: string; reason: string }[];
};

export type Card = { result: Result; caption: Caption; checked: "ai" | "template" };

export type Story = {
  file: { name: string; bytes: number; rows: number; columns: number };
  plan: Plan;
  cards: Card[];
  opener: Copy["opener"];
  persona: Copy["persona"];
  period: string;
  rowsInPeriod: number;
  sent: { plan: string; planReply: string; write: string; repairs: number; rewrites: number; caught: { id: string; field: string; text: string; issue: string }[] };
  dropped: string[];
  seconds: number;
  /** web build, samples only: the AI's answers were replayed from a recorded run */
  replay?: { model: string; recordedAt: string; timeZone: string };
};
