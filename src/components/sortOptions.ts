import { cycleSort, type SortSelection } from "../app/librarySort.ts";
import type { BrowseScope } from "./catalogFilters";
import { icon } from "./icons.ts";

export const catalogSortOptions = [
  "albums",
  "rating",
  "recent",
  "updated",
  "name",
] as const;

export type CatalogSort = (typeof catalogSortOptions)[number];

export function isCatalogSort(value: string): value is CatalogSort {
  return catalogSortOptions.some((option) => option === value);
}

const sortLabels = {
  albums: "Most albums",
  rating: "Highest rated",
  recent: "Recently logged",
  updated: "Recently updated",
  name: "Name",
  title: "Album title",
  year: "Release year",
};

const librarySortLabels = {
  recent: "Last logged",
  created: "Date added",
  title: "Album title",
  rating: "Rating",
  year: "Release year",
};

export type LibrarySort = keyof typeof librarySortLabels;

const artistSortLabels = {
  updated: "Last updated",
  recent: "Last logged",
  name: "Alphabetical",
  count: "Album count",
};
export type ArtistSort = keyof typeof artistSortLabels;

export const librarySorting = {
  scope: "library",
  labels: librarySortLabels,
} as const;
export const artistSorting = {
  scope: "artist",
  labels: artistSortLabels,
} as const;

interface BrowseSort<Category extends string> {
  scope: BrowseScope;
  labels: Record<Category, string>;
}

function renderSortChoices<Category extends string>(
  { scope, labels }: BrowseSort<Category>,
  selected: SortSelection<Category> | null,
): string {
  const nextActions = {
    ascending: "Sort descending",
    descending: "Turn off sorting",
    off: "Sort ascending",
  };
  const choices = (Object.keys(labels) as Category[])
    .map((value) => {
      const direction =
        selected?.category === value ? selected.direction : null;
      return /* HTML */ `<button
        type="button"
        class="library-sort-choice"
        data-action="${scope}-sort"
        data-sort="${value}"
        aria-pressed="${direction !== null}"
        aria-label="${labels[value]}, ${direction ?? "off"}"
        title="${nextActions[direction ?? "off"]}"
      >
        <span>${labels[value]}</span>
        <span
          class="library-sort-direction ${direction ?? ""}"
          aria-hidden="true"
          >${direction ? icon("arrow", 14) : ""}</span
        >
      </button>`;
    })
    .join("");
  return /* HTML */ `<p class="library-sort-hint">Sort</p>
    ${choices}`;
}

export function renderSortDropdown<Category extends string>(
  options: BrowseSort<Category>,
  selected: SortSelection<Category> | null,
): string {
  const label = options.scope === "artist" ? "Sort artists" : "Sort albums";
  return /* HTML */ `<details class="library-sort-dropdown">
    <summary class="button secondary library-sort" aria-label="${label}">
      ${icon("sort", 18)}<span class="library-sort-text">Sort</span>
    </summary>
    <div class="library-sort-panel" role="group" aria-label="${label}">
      ${renderSortChoices(options, selected)}
    </div>
  </details>`;
}

export function selectBrowseSort<Category extends string>(
  button: HTMLButtonElement,
  options: BrowseSort<Category>,
  current: SortSelection<Category> | null,
): SortSelection<Category> | null | undefined {
  const category = (Object.keys(options.labels) as Category[]).find(
    (value) => value === button.dataset.sort,
  );
  const panel = button.closest(".library-sort-panel");
  if (!category || !panel) return undefined;

  const next = cycleSort(current, category);
  panel.innerHTML = renderSortChoices(options, next);
  panel
    .querySelector<HTMLElement>(`[data-sort="${category}"]`)
    ?.focus({ preventScroll: true });
  return next;
}

export function renderSortOptions(
  options: readonly (keyof typeof sortLabels)[],
  selected: string,
): string {
  return options
    .map(
      (value) =>
        /* HTML */ `<option
          value="${value}"
          ${value === selected ? "selected" : ""}
        >
          ${sortLabels[value]}
        </option>`,
    )
    .join("");
}
