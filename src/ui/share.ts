// Renders the visible front of a card to a 1080×1920 PNG (story format), fonts included.
import { toSvg } from "html-to-image";

export const SHARE_W = 1080;
export const SHARE_H = 1920;

export async function cardToPng(face: HTMLElement): Promise<Blob> {
  const w = face.offsetWidth, h = face.offsetHeight;
  face.classList.add("exporting"); // shows the file name in the footer, hides "tap to start"
  let svg: string;
  try {
    svg = await toSvg(face, {
      width: w,
      height: h,
      style: { borderRadius: "0", boxShadow: "none", transform: "none", inset: "auto", left: "0", top: "0", visibility: "visible" },
      filter: (n) => !(n instanceof HTMLElement && n.classList.contains("fit-probe")),
    });
  } finally {
    face.classList.remove("exporting");
  }
  const img = new Image();
  img.src = svg;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, SHARE_W, SHARE_H); // the SVG is vector, so it is drawn sharp at full size
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create the image."))), "image/png"));
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const shareName = (file: string, index: number): string =>
  `anywrap-${file.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "story"}-${String(index + 1).padStart(2, "0")}.png`;
