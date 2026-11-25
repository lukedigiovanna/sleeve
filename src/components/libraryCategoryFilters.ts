import type { LibraryData } from "../types/library";
import {
  categoryChoices,
  categoryName,
  type CategoryField,
  type BrowseFilters,
} from "../app/libraryCategoryFilters";
import { escapeHtml } from "./html";
import { icon } from "./icons";
import type { BrowseScope } from "./catalogFilters";

export const categoryFilterLabels: Record<CategoryField, string> = {
  genres: "Genres",
  artists: "Artists",
  country: "Country",
  instruments: "Instruments",
  instrumentCategory: "Categories",
};

function renderChoices(
  field: CategoryField,
  filters: BrowseFilters,
  data: LibraryData,
  query: string,
  scope: BrowseScope,
): string {
  const choices = categoryChoices(
    data,
    field,
    filters[field]?.ids ?? [],
    query,
    scope,
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
          data-action="add-${scope}-category"
          data-category="${field}"
          data-id="${escapeHtml(item.id)}"
          aria-label="Add ${escapeHtml(item.name)}"
          title="${item.count} ${choiceUnit(scope, item.count)}"
        >
          ${escapeHtml(item.name)}<span class="category-choice-count"
            >${item.count}</span
          >
        </button>`,
    )
    .join("");
}

function choiceUnit(scope: BrowseScope, count: number): string {
  const unit = scope === "library" ? "album" : scope;
  return count === 1 ? unit : `${unit}s`;
}

function renderSelected(
  field: CategoryField,
  filters: BrowseFilters,
  data: LibraryData,
  scope: BrowseScope,
): string {
  return (filters[field]?.ids ?? [])
    .map((id) => {
      const name = categoryName(data, field, id) ?? "Unavailable";
      return /* HTML */ `<button
        type="button"
        class="button secondary category-filter-pill selected"
        data-action="remove-${scope}-category"
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
  filters: BrowseFilters,
  data: LibraryData,
  scope: BrowseScope = "library",
): string {
  return /* HTML */ `<section
    class="category-filter"
    data-category="${field}"
    aria-labelledby="${scope}-${field}-label"
  >
    <div class="category-filter-heading">
      <label id="${scope}-${field}-label" for="${scope}-${field}-search"
        >${categoryFilterLabels[field]}</label
      >
      <div class="category-filter-search">
        ${icon("search", 15)}<input
          type="search"
          id="${scope}-${field}-search"
          data-category-search="${field}"
          placeholder="Search…"
          aria-label="Search ${field === "country" ? "artist countries" : field === "instrumentCategory" ? "categories" : field}"
        />
      </div>
    </div>
    <div
      class="category-filter-pills"
      data-category-results
      role="group"
      aria-label="${categoryFilterLabels[field]} suggestions"
    >
      ${renderChoices(field, filters, data, "", scope)}
    </div>
    <div
      class="category-filter-pills"
      data-category-selected
      role="group"
      aria-label="Selected ${field}"
      ${filters[field]?.ids.length ? "" : "hidden"}
    >
      ${renderSelected(field, filters, data, scope)}
    </div>
    <span class="sr-only" data-category-status role="status"></span>
  </section>`;
}

function updateCategoryFilter(
  root: ParentNode,
  field: CategoryField,
  filters: BrowseFilters,
  data: LibraryData,
  scope: BrowseScope = "library",
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

  results.innerHTML = renderChoices(field, filters, data, query, scope);
  selected.innerHTML = renderSelected(field, filters, data, scope);
  selected.hidden = !filters[field]?.ids.length;
  results.scrollLeft = resultsScroll;
  selected.scrollLeft = selectedScroll;
  group.querySelector<HTMLElement>("[data-category-status]")!.textContent =
    `${results.querySelectorAll("button").length} choices, ${filters[field]?.ids.length ?? 0} selected`;
}

export interface CategoryFilterControls {
  scope: BrowseScope;
  fields: readonly CategoryField[];
  filters: BrowseFilters;
  data: LibraryData;
}

export function searchCategoryFilter(
  input: HTMLInputElement,
  controls: CategoryFilterControls,
): void {
  const root = input.closest(".library-filter-controls");
  const field = controls.fields.find(
    (value) => value === input.dataset.categorySearch,
  );
  if (root && field && input.id === `${controls.scope}-${field}-search`)
    updateCategoryFilter(
      root,
      field,
      controls.filters,
      controls.data,
      controls.scope,
    );
}

export function selectCategoryFilter(
  button: HTMLButtonElement,
  { scope, fields, filters, data }: CategoryFilterControls,
): boolean {
  const root = button.closest(".library-filter-controls");
  const group = button.closest(".category-filter");
  const field = fields.find((value) => value === button.dataset.category);
  const id = button.dataset.id;
  if (!root || !group || !field || !id || !categoryName(data, field, id))
    return false;

  const ids = new Set(filters[field]?.ids ?? []);
  const adding = button.dataset.action === `add-${scope}-category`;
  if (adding) ids.add(id);
  else ids.delete(id);
  if (ids.size) filters[field] = { ids: [...ids] };
  else delete filters[field];

  updateCategoryFilter(root, field, filters, data, scope);
  const buttons = group.querySelectorAll<HTMLButtonElement>(
    adding
      ? "[data-category-selected] button"
      : "[data-category-results] button",
  );
  const focus =
    [...buttons].find((candidate) => candidate.dataset.id === id) ??
    buttons[0] ??
    group.querySelector("input");
  focus?.focus({ preventScroll: true });
  return true;
}
