import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Disc3, Loader2, Play, Search as SearchIcon, Subtitles } from "lucide-react";
import { YT_SHELVES, YT_SHELF_LABELS, type YtPlaylist, type YtVideo } from "@artei/shared/client";
import { api } from "../api/client";
import { useYouTube } from "../store/youtube";
import { formatTime } from "../lib/format";

const LYRIC_PREF = "artei.yt.lyricFirst";

function useLyricFirst(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => {
    try {
      return localStorage.getItem(LYRIC_PREF) !== "0";
    } catch {
      return true;
    }
  });
  return [
    v,
    (next) => {
      setV(next);
      try {
        localStorage.setItem(LYRIC_PREF, next ? "1" : "0");
      } catch {
        /* storage unavailable */
      }
    },
  ];
}

function VideoCard({ video, onPlay, wide }: { video: YtVideo; onPlay: () => void; wide?: boolean }) {
  const isCurrent = useYouTube((s) => s.queue[s.index]?.id === video.id);
  return (
    <motion.button
      type="button"
      onClick={onPlay}
      whileTap={{ scale: 0.97 }}
      className={`group shrink-0 snap-start text-left ${wide ? "w-full" : "w-60 sm:w-72"}`}
      aria-label={`Play ${video.title} on YouTube`}
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-white/5">
        {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        {video.lyrical && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-fog backdrop-blur">
            <Subtitles size={11} /> Lyrics
          </span>
        )}
        {video.duration > 0 && (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">{formatTime(video.duration)}</span>
        )}
        <span className={`absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-fog text-ink shadow-lg transition ${isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <Play size={16} fill="currentColor" />
        </span>
      </div>
      <p className={`mt-2 line-clamp-2 text-sm font-semibold leading-snug ${isCurrent ? "text-glow" : "text-fog"}`}>{video.title}</p>
      <p className="truncate text-xs text-mist">{video.channel}</p>
    </motion.button>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:scroll-px-8 sm:px-8">{children}</div>;
}

function Skeletons() {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="w-60 shrink-0 sm:w-72">
          <div className="aspect-video animate-pulse rounded-2xl bg-white/5" />
          <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 px-4 sm:px-8">
      <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      {subtitle && <p className="text-sm text-dim">{subtitle}</p>}
    </div>
  );
}

function useStartQueue() {
  const playQueue = useYouTube((s) => s.playQueue);
  const navigate = useNavigate();
  return (videos: YtVideo[], i: number) => {
    playQueue(videos, i);
    navigate("/yt/watch");
  };
}

function VideoShelf({ title, subtitle, load }: { title: string; subtitle?: string; load: () => Promise<{ videos: YtVideo[] }> }) {
  const [videos, setVideos] = useState<YtVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = useStartQueue();
  useEffect(() => {
    let live = true;
    load()
      .then((r) => live && setVideos(r.videos))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (videos?.length === 0) return null;
  return (
    <section className="mt-8">
      <Heading title={title} subtitle={subtitle} />
      {error ? (
        <p className="mx-4 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-5 text-sm text-mist sm:mx-8">{error}</p>
      ) : (
        <Row>{videos === null ? <Skeletons /> : videos.map((v, i) => <VideoCard key={v.id} video={v} onPlay={() => start(videos, i)} />)}</Row>
      )}
    </section>
  );
}

function AlbumCard({ album }: { album: YtPlaylist }) {
  const start = useStartQueue();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { videos } = await api.yt.playlist(album.id);
      if (videos.length) start(videos, 0);
      else setErr("Nothing in this album can play here.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={() => void open()} className="group w-44 shrink-0 snap-start text-left sm:w-52" aria-label={`Play album ${album.title}`}>
      <div className="relative">
        {/* Stacked-sleeve look for albums */}
        <div className="absolute inset-x-3 -top-1.5 h-4 rounded-t-xl bg-white/10" />
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/5 ring-1 ring-inset ring-white/10">
          {album.thumbnail && <img src={album.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
          <span className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-fog text-ink shadow-lg">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Disc3 size={16} />}
          </span>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{album.title}</p>
      <p className="truncate text-xs text-mist">{err ?? album.channel}</p>
    </button>
  );
}

function AlbumShelf({ title, subtitle, query }: { title: string; subtitle?: string; query: string }) {
  const [albums, setAlbums] = useState<YtPlaylist[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setAlbums(null);
    api.yt
      .albums(query)
      .then((r) => live && setAlbums(r.playlists))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [query]);
  if (albums?.length === 0) return null;
  return (
    <section className="mt-8">
      <Heading title={title} subtitle={subtitle} />
      {error ? (
        <p className="mx-4 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-5 text-sm text-mist sm:mx-8">{error}</p>
      ) : (
        <Row>{albums === null ? <Skeletons /> : albums.map((a) => <AlbumCard key={a.id} album={a} />)}</Row>
      )}
    </section>
  );
}

function SetupCard() {
  return (
    <div className="mx-4 mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:mx-8">
      <h2 className="font-display text-xl font-bold">YouTube mode is off</h2>
      <p className="mt-2 text-sm text-mist">
        To browse trending Bollywood, Punjabi and retro hits, the server needs a free YouTube Data API key:
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-mist">
        <li>Open console.cloud.google.com and create a project.</li>
        <li>APIs &amp; Services → Library → enable “YouTube Data API v3”.</li>
        <li>Credentials → Create credentials → API key.</li>
        <li>Put it in the server's <code className="rounded bg-white/10 px-1">YOUTUBE_API_KEY</code> setting and restart.</li>
      </ol>
    </div>
  );
}

export function YouTube() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [lyricFirst, setLyricFirst] = useLyricFirst();
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [tab, setTab] = useState<"songs" | "albums">("songs");
  const [results, setResults] = useState<YtVideo[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = useStartQueue();

  useEffect(() => {
    api.yt
      .status()
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (!submitted || tab !== "songs") return;
    let live = true;
    setSearching(true);
    setError(null);
    api.yt
      .search(submitted, lyricFirst)
      .then((r) => live && setResults(r.videos))
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setSearching(false));
    return () => {
      live = false;
    };
  }, [submitted, lyricFirst, tab]);

  return (
    <div className="overflow-x-clip pb-6">
      <header className="pt-safe relative px-4 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-rose-500/20 blur-[100px]" />
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-10 h-80 w-80 rounded-full bg-amber-400/15 blur-[100px]" />
        <div className="relative pt-8">
          <p className="text-sm font-medium text-mist">Hits, new and old</p>
          <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
            hits<span className="text-glow">.</span>
          </h1>
          <p className="mt-1 max-w-md text-sm text-mist">
            Bollywood, Punjabi and retro classics, played through YouTube's official player inside Artei's visuals.
          </p>
        </div>
        {enabled && (
          <form
            className="relative mt-5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(q.trim());
            }}
          >
            <label className="glass flex flex-1 items-center gap-2 rounded-2xl px-4 py-3">
              <SearchIcon size={18} className="text-dim" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  if (!e.target.value) {
                    setSubmitted("");
                    setResults(null);
                  }
                }}
                placeholder="Song, film, singer or album"
                className="w-full bg-transparent text-sm outline-none placeholder:text-dim"
                enterKeyHint="search"
                aria-label="Search YouTube music"
              />
            </label>
          </form>
        )}
        {enabled && (
          <div className="relative mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLyricFirst(!lyricFirst)}
              aria-pressed={lyricFirst}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${lyricFirst ? "bg-fog text-ink" : "glass text-mist"}`}
            >
              <Subtitles size={14} /> Lyric videos first
            </button>
            {submitted &&
              (["songs", "albums"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${tab === t ? "bg-white/15 text-fog" : "text-dim hover:text-mist"}`}>
                  {t}
                </button>
              ))}
          </div>
        )}
      </header>

      {enabled === false && <SetupCard />}

      {enabled && submitted && tab === "songs" && (
        <section className="mt-6 px-4 sm:px-8">
          {searching && <p className="flex items-center gap-2 text-sm text-mist"><Loader2 size={16} className="animate-spin" /> Searching…</p>}
          {error && <p className="text-sm text-mist">{error}</p>}
          {results && !searching && results.length === 0 && <p className="text-sm text-mist">No playable videos for “{submitted}”.</p>}
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {!searching && results?.map((v, i) => <VideoCard key={v.id} video={v} wide onPlay={() => start(results, i)} />)}
          </div>
        </section>
      )}
      {enabled && submitted && tab === "albums" && <AlbumShelf title={`Albums for “${submitted}”`} query={`${submitted} jukebox`} />}

      {enabled && !submitted && (
        <>
          {YT_SHELVES.slice(0, 2).map((s) => (
            <VideoShelf key={s} title={YT_SHELF_LABELS[s].title} subtitle={YT_SHELF_LABELS[s].subtitle} load={() => api.yt.shelf(s)} />
          ))}
          <AlbumShelf title="Albums & jukeboxes" subtitle="Whole film soundtracks, back to back" query="" />
          {YT_SHELVES.slice(2).map((s) => (
            <VideoShelf key={s} title={YT_SHELF_LABELS[s].title} subtitle={YT_SHELF_LABELS[s].subtitle} load={() => api.yt.shelf(s)} />
          ))}
          <p className="mx-4 mt-10 text-xs text-dim sm:mx-8">
            Videos play in YouTube's own embedded player under YouTube's terms; ads may appear unless you're signed in to
            YouTube Premium in this browser. Artei only adds the visuals around them.
          </p>
        </>
      )}
    </div>
  );
}
