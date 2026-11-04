import { useState } from "react";
import type { Track } from "@artei/shared";
import { trackHues } from "../lib/format";

/** Album art, or a generated gradient when the catalog has none / it fails to load. */
export function Artwork({ track, className = "", rounded = "rounded-2xl" }: { track: Track; className?: string; rounded?: string }) {
  const [failed, setFailed] = useState(false);
  const [a, b, c] = trackHues(track.ref);
  const fallback = {
    background: `radial-gradient(120% 90% at 20% 15%, hsl(${a} 90% 62%) 0%, transparent 55%),
                 radial-gradient(90% 90% at 85% 80%, hsl(${b} 85% 55%) 0%, transparent 60%),
                 linear-gradient(140deg, hsl(${c} 60% 18%), hsl(${a} 50% 8%))`,
  };
  return (
    <div className={`relative overflow-hidden ${rounded} bg-ink-3 ${className}`} style={fallback}>
      {track.artwork && !failed ? (
        <img
          src={track.artwork}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute bottom-2 left-3 font-display text-3xl font-extrabold text-white/80 mix-blend-overlay">
          {track.title.slice(0, 1)}
        </span>
      )}
    </div>
  );
}
