import { supabase } from "./supabase";
import { getAlbums } from "./albums";
import type { LibraryData } from "../types/library";

import { readAll } from "./readAll";

// RLS scopes all of these reads to the authenticated user's records.
export async function getLibrary(): Promise<LibraryData> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      fetchLibrary(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Library refresh timed out.")),
          12_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

async function fetchLibrary(): Promise<LibraryData> {
  const [albums, artistRows, genreRows, parentRows, instrumentRows] =
    await Promise.all([
      getAlbums(),
      readAll((from, to) =>
        supabase
          .from("artists")
          .select(
            "id,name,sort_name,country,musicbrainz_id,photo_url,created_at,updated_at,artist_links(id,url,label)",
          )
          .order("created_at", { referencedTable: "artist_links" })
          .order("id", { referencedTable: "artist_links" })
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        supabase.from("genres").select("id,name").order("id").range(from, to),
      ),
      readAll((from, to) =>
        supabase
          .from("genre_parents")
          .select("parent_genre_id,child_genre_id")
          .order("parent_genre_id")
          .order("child_genre_id")
          .range(from, to),
      ),
      readAll((from, to) =>
        supabase
          .from("instruments")
          .select("id,name,image_url,instrument_categories(category)")
          .order("id")
          .range(from, to),
      ),
    ]);
  return {
    albums,
    artists: artistRows.map((row) => ({
      id: row.id,
      name: row.name,
      sortName: row.sort_name,
      photoUrl: row.photo_url,
      country: row.country,
      musicbrainzId: row.musicbrainz_id,
      links: row.artist_links,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    })),
    genres: genreRows.map((row) => ({
      id: row.id,
      name: row.name,
      parentGenreIds: parentRows
        .filter((edge) => edge.child_genre_id === row.id)
        .map((edge) => edge.parent_genre_id),
    })),
    instruments: instrumentRows.map((row) => ({
      id: row.id,
      name: row.name,
      imageUrl: row.image_url,
      categories: row.instrument_categories.map((entry) => entry.category),
    })),
  };
}
