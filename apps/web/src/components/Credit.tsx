import { ExternalLink } from "lucide-react";
import type { Track } from "@artei/shared/client";

const SOURCE_NAME: Record<string, string> = { jamendo: "Jamendo", archive: "Internet Archive", mock: "Artei offline demo" };

/** Attribution as required by Creative Commons: title, artist, source, license + link. */
export function Credit({ track, className = "" }: { track: Track; className?: string }) {
  const source = SOURCE_NAME[track.ref.split(":")[0]!] ?? "source";
  const l = track.license;
  const clauses = [
    l.attribution && "Attribution",
    l.nonCommercial && "NonCommercial",
    l.noDerivatives && "NoDerivatives",
    l.shareAlike && "ShareAlike",
  ].filter(Boolean);
  return (
    <div className={`text-xs leading-relaxed text-mist ${className}`}>
      <p>
        “{track.title}” by{" "}
        {track.artistUrl ? (
          <a href={track.artistUrl} target="_blank" rel="noreferrer" className="text-fog underline-offset-2 hover:underline">
            {track.artist}
          </a>
        ) : (
          <span className="text-fog">{track.artist}</span>
        )}{" "}
        ·{" "}
        {track.sourceUrl ? (
          <a href={track.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline">
            via {source} <ExternalLink size={11} />
          </a>
        ) : (
          <>via {source}</>
        )}
      </p>
      <p>
        Licensed under{" "}
        <a href={l.url} target="_blank" rel="license noreferrer" className="font-medium text-fog underline-offset-2 hover:underline">
          {l.name}
        </a>
        {clauses.length > 0 && <span className="text-dim"> ({clauses.join(" · ")})</span>}
      </p>
    </div>
  );
}
