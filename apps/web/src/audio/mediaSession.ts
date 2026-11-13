import { usePlayer, audio } from "../store/player";

/**
 * Lock-screen / notification controls on Android (Media Session API):
 * title, artist, artwork, play/pause, previous/next and seeking.
 */
export function initMediaSession() {
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  const st = () => usePlayer.getState();

  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", () => st().toggle()],
    ["pause", () => audio.pause()],
    ["previoustrack", () => st().prev()],
    ["nexttrack", () => st().next()],
    ["seekbackward", (d) => st().seek(Math.max(0, audio.currentTime - (d.seekOffset ?? 10)))],
    ["seekforward", (d) => st().seek(Math.min(audio.duration || 0, audio.currentTime + (d.seekOffset ?? 10)))],
    ["seekto", (d) => d.seekTime !== undefined && st().seek(d.seekTime)],
  ];
  for (const [action, h] of handlers) {
    try {
      ms.setActionHandler(action, h);
    } catch {
      /* action unsupported on this browser */
    }
  }

  let lastRef: string | undefined;
  let lastPos = 0;
  usePlayer.subscribe((s) => {
    const t = s.queue[s.index];
    if (t && t.ref !== lastRef) {
      lastRef = t.ref;
      ms.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist,
        album: t.album ? `${t.album} · ${t.license.name}` : t.license.name,
        artwork: t.artwork
          ? [{ src: t.artwork, sizes: "600x600", type: "image/jpeg" }]
          : [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
      });
    }
    ms.playbackState = s.status === "playing" ? "playing" : s.status === "idle" ? "none" : "paused";
    // Position updates ~once a second are plenty for the lock screen.
    if (s.duration > 0 && Math.abs(s.position - lastPos) >= 1) {
      lastPos = s.position;
      try {
        ms.setPositionState({ duration: s.duration, position: Math.min(s.position, s.duration), playbackRate: audio.playbackRate || 1 });
      } catch {
        /* invalid state during track switches */
      }
    }
  });
}
