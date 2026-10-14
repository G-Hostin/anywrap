// The story player: one portrait card at a time on a dark stage, click or arrow keys to move.
// Stat cards flip to their receipt; "What the AI saw" opens the exact text sent to the AI.
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { CardShell, OpenerFace, StatFace, ClosingFace } from "./Card.tsx";
import { ReceiptFace } from "./Receipt.tsx";
import { AiSaw } from "./AiSaw.tsx";
import { PALETTES, pairFor } from "./palettes.ts";
import { cardToPng, downloadBlob, shareName } from "./share.ts";
import type { Story } from "../engine/types.ts";

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function StoryView({ story, onRestart }: { story: Story; onRestart: () => void }) {
  const total = story.cards.length + 2;
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [flipped, setFlipped] = useState(false);
  const [saw, setSaw] = useState(false);
  const receiptBtn = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<"" | "saving" | "error">("");

  const download = async () => {
    const face = stageRef.current?.querySelector<HTMLElement>(".card .face.front");
    if (!face || saving === "saving") return;
    setSaving("saving");
    try {
      downloadBlob(await cardToPng(face), shareName(story.file.name, idx));
      setSaving("");
    } catch {
      setSaving("error");
    }
  };

  const go = useCallback((d: 1 | -1) => {
    setFlipped(false);
    setIdx((i) => {
      const n = Math.min(total - 1, Math.max(0, i + d));
      if (n !== i) setDir(d);
      return n;
    });
  }, [total]);

  const card = idx > 0 && idx < total - 1 ? story.cards[idx - 1] : null;

  useEffect(() => {
    if (saw) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "Escape" && flipped) { e.preventDefault(); setFlipped(false); receiptBtn.current?.focus(); return; }
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && t?.tagName !== "BUTTON")) { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if ((e.key === "r" || e.key === "R") && card) { e.preventDefault(); setFlipped((f) => !f); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, flipped, saw, card]);

  const theme = PALETTES[story.plan.palette] ?? PALETTES.ink;
  const pair = pairFor(story.plan.palette, idx);

  const onCardClick = (e: MouseEvent<HTMLDivElement>) => {
    if (flipped) return;
    const r = e.currentTarget.getBoundingClientRect();
    go(e.clientX - r.left < r.width * 0.3 ? -1 : 1);
  };

  const faceAt = (i: number, live: boolean) => {
    const p = pairFor(story.plan.palette, i);
    const c = i > 0 && i < total - 1 ? story.cards[i - 1] : null;
    return i === 0 ? <OpenerFace story={story} pair={p} />
      : c ? <StatFace card={c} pair={p} animate={live} fileName={story.file.name} />
      : <ClosingFace story={story} pair={p} />;
  };
  const front = faceAt(idx, !flipped);
  const saveLabel = saving === "saving" ? "Saving…" : saving === "error" ? "Couldn't save, try again" : "Download card";
  const back = card ? <ReceiptFace card={card} story={story} index={idx} onClose={() => { setFlipped(false); receiptBtn.current?.focus(); }} /> : undefined;

  const spoken = flipped && card ? `Receipt. ${card.result.receipt.calc}. ${card.result.receipt.rows} rows used.`
    : idx === 0 ? `${story.opener.title}. ${story.opener.line}`
    : card ? `${card.caption.kicker}: ${card.caption.big}. ${card.caption.line} ${card.caption.sub}`
    : `${story.persona.name}. ${story.persona.why}`;

  return (
    <div className="stage" ref={stageRef} style={{ ["--stage" as string]: theme.stage, ["--glow" as string]: pair.bg }}>
      <header className="stage-top">
        <div className="brand">
          <span className="wordmark">Anywrap</span>
          <span className="file" title={story.replay ? "Sample: the AI's answers are replayed from a recorded run" : undefined}>{story.file.name}{story.replay ? " · recorded run" : ""}</span>
        </div>
        <div className="top-actions">
          <button className="pill ghost" onClick={() => setSaw(true)}>What the AI saw</button>
          <button className="pill" onClick={onRestart}>Wrap another file</button>
        </div>
      </header>

      <main className="stage-main">
        <div className="player">
          <div className="segments" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => <span key={i} className={i <= idx ? "on" : ""} />)}
          </div>
          <div className="deck">
            {idx > 0 && <div key={`prev-${idx}`} className="peek prev" aria-hidden="true" onClick={() => go(-1)}>{faceAt(idx - 1, false)}</div>}
            <div key={idx} className={`card-enter ${dir > 0 ? "from-right" : "from-left"}`} onClick={onCardClick}>
              <CardShell front={front} back={back} flipped={flipped} label={`Card ${idx + 1} of ${total}`} />
            </div>
            {idx < total - 1 && <div key={`next-${idx}`} className="peek next" aria-hidden="true" onClick={() => go(1)}>{faceAt(idx + 1, false)}</div>}
          </div>
          <div className="dock" role="toolbar" aria-label="Story controls">
            <button className="icon" onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous card"><Chevron dir="left" /></button>
            <span className="count" aria-hidden="true">{idx + 1} / {total}</span>
            <button className="icon" onClick={() => go(1)} disabled={idx === total - 1} aria-label="Next card"><Chevron dir="right" /></button>
            <span className="dock-sep" aria-hidden="true" />
            <button ref={receiptBtn} className={`dock-btn receipt-btn${flipped ? " on" : ""}`} onClick={() => setFlipped((f) => !f)} disabled={!card} aria-pressed={flipped}>
              {flipped ? "Show the card" : "Receipt"}
            </button>
            <button className="dock-btn save-btn" onClick={download} disabled={saving === "saving"} aria-label={saveLabel} title={saveLabel}>
              <DownloadIcon /><span className="dock-label">{saveLabel}</span>
            </button>
          </div>
          <p className="hint" aria-hidden="true">Arrow keys move between cards. R flips the receipt.</p>
          <p className="sr-only" aria-live="polite">{`Card ${idx + 1} of ${total}. ${spoken}`}</p>
        </div>
      </main>
      {saw && <AiSaw story={story} onClose={() => setSaw(false)} />}
    </div>
  );
}
