import { useState } from "react";
import { Bookmark, BookmarkCheck, Share2, Sparkles } from "lucide-react";
import { SCENE_LABELS, type Track, type VisualDnaRecord } from "@artei/shared";
import { FONT_STACKS, applyCase } from "../lib/fonts";
import { renderCardPng, shareOrDownload } from "../lib/cardImage";

import { useCards } from "../store/cards";

/** The Visual DNA card: palette, scene name and Claude's one-line mood description. */
export function DnaCardFace({ record, track }: { record: VisualDnaRecord; track: Track | null }) {
  const { dna } = record;
  const p = dna.palette;
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 ring-1 ring-white/10"
      style={{
        background: `radial-gradient(70% 60% at 20% 20%, ${p.primary}cc, transparent 70%),
                     radial-gradient(60% 60% at 90% 40%, ${p.secondary}bb, transparent 70%),
                     radial-gradient(50% 50% at 50% 95%, ${p.accent}99, transparent 70%), ${p.background}`,
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Visual DNA</p>
      <h3
        className="mt-10 text-4xl leading-tight text-white"
        style={{ fontFamily: FONT_STACKS[dna.typography.family], fontWeight: dna.typography.weight, letterSpacing: `${dna.typography.tracking}em` }}
      >
        {applyCase(dna.sceneName, dna.typography.case)}
      </h3>
      <p className="mt-2 text-white/90">{dna.moodLine}</p>
      <div className="mt-6 flex gap-2">
        {[p.background, p.primary, p.secondary, p.accent, p.highlight].map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="h-10 w-10 rounded-xl ring-1 ring-white/25" style={{ background: c }} />
            <span className="font-mono text-[9px] text-white/70">{c.toUpperCase()}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs font-medium text-white/80">
        {SCENE_LABELS[dna.scene.type]} · {dna.moodTags.join(" · ")}
      </p>
      {track && (
        <p className="mt-1 text-[11px] text-white/60">
          “{track.title}” by {track.artist} · {track.license.name}
        </p>
      )}
      <p className="mt-3 flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/50">
        <Sparkles size={11} />
        {record.origin === "claude" ? (record.kind === "remix" ? `Remixed by Claude: “${record.remixPrompt}”` : "Designed by Claude") : "Preset (Claude unavailable)"}
      </p>
    </div>
  );
}

export function DnaCardActions({ record, track }: { record: VisualDnaRecord; track: Track | null }) {
  const saved = useCards((s) => s.cards.some((c) => c.record.id === record.id));
  const toggle = useCards((s) => s.toggle);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const share = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const blob = await renderCardPng(record, track);
      const how = await shareOrDownload(blob, `artei-${record.dna.sceneName.replace(/\W+/g, "-").toLowerCase()}.png`, record.dna.sceneName);
      if (how === "downloaded") setMsg("Card image downloaded.");
    } catch {
      setMsg("Couldn't create the card image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => void toggle(record, track)} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/10 font-semibold hover:bg-white/15">
          {saved ? <BookmarkCheck size={18} className="text-glow" /> : <Bookmark size={18} />}
          {saved ? "Saved" : "Save card"}
        </button>
        <button onClick={() => void share()} disabled={busy} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-fog font-semibold text-ink disabled:opacity-60">
          <Share2 size={18} /> {busy ? "Preparing…" : "Share"}
        </button>
      </div>
      {msg && <p className="mt-2 text-center text-xs text-mist">{msg}</p>}
    </div>
  );
}

