// Working: the receipt prints line by line while the file is read, planned, computed and captioned.
import type { Step, StepId } from "../pipeline.ts";
import { sizeLabel } from "../engine/format.ts";

const ORDER: StepId[] = ["read", "plan", "compute", "write"];
const PENDING: Record<StepId, string> = {
  read: "Reading the file in your browser",
  plan: "Asking the AI what this file is",
  compute: "Computing every stat on every row",
  write: "Writing your story",
};

type Props = {
  fileName: string;
  fileSize: number;
  steps: Step[];
  error: string;
  onCancel: () => void;
  onRetry: () => void;
  onHome: () => void;
};


export function Working({ fileName, fileSize, steps, error, onCancel, onRetry, onHome }: Props) {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const guess = steps.find((s) => s.guess)?.guess;
  const current = ORDER.find((id) => byId.get(id)?.state !== "done");
  return (
    <div className="working">
      <header className="home-top">
        <span className="wordmark">Anywrap</span>
      </header>
      <main className="working-main">
        <div className={`press${error ? " is-stopped" : ""}`}>
        <div className="printer" aria-hidden="true"><span className="printer-led" /><span className="printer-slot" /></div>
        <div className="slip printing" aria-live="polite">
          <div className="slip-paper">
            <p className="slip-title file-name">{fileName}</p>
            <p className="slip-sub">{fileSize ? `${sizeLabel(fileSize)}, read in this browser` : "Read in this browser"}</p>
            <hr />
            {ORDER.map((id) => {
              const s = byId.get(id);
              const state = s?.state === "done" ? "done" : s || (id === current && !error) ? "active" : "pending";
              if (state === "pending" && !s) return <p key={id} className="slip-row pending"><span>{PENDING[id]}</span><i /><b /></p>;
              return (
                <p key={id} className={`slip-row ${state}`}>
                  <span>{s?.text ?? PENDING[id]}</span>
                  <i />
                  <b>{state === "done" ? "done" : error && id === current ? "stopped" : <span className="dots" aria-label="in progress" />}</b>
                </p>
              );
            })}
            {guess && (
              <div className="guess">
                <hr />
                <p className="guess-label">The AI says this is</p>
                <p className="guess-text">{guess.source}</p>
                <p className="guess-row">{guess.row_means}</p>
              </div>
            )}
          </div>
        </div>
        </div>
        {error ? (
          <div className="working-error" role="alert">
            <p>{error}</p>
            <div className="working-actions">
              <button className="pill solid" onClick={onRetry}>Try again</button>
              <button className="pill" onClick={onHome}>Choose another file</button>
            </div>
          </div>
        ) : (
          <button className="link" onClick={onCancel}>Cancel</button>
        )}
      </main>
    </div>
  );
}
