import type { LibrarySort } from "../components/sortOptions.ts";
import { latest, latestRatedListen } from "../components/presentation.ts";
import type { Album } from "../types/albums.ts";

export interface SortSelection<Category extends string> {
  category: Category;
  direction: "ascending" | "descending";
}

export type LibrarySortSelection = SortSelection<LibrarySort>;

export function cycleSort<Category extends string>(
  current: SortSelection<Category> | null,
  category: Category,
): SortSelection<Category> | null {
  if (current?.category !== category)
    return { category, direction: "ascending" };
  if (current.direction === "ascending")
    return { category, direction: "descending" };
  return null;
}

export const cycleLibrarySort = cycleSort<LibrarySort>;

export function dateAddedSortValue(
  createdAt: string | undefined,
): number | null {
  if (typeof createdAt !== "string") return null;
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function sortValue(
  album: Album,
  category: LibrarySort,
): string | number | null {
  switch (category) {
    case "recent":
      return latest(album)?.listenedAt ?? null;
    case "created":
      return dateAddedSortValue(album.createdAt);
    case "title":
      return album.sortTitle || album.title;
    case "rating":
      return latestRatedListen(album)?.rating ?? null;
    case "year":
      return album.releaseYear;
  }
}

export function compareLibraryAlbums(
  a: Album,
  b: Album,
  sort: LibrarySortSelection,
): number {
  return (
    compareSortValues(
      sortValue(a, sort.category),
      sortValue(b, sort.category),
      sort.direction,
    ) || (a.sortTitle || a.title).localeCompare(b.sortTitle || b.title)
  );
}

export function compareSortValues(
  left: string | number | null,
  right: string | number | null,
  direction: SortSelection<string>["direction"],
): number {
  if (left === null && right !== null) return 1;
  if (right === null && left !== null) return -1;

  let comparison = 0;
  if (typeof left === "number" && typeof right === "number")
    comparison = left - right;
  if (typeof left === "string" && typeof right === "string")
    comparison = left.localeCompare(right);

  return direction === "ascending" ? comparison : -comparison;
}
