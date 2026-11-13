import { useEffect, useRef, useState } from "react";
import { Ban, Circle, Download, Share2 } from "lucide-react";
import type { Track, VisualDna } from "@artei/shared/client";
import { CLIP_SECONDS, ClipRecorder, clipAllowed, pickMimeType } from "../lib/clip";
import { shareOrDownload } from "../lib/cardImage";
import { analyser, audio, usePlayer } from "../store/player";

interface Props {
  track: Track;
  dna: VisualDna;
  getSources: () => { visuals: HTMLCanvasElement; lyrics: HTMLCanvasElement | null } | null;
  /** Player wires this into the render loop so frames are captured in sync. */
  setRecorder: (r: ClipRecorder | null) => void;
}

/** 15-second vertical clip export with the track credit and license burned in. */
export function ClipSheet({ track, dna, getSources, setRecorder }: Props) {
  const allowed = clipAllowed(track);
  const [state, setState] = useState<"idle" | "recording" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const recRef = useRef<ClipRecorder | null>(null);

  useEffect(
    () => () => {
      recRef.current?.cancel();
      setRecorder(null);
    },
    [setRecorder],
  );
  useEffect(() => () => {
    if (clip) URL.revokeObjectURL(clip.url);
  }, [clip]);

  if (!allowed.ok) {
    return (
      <div className="flex gap-3 rounded-2xl bg-white/5 p-4 text-sm text-mist">
        <Ban size={20} className="shrink-0 text-glow" />
        <p>{allowed.reason}</p>
      </div>
    );
  }
  if (!pickMimeType()) {
    return <p className="text-sm text-mist">This browser can't record video. Try Chrome on Android or desktop.</p>;
  }

  const record = async () => {
    const sources = getSources();
    if (!sources) return setMsg("The visuals aren't running yet.");
    setMsg(null);
    setClip(null);
    analyser.ensure();
    // Make sure we have 15 s of song left, and that it's playing.
    const { duration, seek } = usePlayer.getState();
    if (duration > 0 && audio.currentTime > duration - CLIP_SECONDS) seek(Math.max(0, duration - CLIP_SECONDS - 0.5));
    if (audio.paused) await audio.play().catch(() => {});
    try {
      const rec = new ClipRecorder(sources, track, dna, analyser.stream, setProgress);
      recRef.current = rec;
      setRecorder(rec);
      setState("recording");
      const blob = await rec.start();
      setRecorder(null);
      setClip({ blob, url: URL.createObjectURL(blob) });
      setState("done");
    } catch (e) {
      setRecorder(null);
      setState("error");
      setMsg((e as Error).message);
    }
  };

  const ext = clip?.blob.type.includes("mp4") ? "mp4" : "webm";
  const name = `artei-${track.title.replace(/\W+/g, "-").toLowerCase()}.${ext}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-mist">
        Records the next {CLIP_SECONDS} seconds of visuals, lyrics and audio as a vertical clip. The song credit and its{" "}
        {track.license.name} license are included in the video.
      </p>
      {clip ? (
        <video src={clip.url} controls playsInline className="mx-auto aspect-[9/16] max-h-[46dvh] rounded-2xl bg-black" />
      ) : (
        <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-glow transition-[width]" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      {state !== "done" ? (
        <button onClick={() => void record()} disabled={state === "recording"}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-glow font-semibold text-white disabled:opacity-70">
          <Circle size={16} fill="currentColor" className={state === "recording" ? "animate-pulse" : ""} />
          {state === "recording" ? `Recording… ${Math.ceil(CLIP_SECONDS * (1 - progress))}s` : "Record 15-second clip"}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => void record()} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/10 font-semibold">
            <Circle size={16} /> Record again
          </button>
          <button onClick={() => clip && void shareOrDownload(clip.blob, name, `${track.title} — Artei`).then((h) => h === "downloaded" && setMsg("Clip downloaded."))}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-fog font-semibold text-ink">
            {typeof navigator.share === "function" ? <Share2 size={18} /> : <Download size={18} />} Share
          </button>
        </div>
      )}
      {!analyser.stream && <p className="text-xs text-dim">Audio capture isn't available in this browser, so the clip may be silent.</p>}
      {msg && <p className="text-center text-xs text-mist">{msg}</p>}
    </div>
  );
}
