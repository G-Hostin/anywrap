// Five named duotone palettes. The AI picks one per story; cards cycle through its pairs.
import type { Palette } from "../engine/types.ts";

export type Pair = { bg: string; fg: string };
export type Theme = { stage: string; pairs: Pair[] };

const p = (bg: string, fg: string): Pair => ({ bg, fg });

export const PALETTES: Record<Palette, Theme> = {
  ember: { stage: "#170600", pairs: [p("#FF5B1F", "#2B0B00"), p("#2B0B00", "#FF8A5C"), p("#FFD23F", "#3A1600"), p("#B5123C", "#FFE2D4")] },
  ink: { stage: "#06081f", pairs: [p("#2340FF", "#EAF0FF"), p("#0B103F", "#9DB3FF"), p("#C9D6FF", "#0B103F"), p("#EAF0FF", "#2340FF")] },
  tide: { stage: "#03171a", pairs: [p("#00A396", "#F0FFF9"), p("#07343A", "#7FF5DE"), p("#BFF5E8", "#07343A"), p("#F0FFF9", "#00756C")] },
  neon: { stage: "#0f0820", pairs: [p("#E8FF3A", "#1C1F00"), p("#2A0F5C", "#E8FF3A"), p("#FF4FD8", "#1C0016"), p("#1C1F00", "#E8FF3A")] },
  dusk: { stage: "#14031b", pairs: [p("#6B2BD9", "#FFE7F5"), p("#FF7AB8", "#2B0638"), p("#2B0638", "#FFB86B"), p("#FFB86B", "#2B0638")] },
};

export const pairFor = (palette: Palette, index: number): Pair => {
  const t = PALETTES[palette] ?? PALETTES.ink;
  return t.pairs[index % t.pairs.length];
};
