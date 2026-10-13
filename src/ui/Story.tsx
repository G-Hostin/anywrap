// The story player: one portrait card at a time on a dark stage, click or arrow keys to move.
// Stat cards flip to their receipt; "What the AI saw" opens the exact text sent to the AI.
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { CardShell, OpenerFace, StatFace, ClosingFace } from "./Card.tsx";
import { ReceiptFace } from "./Receipt.tsx";
import { AiSaw } from "./AiSaw.tsx";
import { PALETTES, pairFor } from "./palettes.ts";
import type { Story } from "../engine/types.ts";

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

  const front = idx === 0 ? <OpenerFace story={story} pair={pair} />
    : card ? <StatFace card={card} pair={pair} animate={!flipped} />
    : <ClosingFace story={story} pair={pair} />;
  const back = card ? <ReceiptFace card={card} story={story} index={idx} onClose={() => { setFlipped(false); receiptBtn.current?.focus(); }} /> : undefined;

  const spoken = flipped && card ? `Receipt. ${card.result.receipt.calc}. ${card.result.receipt.rows} rows used.`
    : idx === 0 ? `${story.opener.title}. ${story.opener.line}`
    : card ? `${card.caption.kicker}: ${card.caption.big}. ${card.caption.line} ${card.caption.sub}`
    : `${story.persona.name}. ${story.persona.why}`;

  return (
    <div className="stage" style={{ ["--stage" as string]: theme.stage }}>
      <header className="stage-top">
        <div className="brand">
          <span className="wordmark">Anywrap</span>
          <span className="file">{story.file.name}</span>
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
          <div key={idx} className={`card-enter ${dir > 0 ? "from-right" : "from-left"}`} onClick={onCardClick}>
            <CardShell front={front} back={back} flipped={flipped} label={`Card ${idx + 1} of ${total}`} />
          </div>
          <div className="controls">
            <div className="nav">
              <button className="icon" onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous card"><Chevron dir="left" /></button>
              <span className="count" aria-hidden="true">{idx + 1} / {total}</span>
              <button className="icon" onClick={() => go(1)} disabled={idx === total - 1} aria-label="Next card"><Chevron dir="right" /></button>
            </div>
            <button ref={receiptBtn} className={`pill receipt-btn${flipped ? " on" : ""}`} onClick={() => setFlipped((f) => !f)} disabled={!card} aria-pressed={flipped}>
              {flipped ? "Show the card" : "Receipt"}
            </button>
          </div>
          <p className="sr-only" aria-live="polite">{`Card ${idx + 1} of ${total}. ${spoken}`}</p>
        </div>
      </main>
      {saw && <AiSaw story={story} onClose={() => setSaw(false)} />}
    </div>
  );
}
