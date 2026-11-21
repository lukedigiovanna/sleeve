import { artistIdentity } from "./artistIdentity.ts";
import { upgradeGenre } from "./genres.ts";
import {
  isDemoAlbums,
  isDemoInstrumentCatalog,
  isDemoArtistCatalog,
  isDemoGenreCatalog,
} from "./storageValidation.ts";
import type {
  Album,
  AlbumInstrument,
  Instrument,
  Artist,
  Genre,
} from "../types/albums";
import { mockAlbums } from "../data/mockData.ts";
import { makeId } from "./id.ts";

// Version the demo separately from both the standalone prototype and future account data.
const storageKey = "sleeve-demo-v1";
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export function readAlbums(): Album[] {
  try {
    const snapshot: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "null",
    );
    const saved =
      object(snapshot) && !Array.isArray(snapshot) ? snapshot.albums : snapshot;
    if (isDemoAlbums(saved)) {
      // Preserve instrumentation entered in older demo versions, at album scope.
      const known = new Map(
        saved
          .flatMap((album) => album.instruments)
          .map((item) => [item.name.toLowerCase(), item]),
      );
      return saved.map((album) => {
        const instruments = new Map(
          album.instruments.map((item) => [item.id, item]),
        );
        const listeningEntries = album.listeningEntries.map((entry) => {
          const { instruments: legacy, ...listen } = entry as typeof entry & {
            instruments?: string[];
          };
          if (strings(legacy))
            for (const name of legacy) {
              const trimmed = name.trim();
              if (!trimmed) continue;
              const key = trimmed.toLowerCase();
              const item: AlbumInstrument = known.get(key) ?? {
                id: makeId(),
                name: trimmed,
                notes: null,
                categories: [],
              };
              known.set(key, item);
              instruments.set(item.id, item);
            }
          return listen;
        });
        return {
          ...album,
          instruments: [...instruments.values()],
          listeningEntries,
        };
      });
    }
  } catch {
    // Keep the fixture library usable if storage is blocked or malformed.
  }
  return structuredClone(mockAlbums);
}

export function readInstrumentCatalog(albums: Album[]): Instrument[] {
  const linked: Instrument[] = albums
    .flatMap((album) => album.instruments)
    .map(({ id, name, categories, imageUrl }) => ({
      id,
      name,
      categories,
      imageUrl,
    }));
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "null",
    );
    if (isDemoInstrumentCatalog(saved)) {
      return [
        ...new Map(
          linked.concat(saved.instruments).map((item) => [item.id, item]),
        ).values(),
      ];
    }
  } catch {
    // Existing albums still supply a catalog when browser storage is unavailable.
  }
  return [...new Map(linked.map((item) => [item.id, item])).values()];
}

export function saveAlbums(
  albums: Album[],
  instruments: Instrument[],
  artists: Artist[],
  genres: Genre[],
): boolean {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ albums, instruments, artists, genres }),
    );
    return true;
  } catch {
    return false;
  }
}

// Upgrade older demos by sharing artist identities across album credits.
export function readArtistCatalog(albums: Album[]): Artist[] {
  let saved: Artist[] = [];
  try {
    const snapshot: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "null",
    );
    if (isDemoArtistCatalog(snapshot)) saved = snapshot.artists;
  } catch {
    /* Albums still supply the catalog. */
  }
  const catalog = new Map(saved.map((item) => [item.id, item]));
  for (const album of albums)
    for (const credit of album.artists) {
      const existing =
        catalog.get(credit.id) ??
        [...catalog.values()].find((item) =>
          credit.musicbrainzId
            ? item.musicbrainzId === credit.musicbrainzId
            : item.name.toLowerCase() === credit.name.toLowerCase(),
        );
      const artist = existing ?? {
        id: credit.id,
        name: credit.name,
        sortName: credit.sortName,
        country: credit.country,
        photoUrl: credit.photoUrl,
        musicbrainzId: credit.musicbrainzId,
      };
      catalog.set(artist.id, artist);
      Object.assign(credit, artistIdentity(artist));
    }
  return [...catalog.values()];
}

export function readGenreCatalog(albums: Album[]): Genre[] {
  let saved: Genre[] = [];
  try {
    const snapshot: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "null",
    );
    if (isDemoGenreCatalog(snapshot)) saved = snapshot.genres.map(upgradeGenre);
  } catch {
    /* Albums supply the catalog. */
  }
  const catalog = new Map(saved.map((g) => [g.id, g]));
  for (const album of albums)
    for (const credit of album.genres) {
      const existing = [...catalog.values()].find(
        (g) => g.name.toLowerCase() === credit.name.toLowerCase(),
      );
      const genre = existing ?? upgradeGenre(credit);
      catalog.set(genre.id, genre);
      Object.assign(credit, genre);
    }
  return [...catalog.values()];
}
