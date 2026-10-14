// Web build only: asks for the visitor's own free Gemini key, checks it with Google, and says where it goes.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { DEFAULT_MODEL } from "../ai/gemini.ts";
import { looksLikeKey } from "../web/key.ts";

type Props = {
  fileName?: string;
  error?: string;
  onSave: (key: string, remember: boolean) => void;
  onClose: () => void;
};

async function checkKey(key: string): Promise<string> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}`, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return "";
    if (res.status === 400 || res.status === 401 || res.status === 403) return "Google rejected this key. Copy it again from AI Studio.";
    return ""; // rate limit or a hiccup on Google's side: the real request will say more
  } catch {
    return "Couldn't reach Google to check the key. Check your connection.";
  }
}

export function KeyDialog({ fileName, error, onSave, onClose }: Props) {
  const [key, setKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [state, setState] = useState<{ busy: boolean; error: string }>({ busy: false, error: error || "" });
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const k = key.trim();
    if (!looksLikeKey(k)) { setState({ busy: false, error: "That doesn't look like a Gemini API key." }); return; }
    setState({ busy: true, error: "" });
    const problem = await checkKey(k);
    if (problem) { setState({ busy: false, error: problem }); return; }
    onSave(k, remember);
  };

  return (
    <div className="key-backdrop" onClick={onClose}>
      <form className="keybox" role="dialog" aria-modal="true" aria-labelledby="key-title" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 id="key-title">{fileName ? <>To wrap <span className="file-name">{fileName}</span>, add a free Gemini key</> : "Add a free Gemini key"}</h2>
        <p>
          The samples replay a recorded AI run. Your own file needs an AI to read its summary, so Anywrap uses your own
          Gemini API key. It's free and takes a minute: no billing, no card.
        </p>
        <ol className="key-steps">
          <li>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a> and sign in with a Google account.</li>
          <li>Click <strong>Create API key</strong>, then copy it.</li>
          <li>Paste it here.</li>
        </ol>
        <label className="key-field">
          <span>Gemini API key</span>
          <input
            ref={input}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your key"
            aria-invalid={!!state.error}
          />
        </label>
        <label className="key-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Remember it on this device (otherwise it's forgotten when you close the tab)</span>
        </label>
        {state.error && <p className="key-error" role="alert">{state.error}</p>}
        <p className="key-fine">
          The key stays in this browser and is only sent to Google's Gemini API. Your file never leaves this computer:
          Gemini gets a short summary of it, then the computed results. On the free tier, Google may use those requests
          to improve its models.
        </p>
        <div className="key-actions">
          <button type="submit" className="pill solid" disabled={state.busy || !key.trim()}>{state.busy ? "Checking the key…" : fileName ? "Save and wrap my file" : "Save the key"}</button>
          <button type="button" className="pill" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
