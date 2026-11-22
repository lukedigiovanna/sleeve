import { findCountry, matchesCountry } from "./countries.ts";
import type { LibraryData } from "../types/library";
import { includesGenre } from "./genres.ts";

export const categoryFields = [
  "genres",
  "artists",
  "country",
  "instruments",
] as const;
export type CategoryField = (typeof categoryFields)[number];
export interface CategoryChoice {
  id: string;
  name: string;
  count: number;
}

export function categoryName(
  data: LibraryData,
  field: CategoryField,
  id: string,
): string | undefined {
  if (field === "country") return findCountry(id)?.name;
  return data[field].find((item) => item.id === id)?.name;
}

export function categoryChoices(
  data: LibraryData,
  field: CategoryField,
  selected: readonly string[],
  query: string,
  scope: "library" | "artist" = "library",
): CategoryChoice[] {
  const selection = new Set(selected);
  const search = query.trim().toLocaleLowerCase();

  if (field === "country") {
    const counts = new Map<string, CategoryChoice>();
    const credits =
      scope === "artist"
        ? data.artists.map((artist) => [artist])
        : data.albums.map((album) => album.artists);
    for (const artists of credits) {
      const codes = new Set(
        artists.map((artist) => findCountry(artist.country)?.id),
      );
      for (const code of codes) {
        const country = findCountry(code);
        if (
          !country ||
          selection.has(country.id) ||
          !matchesCountry(search, country)
        )
          continue;

        const choice = counts.get(country.id);
        if (choice) choice.count++;
        else
          counts.set(country.id, {
            id: country.id,
            name: country.name,
            count: 1,
          });
      }
    }
    return [...counts.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
  }

  return data[field]
    .filter(
      (item) =>
        !selection.has(item.id) &&
        item.name.toLocaleLowerCase().includes(search),
    )
    .map((item) => {
      const albums = data.albums.filter((album) => {
        switch (field) {
          case "genres":
            return includesGenre(album, item.id, data.genres);
          case "artists":
            return album.artists.some(
              (artist) => artist.id === item.id && artist.role === "primary",
            );
          case "instruments":
            return album.instruments.some(
              (instrument) => instrument.id === item.id,
            );
        }
      });
      const count =
        scope === "artist"
          ? new Set(
              albums.flatMap((album) =>
                album.artists.map((artist) => artist.id),
              ),
            ).size
          : albums.length;
      return { id: item.id, name: item.name, count };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
