import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

/** Normalized catalog metadata, cached so lookups and streaming don't re-hit the catalog. */
export const tracks = sqliteTable("tracks", {
  ref: text("ref").primaryKey(),
  json: text("json").notNull(), // serialized Track
  lyricsJson: text("lyrics_json").notNull(), // serialized Lyrics
  audioUrl: text("audio_url").notNull(),
  fetchedAt: integer("fetched_at", { mode: "number" }).notNull(),
});

export const anonUsers = sqliteTable("anon_users", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const likes = sqliteTable(
  "likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => anonUsers.id, { onDelete: "cascade" }),
    trackRef: text("track_ref").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.trackRef] })],
);
