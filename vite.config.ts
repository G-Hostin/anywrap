import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// `npm run build` = the local app (served by server/index.ts). `npm run build:web` = the static site for
// GitHub Pages (no server): base path /anywrap/, and a Content-Security-Policy that lets the page talk to
// Google's Gemini API and nothing else, so a pasted key can't be sent anywhere else.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://generativelanguage.googleapis.com",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

const webCsp = (): Plugin => ({
  name: "anywrap-web-csp",
  apply: "build",
  transformIndexHtml: (html) => html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="no-referrer" />`),
});

export default defineConfig(({ mode }) => {
  const web = mode === "web";
  return {
    base: web ? "/anywrap/" : "/",
    plugins: [react(), ...(web ? [webCsp()] : [])],
    build: { target: "es2022", chunkSizeWarningLimit: 900, outDir: web ? "dist-web" : "dist" },
  };
});
