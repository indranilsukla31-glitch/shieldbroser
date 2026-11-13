import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

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

/** Visual DNA per track: one "base" row per track, plus user remixes. */
export const visualDna = sqliteTable("visual_dna", {
  id: text("id").primaryKey(),
  trackRef: text("track_ref").notNull(),
  kind: text("kind", { enum: ["base", "remix"] }).notNull(),
  parentId: text("parent_id"),
  ownerId: text("owner_id"), // anon user who created a remix
  origin: text("origin", { enum: ["claude", "preset"] }).notNull(),
  model: text("model").notNull(), // model id, or "none" when Claude wasn't configured
  remixPrompt: text("remix_prompt"),
  json: text("json").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
}, (t) => [index("visual_dna_track_idx").on(t.trackRef, t.kind), index("visual_dna_owner_idx").on(t.ownerId, t.createdAt)]);

export const savedCards = sqliteTable(
  "saved_cards",
  {
    userId: text("user_id")
      .notNull()
      .references(() => anonUsers.id, { onDelete: "cascade" }),
    dnaId: text("dna_id")
      .notNull()
      .references(() => visualDna.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dnaId] })],
);
