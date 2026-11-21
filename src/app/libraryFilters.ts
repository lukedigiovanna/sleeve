import { findCountry } from "./countries.ts";
import type { Album, Genre, VinylStatus } from "../types/albums";
import { latestRatedListen } from "../components/presentation.ts";
import { includesGenre } from "./genres.ts";

export type NumericOperator = "eq" | "gte" | "lte" | "between" | "unset";
export type NumericFilter =
  | { operator: "unset" }
  | { operator: "eq" | "gte" | "lte"; value: number }
  | { operator: "between"; min: number; max: number };
export type CategoryMode = "any" | "all" | "exact";
export interface CategoryFilter {
  mode: CategoryMode;
  ids: readonly string[];
}
export interface CategorySelection {
  ids: readonly string[];
}
export interface LibraryFilters {
  rating?: NumericFilter;
  releaseYear?: NumericFilter;
  genres?: CategorySelection;
  artists?: CategorySelection;
  country?: CategorySelection;
  instruments?: CategorySelection;
  vinylStatus?: readonly VinylStatus[];
}
export type FilterField = keyof LibraryFilters;
export const filterFields: readonly FilterField[] = [
  "rating",
  "releaseYear",
  "genres",
  "artists",
  "country",
  "instruments",
  "vinylStatus",
];

export function matchesNumeric(
  value: number | null | undefined,
  filter: NumericFilter,
): boolean {
  if (filter.operator === "unset") return value == null;
  if (value == null) return false;

  switch (filter.operator) {
    case "eq":
      return value === filter.value;
    case "gte":
      return value >= filter.value;
    case "lte":
      return value <= filter.value;
    case "between":
      return value >= filter.min && value <= filter.max;
  }
}

export function matchesCategory(
  values: readonly string[],
  filter: CategoryFilter,
  contains = (id: string): boolean => values.includes(id),
): boolean {
  if (!filter.ids.length) return true;

  switch (filter.mode) {
    case "any":
      return filter.ids.some(contains);
    case "all":
      return filter.ids.every(contains);
    case "exact":
      return (
        new Set(values).size === new Set(filter.ids).size &&
        filter.ids.every((id) => values.includes(id))
      );
  }
}

function matchesRating(album: Album, filter?: NumericFilter): boolean {
  if (!filter) return true;

  const listen = latestRatedListen(album);
  return matchesNumeric(listen ? listen.rating / 2 : null, filter);
}

export function matchesLibraryFilters(
  album: Album,
  filters: LibraryFilters,
  genres: Genre[],
): boolean {
  const countryIds = filters.country?.ids;

  return (
    matchesRating(album, filters.rating) &&
    (!filters.releaseYear ||
      matchesNumeric(album.releaseYear, filters.releaseYear)) &&
    (!filters.genres ||
      matchesCategory(
        album.genres.map((item) => item.id),
        { mode: "any", ids: filters.genres.ids },
        (id) => includesGenre(album, id, genres),
      )) &&
    (!filters.artists ||
      matchesCategory(
        album.artists
          .filter((item) => item.role === "primary")
          .map((item) => item.id),
        { mode: "any", ids: filters.artists.ids },
      )) &&
    (!countryIds?.length ||
      album.artists.some((artist) =>
        countryIds.includes(findCountry(artist.country)?.id ?? ""),
      )) &&
    (!filters.instruments ||
      matchesCategory(
        album.instruments.map((item) => item.id),
        { mode: "all", ids: filters.instruments.ids },
      )) &&
    (!filters.vinylStatus?.length ||
      (album.vinylStatus != null &&
        filters.vinylStatus.includes(album.vinylStatus)))
  );
}
