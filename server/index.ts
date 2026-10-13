// Local server: keeps the API key private, forwards small JSON summaries to the AI, serves the app.
// Usage: node server/index.ts [--dev]   (dev = Vite middleware with hot reload; otherwise serves dist/)
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));
const { MODEL, hasKey, plan, write, prompts, planUserMessage, writeUserMessage, UpstreamError } = await import("./anthropic.ts");

const DEV = process.argv.includes("--dev");
const PORT = Number(process.env.PORT || 5173);
const MAX_BODY = 64 * 1024;

const send = (res: ServerResponse, status: number, body: unknown) => {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(text);
};

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new UpstreamError(413, `Request too large (over ${MAX_BODY / 1024} KB). Anywrap only sends summaries, never files.`);
    chunks.push(chunk as Buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new UpstreamError(400, "Request body is not JSON."); }
}

async function api(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  try {
    if (path === "/api/health" && req.method === "GET") return send(res, 200, { hasKey: hasKey(), model: MODEL });
    if (path === "/api/prompts" && req.method === "GET") return send(res, 200, prompts());
    if (path === "/api/plan" && req.method === "POST") {
      const body = (await readBody(req)) as Parameters<typeof plan>[0];
      if (!body || typeof body !== "object" || !("summary" in body)) throw new UpstreamError(400, "Missing summary.");
      const r = await plan(body);
      return send(res, 200, { plan: r.json, sent: planUserMessage(body), usage: r.usage, seconds: r.seconds, model: MODEL });
    }
    if (path === "/api/write" && req.method === "POST") {
      const body = (await readBody(req)) as Parameters<typeof write>[0];
      if (!body || typeof body !== "object" || !("story" in body)) throw new UpstreamError(400, "Missing results.");
      const r = await write(body);
      return send(res, 200, { copy: r.json, sent: writeUserMessage(body), usage: r.usage, seconds: r.seconds, model: MODEL });
    }
    return send(res, 404, { error: "Not found." });
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : 500;
    if (!(e instanceof UpstreamError)) console.error("[anywrap]", (e as Error).message);
    return send(res, status, { error: e instanceof UpstreamError ? e.message : "Something went wrong on the local server." });
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".csv": "text/csv; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};

async function serveStatic(res: ServerResponse, path: string): Promise<void> {
  const dist = join(ROOT, "dist");
  let file = normalize(join(dist, decodeURIComponent(path)));
  if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(dist, "index.html"); // single-page app fallback
  }
  try {
    const data = await readFile(file);
    const cache = file.includes(`${join(dist, "assets")}`) ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": cache });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not built yet: run npm run build, or npm run dev.");
  }
}

let vite: { middlewares: (req: IncomingMessage, res: ServerResponse, next: () => void) => void } | null = null;
if (DEV) {
  const { createServer: createVite } = await import("vite");
  vite = await createVite({ root: ROOT, server: { middlewareMode: true }, appType: "spa" });
}

createServer((req, res) => {
  const path = (req.url || "/").split("?")[0];
  if (path.startsWith("/api/")) return void api(req, res, path);
  if (vite) return vite.middlewares(req, res, () => { res.writeHead(404); res.end(); });
  return void serveStatic(res, path);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Anywrap ${DEV ? "(dev) " : ""}on http://localhost:${PORT}  ·  model ${MODEL}  ·  ${hasKey() ? "API key loaded" : "NO API KEY: add ANTHROPIC_API_KEY to .env"}`);
});
