import { icon } from "./icons";

export type BrowseScope = "library" | "artist";

function filterLabel(count: number): string {
  return `Filters${count ? `, ${count} active` : ""}`;
}

function renderFilterCount(count: number): string {
  return count
    ? /* HTML */ `<span class="genre-filter-count">${count}</span>`
    : "";
}

export function updateFilterCount(root: ParentNode, count: number): void {
  const summary = root.querySelector(".genre-filter-dropdown > summary");
  if (!summary) return;

  summary.setAttribute("aria-label", filterLabel(count));
  summary.querySelector(".genre-filter-count")?.remove();
  summary.insertAdjacentHTML("beforeend", renderFilterCount(count));
}

export function renderFilterControls(
  content: string,
  scope: BrowseScope,
): string {
  return /* HTML */ `<div class="library-filter-controls">
    ${content}
    <button
      class="button secondary"
      type="button"
      data-action="clear-${scope}-filters"
    >
      Clear filters
    </button>
  </div>`;
}

export function renderCatalogFilters(
  content: string,
  activeCount: number,
): string {
  return /* HTML */ `<details class="genre-filter-dropdown">
    <summary class="button secondary" aria-label="${filterLabel(activeCount)}">
      ${icon("filter", 18)}<span class="genre-filter-text">Filters</span
      >${renderFilterCount(activeCount)}
    </summary>
    <div class="genre-filter-panel">
      <p>Filters</p>
      ${content}
    </div>
  </details>`;
}
