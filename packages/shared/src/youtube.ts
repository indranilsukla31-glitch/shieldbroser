/**
 * YouTube mode: mainstream songs played through YouTube's official embedded
 * player. Artei never touches the audio, so these items have no Artei
 * license/credit block — YouTube's own player and terms apply.
 */
export interface YtVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  /** Seconds (0 if unknown). */
  duration: number;
  publishedAt: string;
  /** Title says it's a lyric video (lyrics shown in the video itself). */
  lyrical: boolean;
}

export interface YtPlaylist {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

export const YT_SHELVES = ["trending", "new_hindi", "punjabi", "romantic", "nineties", "retro"] as const;
export type YtShelfName = (typeof YT_SHELVES)[number];

export const YT_SHELF_LABELS: Record<YtShelfName, { title: string; subtitle: string }> = {
  trending: { title: "Trending in India", subtitle: "YouTube's music chart right now" },
  new_hindi: { title: "New Hindi releases", subtitle: "Most-watched from the last two months" },
  punjabi: { title: "Punjabi hits", subtitle: "Fresh bhangra and Punjabi pop" },
  romantic: { title: "Romantic Bollywood", subtitle: "Love songs, old and new" },
  nineties: { title: "90s & 2000s Bollywood", subtitle: "The ones everyone knows the words to" },
  retro: { title: "Golden era classics", subtitle: "Lata, Kishore, Rafi, Asha and more" },
};
