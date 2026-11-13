import type { VisualDna } from "@artei/shared";
import { usePlayer } from "../store/player";
import { momentAt } from "../visual/dnaMapper";

/**
 * A thin colored bar under the seek bar showing how the visuals will shift
 * through the song (one segment per Visual DNA moment).
 */
export function MoodTimeline({ dna }: { dna: VisualDna }) {
  const progress = usePlayer((s) => (s.duration > 0 ? s.position / s.duration : 0));
  const { moments, palette } = dna;
  const stops = [{ at: 0, color: palette.primary, intensity: dna.scene.intensity * 0.8, label: "Intro" }].concat(
    moments.map((m) => ({ at: m.at, color: palette[m.shift.paletteEmphasis], intensity: m.shift.intensity, label: m.label })),
  );
  const current = momentAt(moments, progress);
  const label = current >= 0 ? moments[current]!.label : "Intro";
  return (
    <div className="mt-1" aria-label={`Mood timeline, now: ${label}`} role="img">
      <div className="relative flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        {stops.map((s, i) => {
          const end = stops[i + 1]?.at ?? 1;
          return (
            <div
              key={i}
              title={s.label}
              className="h-full transition-opacity"
              style={{
                width: `${(end - s.at) * 100}%`,
                background: `linear-gradient(90deg, ${s.color}, ${stops[i + 1]?.color ?? s.color})`,
                opacity: 0.35 + s.intensity * 0.65,
              }}
            />
          );
        })}
        <div className="absolute inset-y-0 w-0.5 rounded bg-white shadow-[0_0_6px_white]" style={{ left: `calc(${progress * 100}% - 1px)` }} />
      </div>
      <div className="relative mt-1 h-3 text-[10px] font-medium uppercase tracking-wider text-dim">
        {moments.map((m, i) => (
          <span key={i} className={`absolute -translate-x-1/2 whitespace-nowrap transition-colors ${i === current ? "text-fog" : ""}`}
            style={{ left: `${Math.min(92, Math.max(8, m.at * 100))}%` }}>
            {i === current ? m.label : "·"}
          </span>
        ))}
      </div>
    </div>
  );
}
