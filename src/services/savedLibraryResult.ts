import { z } from "zod";
import type { Tables } from "../types/database.types";
import type { LibraryData } from "../types/library";

type SavedAlbum = Pick<Tables<"albums">, "id" | "created_at" | "updated_at">;
type SavedListen = Pick<
  Tables<"listening_entries">,
  "id" | "created_at" | "updated_at" | "listened_at"
>;

const savedAlbum = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
}) satisfies z.ZodType<SavedAlbum>;
const savedListen = savedAlbum.extend({
  listened_at: z.string(),
}) satisfies z.ZodType<SavedListen>;
const savedLibraryResult = z.object({
  albums: z.array(savedAlbum).default([]),
  artists: z
    .array(
      savedAlbum.pick({ id: true, updated_at: true }).extend({
        updated_at: z.iso.datetime({ offset: true }).optional(),
      }),
    )
    .default([]),
  listening_entries: z.array(savedListen).default([]),
});

// The RPC returns full rows for all tables. Consume only timestamp projections;
// validate the whole projection before changing the caller's local model.
export function reconcileLibraryTimestamps(
  library: LibraryData,
  value: unknown,
): void {
  const parsed = savedLibraryResult.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "The saved library response is invalid. Refresh your library before retrying.",
    );
  const savedAlbums = new Map(parsed.data.albums.map((row) => [row.id, row]));
  const savedEntries = new Map(
    parsed.data.listening_entries.map((row) => [row.id, row]),
  );

  const savedArtists = new Map(
    parsed.data.artists.map((row) => [row.id, row.updated_at]),
  );
  for (const artist of library.artists) {
    const updatedAt = savedArtists.get(artist.id);
    if (updatedAt) artist.updatedAt = new Date(updatedAt).toISOString();
  }

  for (const album of library.albums) {
    const saved = savedAlbums.get(album.id);
    if (saved) {
      album.createdAt = saved.created_at;
      album.updatedAt = saved.updated_at;
    }
    for (const entry of album.listeningEntries) {
      const saved = savedEntries.get(entry.id);
      if (saved) {
        entry.createdAt = saved.created_at;
        entry.updatedAt = saved.updated_at;
        entry.listenedAt = saved.listened_at;
      }
    }
  }
}
