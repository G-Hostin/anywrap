// Text that grows to fill its box: the largest font size (up to maxFrac × box width) where `text` fits
// in `lines` lines without breaking words. `display` (e.g. a counting-up number) is shown at that size.
import { useLayoutEffect, useRef, type CSSProperties } from "react";

/** maxFrac: largest font size as a fraction of the box width. maxHFrac: largest text block height, as a fraction of the box width. */
type Props = { text: string; display?: string; maxFrac: number; maxHFrac?: number; minPx?: number; lines?: number; className?: string; style?: CSSProperties };

export function Fit({ text, display, maxFrac, maxHFrac, minPx = 14, lines = 1, className = "", style }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const shown = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = box.current, pr = probe.current, sh = shown.current;
    if (!el || !pr || !sh) return;
    const fit = () => {
      const w = el.clientWidth;
      if (!w) return;
      let lo = minPx, hi = Math.max(minPx, w * maxFrac);
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        pr.style.fontSize = `${mid}px`;
        const lh = parseFloat(getComputedStyle(pr).lineHeight) || mid;
        const ok = pr.scrollWidth <= w + 0.5 && pr.offsetHeight <= lh * lines + 1 && (!maxHFrac || pr.offsetHeight <= w * maxHFrac);
        if (ok) lo = mid; else hi = mid;
      }
      sh.style.fontSize = `${lo}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [text, maxFrac, maxHFrac, minPx, lines]);

  return (
    <div ref={box} className={`fit ${className}`} style={style}>
      <div ref={probe} className="fit-probe" aria-hidden="true">{text}</div>
      <div ref={shown} className="fit-text">{display ?? text}</div>
    </div>
  );
}
