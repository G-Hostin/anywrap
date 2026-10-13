// The back of a stat card: a paper receipt that says exactly how the number was computed.
import { nf } from "../engine/format.ts";
import type { Card, Story } from "../engine/types.ts";

function Row({ k, v }: { k: string; v: string }) {
  if (v.length > 22 || k.length + v.length > 44) {
    return (
      <div className="r-row stacked">
        <span className="r-k">{k}</span>
        <span className="r-v">{v}</span>
      </div>
    );
  }
  return (
    <div className="r-row">
      <span className="r-k">{k}</span>
      <span className="r-dots" aria-hidden="true" />
      <span className="r-v">{v}</span>
    </div>
  );
}

export function ReceiptFace({ card, story, index, onClose }: { card: Card; story: Story; index: number; onClose: () => void }) {
  const r = card.result.receipt;
  return (
    <div className="face back receipt">
      <div className="paper">
        <header className="r-head">
          <span className="wordmark">Anywrap</span>
          <span>Receipt · card {index}</span>
        </header>
        <p className="r-big">{card.caption.big}</p>
        <p className="r-calc">{r.calc}</p>
        <hr />
        <Row k="File" v={story.file.name} />
        <Row k="Rows in file" v={nf(story.file.rows)} />
        <Row k="Period" v={r.period.split(" · ")[1] ?? r.period} />
        {r.exclusions.map((e, i) => <Row key={i} k={`Removed: ${e.rule}`} v={`−${nf(e.removed)}`} />)}
        {r.filters.map((f, i) => <Row key={`f${i}`} k={`Only: ${f}`} v="" />)}
        <Row k="Rows used" v={nf(r.rows)} />
        <Row k="Columns" v={r.columns.join(", ") || "rows only"} />
        <hr />
        {r.table.length > 0 && (
          <div className="r-table">
            {r.table.map(([k, v], i) => <Row key={i} k={k} v={v} />)}
          </div>
        )}
        {r.note && <p className="r-note">{r.note}</p>}
        <hr />
        <p className={`r-check ${card.checked}`}>
          {card.checked === "ai"
            ? "Caption checked: every number in it was found in these results."
            : "Template caption: the AI's wording didn't pass the number check, so Anywrap wrote it from the results."}
        </p>
        <p className="r-small">Computed in your browser on every row. The AI only saw a summary of the file.</p>
      </div>
      <button className="r-close" onClick={(e) => { e.stopPropagation(); onClose(); }}>Back to the card</button>
    </div>
  );
}
