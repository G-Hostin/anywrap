// Side panel: the exact text sent to the AI (and the plan it returned), next to the file's size.
import { useEffect, useRef } from "react";
import { nf, sizeLabel as kb } from "../engine/format.ts";
import type { Story } from "../engine/types.ts";

const bytes = (s: string) => new Blob([s]).size;

function Block({ title, note, text }: { title: string; note: string; text: string }) {
  return (
    <section className="saw-block">
      <header>
        <h3>{title}</h3>
        <span>{note}</span>
      </header>
      <pre tabIndex={0}>{text}</pre>
    </section>
  );
}

const pretty = (sent: string) => {
  // "SUMMARY:\n{json}..." -> label + indented JSON, keeping any trailing instructions
  const m = sent.match(/^([A-Z ]+):\n(\{[\s\S]*?\})(\n\n[\s\S]*)?$/);
  if (!m) return sent;
  try { return `${m[1]}:\n${JSON.stringify(JSON.parse(m[2]), null, 2)}${m[3] ?? ""}`; } catch { return sent; }
};

export function AiSaw({ story, onClose }: { story: Story; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); prev?.focus?.(); };
  }, [onClose]);

  const planBytes = bytes(story.sent.plan), writeBytes = bytes(story.sent.write);
  return (
    <div className="saw-backdrop" onClick={onClose}>
      <aside className="saw" role="dialog" aria-modal="true" aria-labelledby="saw-title" ref={panel} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <header className="saw-head">
          <h2 id="saw-title">What the AI saw</h2>
          <button className="pill" onClick={onClose}>Close</button>
        </header>
        <div className="saw-scale">
          <div><strong>{kb(story.file.bytes)}</strong><span>your file, {nf(story.file.rows)} rows. It stayed in this browser.</span></div>
          <div><strong>{kb(planBytes)}</strong><span>summary sent to plan the story</span></div>
          <div><strong>{kb(writeBytes)}</strong><span>computed results sent to write captions</span></div>
        </div>
        <p className="saw-lede">
          The AI never received your file. It saw a summary (column names, detected types, ranges and 5 example rows),
          picked calculations from a fixed menu, and wrote captions from the computed results. A checker then compared
          every number in the captions with those results.
          {story.replay && ` Sample mode: the AI's answers on this page were replayed from a real ${story.replay.model} run recorded on ${story.replay.recordedAt} (times read in ${story.replay.timeZone}, as in that run); the texts below are what this browser computed and would send.`}
          {story.sent.caught.length > 0 && ` On this file it caught ${story.sent.caught.length} problem${story.sent.caught.length > 1 ? "s" : ""} in the first draft of the captions, and they were rewritten.`}
        </p>
        <Block title="1. Sent to plan the story" note={`${kb(planBytes)} · indented for reading`} text={pretty(story.sent.plan)} />
        <Block title="2. The plan it sent back" note="run on every row, in your browser" text={story.sent.planReply} />
        <Block title="3. Sent to write the captions" note={`${kb(writeBytes)} · indented for reading`} text={pretty(story.sent.write)} />
      </aside>
    </div>
  );
}
