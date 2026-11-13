import { useEffect, useState } from "react";
import type { Track } from "@artei/shared/client";
import { TrackCard } from "./TrackCard";
import { usePlayer } from "../store/player";

interface Props {
  title: string;
  subtitle?: string;
  load: () => Promise<{ tracks: Track[] }>;
}

export function Shelf({ title, subtitle, load }: Props) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playQueue = usePlayer((s) => s.playQueue);

  useEffect(() => {
    let live = true;
    load()
      .then((r) => live && setTracks(r.tracks))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between px-4 sm:px-8">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
          {subtitle && <p className="text-sm text-dim">{subtitle}</p>}
        </div>
      </div>
      {error ? (
        <p className="mx-4 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-6 text-sm text-mist sm:mx-8">
          {navigator.onLine ? `Couldn't load this shelf. ${error}` : "You're offline. This shelf will load when you reconnect."}
        </p>
      ) : (
        <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:scroll-px-8 sm:px-8">
          {tracks === null
            ? Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="w-36 shrink-0 sm:w-44">
                  <div className="aspect-square animate-pulse rounded-2xl bg-white/5" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-white/5" />
                  <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-white/5" />
                </div>
              ))
            : tracks.map((t, i) => <TrackCard key={t.ref} track={t} onPlay={() => playQueue(tracks, i)} />)}
          {tracks?.length === 0 && <p className="py-6 text-sm text-dim">Nothing here right now.</p>}
        </div>
      )}
    </section>
  );
}
