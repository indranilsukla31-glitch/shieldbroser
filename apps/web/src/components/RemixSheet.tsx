import { useEffect, useState } from "react";
import { Check, Loader2, Wand2 } from "lucide-react";
import type { Track, VisualDnaRecord } from "@artei/shared/client";
import { api, ApiError, type RemixAllowance } from "../api/client";
import { useVisuals } from "../store/visuals";

const IDEAS = ["monsoon evening", "neon rain at 3am", "sunrise over the sea", "underwater dream", "old film, warm grain", "storm and lightning"];

/** "Remix the vibe": ask Claude to adjust this song's Visual DNA from a short prompt. */
export function RemixSheet({ track, onDone }: { track: Track; onDone: () => void }) {
  const entry = useVisuals((s) => s.byRef[track.ref]);
  const setActive = useVisuals((s) => s.setActive);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<RemixAllowance | null>(null);
  const [remixes, setRemixes] = useState<VisualDnaRecord[]>([]);

  useEffect(() => {
    api
      .remixes(track.ref)
      .then((r) => {
        setRemixes(r.records);
        setAllowance(r.allowance);
      })
      .catch(() => {});
  }, [track.ref]);

  const submit = async (text: string) => {
    const p = text.trim();
    if (p.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const base = entry?.active ?? entry?.base;
      const { record, allowance } = await api.remix(track.ref, p, base?.id);
      setAllowance(allowance);
      setRemixes((r) => [record, ...r]);
      setActive(track.ref, record);
      setPrompt("");
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const activeId = entry?.active?.id;
  return (
    <div className="space-y-4">
      <p className="text-sm text-mist">Describe a feeling and Claude will re-imagine this song's visual world.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(prompt);
        }}
        className="flex gap-2"
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={140}
          placeholder="make it feel like a monsoon evening"
          aria-label="Remix prompt"
          className="h-12 min-w-0 flex-1 rounded-2xl bg-white/10 px-4 text-base outline-none ring-glow/60 placeholder:text-dim focus:ring-2"
          enterKeyHint="send"
          disabled={busy}
        />
        <button type="submit" disabled={busy || prompt.trim().length < 2 || allowance?.remaining === 0}
          className="flex h-12 items-center gap-2 rounded-2xl bg-glow px-4 font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
          <span className="hidden sm:inline">{busy ? "Remixing…" : "Remix"}</span>
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {IDEAS.map((i) => (
          <button key={i} onClick={() => void submit(i)} disabled={busy || allowance?.remaining === 0}
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/15 disabled:opacity-50">
            {i}
          </button>
        ))}
      </div>
      {busy && <p className="text-sm text-mist">Claude is remixing the vibe…</p>}
      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      {allowance && (
        <p className="text-xs text-dim">
          {allowance.remaining} of {allowance.limit} remixes left today.
        </p>
      )}
      {(remixes.length > 0 || entry?.active) && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-dim">Versions</p>
          <div className="space-y-1">
            <VersionRow label={entry?.base?.dna.sceneName ?? "Original"} sub="Original" active={!activeId} onClick={() => setActive(track.ref, undefined)} />
            {remixes.map((r) => (
              <VersionRow key={r.id} label={r.dna.sceneName} sub={`“${r.remixPrompt}”`} active={activeId === r.id} onClick={() => setActive(track.ref, r)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VersionRow({ label, sub, active, onClick }: { label: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${active ? "bg-white/10" : "hover:bg-white/5"}`}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs text-mist">{sub}</span>
      </span>
      {active && <Check size={16} className="text-glow" />}
    </button>
  );
}
