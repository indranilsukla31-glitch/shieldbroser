import { useEffect, useRef, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import type { Track } from "@artei/shared";
import { api } from "../api/client";
import { TrackRow } from "../components/TrackRow";
import { usePlayer } from "../store/player";

export function Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const playQueue = usePlayer((s) => s.playQueue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      setError(null);
      return;
    }
    setLoading(true);
    const id = setTimeout(() => {
      api
        .search(term)
        .then((r) => {
          setResults(r.tracks);
          setError(null);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <div className="pt-safe mx-auto max-w-3xl px-4 pb-6 sm:px-8">
      <h1 className="pt-8 font-display text-3xl font-extrabold tracking-tight">Search</h1>
      <div className="glass mt-4 flex items-center gap-2 rounded-2xl px-4">
        <SearchIcon size={18} className="text-dim" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Songs, artists, genres…"
          aria-label="Search the catalog"
          className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-dim"
          maxLength={100}
          enterKeyHint="search"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear search" className="text-dim hover:text-fog">
            <X size={18} />
          </button>
        )}
      </div>
      <div className="mt-4">
        {error && <p className="text-sm text-mist">Search failed: {error}</p>}
        {loading && !results && <p className="text-sm text-dim">Searching…</p>}
        {results?.length === 0 && <p className="text-sm text-dim">No matches for “{q}”.</p>}
        {results?.map((t, i) => <TrackRow key={t.ref} track={t} onPlay={() => playQueue(results, i)} />)}
      </div>
    </div>
  );
}
