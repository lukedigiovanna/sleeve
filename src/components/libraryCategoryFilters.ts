import type { LibraryData } from "../types/library";
import type { LibraryFilters } from "../app/libraryFilters";
import {
  categoryChoices,
  categoryName,
  type CategoryField,
} from "../app/libraryCategoryFilters";
import { escapeHtml } from "./html";
import { icon } from "./icons";

const labels: Record<CategoryField, string> = {
  genres: "Genres",
  artists: "Artists",
  country: "Country",
  instruments: "Instruments",
};

function renderChoices(
  field: CategoryField,
  filters: LibraryFilters,
  data: LibraryData,
  query: string,
): string {
  const choices = categoryChoices(
    data,
    field,
    filters[field]?.ids ?? [],
    query,
  );
  if (!choices.length)
    return /* HTML */ `<span class="category-filter-empty"
      >${query.trim() ? "No matches" : "No more suggestions"}</span
    >`;

  return choices
    .map(
      (item) =>
        /* HTML */ `<button
          type="button"
          class="button secondary category-filter-pill"
          data-action="add-library-category"
          data-category="${field}"
          data-id="${escapeHtml(item.id)}"
          aria-label="Add ${escapeHtml(item.name)}"
          title="${item.count} ${item.count === 1 ? "album" : "albums"}"
        >
          ${escapeHtml(item.name)}<span class="category-choice-count"
            >${item.count}</span
          >
        </button>`,
    )
    .join("");
}

function renderSelected(
  field: CategoryField,
  filters: LibraryFilters,
  data: LibraryData,
): string {
  return (filters[field]?.ids ?? [])
    .map((id) => {
      const name = categoryName(data, field, id) ?? "Unavailable";
      return /* HTML */ `<button
        type="button"
        class="button secondary category-filter-pill selected"
        data-action="remove-library-category"
        data-category="${field}"
        data-id="${escapeHtml(id)}"
        aria-label="Remove ${escapeHtml(name)}"
      >
        ${escapeHtml(name)}${icon("close", 12)}
      </button>`;
    })
    .join("");
}

export function renderCategoryFilter(
  field: CategoryField,
  filters: LibraryFilters,
  data: LibraryData,
): string {
  return /* HTML */ `<section
    class="category-filter"
    data-category="${field}"
    aria-labelledby="library-${field}-label"
  >
    <div class="category-filter-heading">
      <label id="library-${field}-label" for="library-${field}-search"
        >${labels[field]}</label
      >
      <div class="category-filter-search">
        ${icon("search", 15)}<input
          type="search"
          id="library-${field}-search"
          data-category-search="${field}"
          placeholder="Search…"
          aria-label="Search ${field === "country" ? "artist countries" : field}"
        />
      </div>
    </div>
    <div
      class="category-filter-pills"
      data-category-results
      role="group"
      aria-label="${labels[field]} suggestions"
    >
      ${renderChoices(field, filters, data, "")}
    </div>
    <div
      class="category-filter-pills"
      data-category-selected
      role="group"
      aria-label="Selected ${field}"
      ${filters[field]?.ids.length ? "" : "hidden"}
    >
      ${renderSelected(field, filters, data)}
    </div>
    <span class="sr-only" data-category-status role="status"></span>
  </section>`;
}

export function updateCategoryFilter(
  root: ParentNode,
  field: CategoryField,
  filters: LibraryFilters,
  data: LibraryData,
): void {
  const group = root.querySelector<HTMLElement>(
    `.category-filter[data-category="${field}"]`,
  );
  if (!group) return;
  const query =
    group.querySelector<HTMLInputElement>("input[type=search]")!.value;
  const results = group.querySelector<HTMLElement>("[data-category-results]")!;
  const selected = group.querySelector<HTMLElement>(
    "[data-category-selected]",
  )!;
  const resultsScroll = results.scrollLeft;
  const selectedScroll = selected.scrollLeft;

  results.innerHTML = renderChoices(field, filters, data, query);
  selected.innerHTML = renderSelected(field, filters, data);
  selected.hidden = !filters[field]?.ids.length;
  results.scrollLeft = resultsScroll;
  selected.scrollLeft = selectedScroll;
  group.querySelector<HTMLElement>("[data-category-status]")!.textContent =
    `${results.querySelectorAll("button").length} choices, ${filters[field]?.ids.length ?? 0} selected`;
}
