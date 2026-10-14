// Web build only: the visitor's Gemini key. Kept for this tab by default (sessionStorage), or in this browser
// if they ask (localStorage). It is only ever sent to Google's API, and the page's CSP allows no other host.
const K = "anywrap.gemini-key";

const read = (s: Storage | undefined) => { try { return s?.getItem(K) || ""; } catch { return ""; } };
const store = (kind: "session" | "local") => { try { return kind === "session" ? sessionStorage : localStorage; } catch { return undefined; } };

export const getKey = (): string => read(store("session")) || read(store("local"));
export const isRemembered = (): boolean => !!read(store("local"));

export function setKey(key: string, remember: boolean): void {
  forgetKey();
  try { store(remember ? "local" : "session")?.setItem(K, key.trim()); } catch { /* storage blocked: the key lives until reload */ }
}

export function forgetKey(): void {
  for (const s of [store("session"), store("local")]) { try { s?.removeItem(K); } catch { /* ignore */ } }
}

export const looksLikeKey = (k: string): boolean => /^[A-Za-z0-9_.-]{30,}$/.test(k.trim());
