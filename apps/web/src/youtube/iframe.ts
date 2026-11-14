/** Minimal typings + loader for YouTube's official IFrame Player API. */
export interface YtPlayer {
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  cueVideoById(opts: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(sec: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  loadModule?(name: string): void;
  unloadModule?(name: string): void;
  setOption?(module: string, option: string, value: unknown): void;
  destroy(): void;
}

export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

interface YtNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      host?: string;
      width?: string | number;
      height?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YtPlayer }) => void;
        onStateChange?: (e: { data: number; target: YtPlayer }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YtPlayer;
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YtNamespace> | null = null;

export function loadYouTubeApi(): Promise<YtNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't reach YouTube."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Error codes from the player → something a listener can act on. */
export function describeYtError(code: number): string {
  if (code === 101 || code === 150 || code === 152 || code === 153) return "The owner doesn't allow this video to play outside YouTube.";
  if (code === 100) return "This video was removed or made private.";
  if (code === 5) return "This video can't play in this browser.";
  return "YouTube couldn't play this video.";
}

/** "Kesariya - Brahmastra | Ranbir Kapoor | Official Video (4K)" → "Kesariya - Brahmastra" */
export function songQuery(title: string): string {
  return (
    title
      .split("|")[0]!
      .replace(/\(.*?\)|\[.*?\]/g, " ")
      .replace(/official|music video|video song|full video|full song|lyrical|lyric video|lyrics|4k|hd/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || title
  );
}
