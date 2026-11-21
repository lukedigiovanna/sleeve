import type { LibraryData } from "../types/library";
import type { Tables } from "../types/database.types";

export type LibraryTable =
  | "artists"
  | "artist_links"
  | "genres"
  | "genre_parents"
  | "instruments"
  | "albums"
  | "instrument_categories"
  | "album_artists"
  | "album_genres"
  | "album_instruments"
  | "album_links"
  | "listening_entries";

type DeltaRow<Table extends LibraryTable> = Omit<
  Tables<Table>,
  "user_id" | "created_at" | "updated_at"
>;
type LibraryRows = { [Table in LibraryTable]: DeltaRow<Table>[] };
type TableDelta<Row> = {
  saved: Row[];
  deleted: Row[];
};
export type LibraryDelta = {
  [Table in LibraryTable]: TableDelta<DeltaRow<Table>>;
};

const keys: { [Table in LibraryTable]: readonly (keyof DeltaRow<Table>)[] } = {
  artists: ["id"],
  artist_links: ["id"],
  genres: ["id"],
  genre_parents: ["parent_genre_id", "child_genre_id"],
  instruments: ["id"],
  albums: ["id"],
  instrument_categories: ["instrument_id", "category"],
  album_artists: ["album_id", "artist_id"],
  album_genres: ["album_id", "genre_id"],
  album_instruments: ["album_id", "instrument_id"],
  album_links: ["id"],
  listening_entries: ["id"],
};

function rows(library: LibraryData): LibraryRows {
  const result: LibraryRows = {
    artists: [],
    artist_links: [],
    genres: [],
    genre_parents: [],
    instruments: [],
    albums: [],
    instrument_categories: [],
    album_artists: [],
    album_genres: [],
    album_instruments: [],
    album_links: [],
    listening_entries: [],
  };
  result.artists = library.artists.map((a) => ({
    id: a.id,
    name: a.name,
    sort_name: a.sortName || null,
    photo_url: a.photoUrl || null,
    country: a.country || null,
    musicbrainz_id: a.musicbrainzId || null,
  }));
  result.artist_links = library.artists.flatMap((artist) =>
    (artist.links ?? []).map((link) => ({
      id: link.id,
      artist_id: artist.id,
      url: link.url,
      label: link.label || null,
    })),
  );
  result.genres = library.genres.map((g) => ({
    id: g.id,
    name: g.name,
  }));
  result.genre_parents = library.genres.flatMap((genre) =>
    [...new Set(genre.parentGenreIds)].map((parentId) => ({
      parent_genre_id: parentId,
      child_genre_id: genre.id,
    })),
  );
  result.instruments = library.instruments.map((i) => ({
    id: i.id,
    name: i.name,
    image_url: i.imageUrl || null,
  }));
  result.instrument_categories = library.instruments.flatMap((i) =>
    i.categories.map((category) => ({ instrument_id: i.id, category })),
  );
  for (const a of library.albums) {
    result.albums.push({
      id: a.id,
      title: a.title,
      record_label: a.recordLabel || null,
      vinyl_status: a.vinylStatus ?? null,
      sort_title: a.sortTitle || null,
      release_year: a.releaseYear,
      artwork_url: a.artworkUrl || null,
      musicbrainz_release_group_id: a.musicbrainzReleaseGroupId || null,
    });
    result.album_artists.push(
      ...a.artists.map((c) => ({
        album_id: a.id,
        artist_id: c.id,
        role: c.role,
        position: c.position,
      })),
    );
    result.album_genres.push(
      ...a.genres.map((g) => ({
        album_id: a.id,
        genre_id: g.id,
        is_primary: g.isPrimary,
      })),
    );
    result.album_instruments.push(
      ...a.instruments.map((i) => ({
        album_id: a.id,
        instrument_id: i.id,
        notes: i.notes || null,
      })),
    );
    result.album_links.push(
      ...a.links.map((l) => ({
        id: l.id,
        album_id: a.id,
        url: l.url,
        label: l.label || null,
      })),
    );
    result.listening_entries.push(
      ...a.listeningEntries.map((e) => ({
        id: e.id,
        album_id: a.id,
        rating: e.rating,
        listened_at: new Date(e.listenedAt).toISOString(),
        notes: e.notes || null,
      })),
    );
  }
  return result;
}

export function libraryDelta(
  before: LibraryData,
  next: LibraryData,
): LibraryDelta {
  const previous = rows(before);
  const current = rows(next);
  return {
    artists: tableDelta("artists", previous, current),
    artist_links: tableDelta("artist_links", previous, current),
    genres: tableDelta("genres", previous, current),
    genre_parents: tableDelta("genre_parents", previous, current),
    instruments: tableDelta("instruments", previous, current),
    albums: tableDelta("albums", previous, current),
    instrument_categories: tableDelta(
      "instrument_categories",
      previous,
      current,
    ),
    album_artists: tableDelta("album_artists", previous, current),
    album_genres: tableDelta("album_genres", previous, current),
    album_instruments: tableDelta("album_instruments", previous, current),
    album_links: tableDelta("album_links", previous, current),
    listening_entries: tableDelta("listening_entries", previous, current),
  };
}

function tableDelta<Table extends LibraryTable>(
  table: Table,
  previous: LibraryRows,
  current: LibraryRows,
): TableDelta<DeltaRow<Table>> {
  const key = (row: DeltaRow<Table>) =>
    JSON.stringify(keys[table].map((column) => row[column]));
  const old = new Map(previous[table].map((row) => [key(row), row]));
  const updated = new Map(current[table].map((row) => [key(row), row]));
  const saved = current[table].filter(
    (row) => JSON.stringify(old.get(key(row))) !== JSON.stringify(row),
  );
  // Replace changed association rows to allow credit reordering and primary
  // genre changes without transient uniqueness violations.
  const replace =
    table.startsWith("album_") || table === "instrument_categories";
  return {
    saved,
    deleted: previous[table].filter(
      (row) =>
        !updated.has(key(row)) ||
        (replace && saved.some((item) => key(item) === key(row))),
    ),
  };
}
