import { renderResultsMeta } from "../components/resultsMeta";
import { compareSortValues, type SortSelection } from "../app/librarySort";
import {
  matchesInstrumentCategory,
  type BrowseFilters,
} from "../app/libraryCategoryFilters";
import {
  instrumentSorting,
  renderSortDropdown,
  type CatalogBrowseSort,
} from "../components/sortOptions";
import { renderCategoryFilter } from "../components/libraryCategoryFilters";
import { renderFilterChips } from "../components/libraryFilters";
import {
  catalogImage,
  catalogSummary,
  catalogStats,
} from "../components/catalogSummary";
import { renderCatalogHeading } from "../components/catalogHeading";
import {
  renderCatalogFilters,
  renderFilterControls,
} from "../components/catalogFilters";
import type { Album, Instrument, InstrumentCategory } from "../types/albums";
import { escapeHtml } from "../components/html";
import { icon } from "../components/icons";
import { chips } from "../components/presentation";
import { renderAlbumGrid } from "../components/albumGrid";
import {
  albumsUsing,
  categoryLabel,
  instrumentCategories,
  instrumentUrl,
} from "../app/instruments";
import { matches } from "../app/search";
import type { LibraryData } from "../types/library";

export const instrumentFilterFields = ["instrumentCategory"] as const;
export const defaultInstrumentSort = {
  category: "count",
  direction: "descending",
} as const satisfies SortSelection<CatalogBrowseSort>;

export interface InstrumentBrowseState {
  query: string;
  filters: Pick<BrowseFilters, (typeof instrumentFilterFields)[number]>;
  sort: SortSelection<CatalogBrowseSort> | null;
}

export function categoryFields(
  selected: InstrumentCategory[] = [],
  name = "category",
): string {
  return /* HTML */ `<fieldset class="category-fields">
    <legend>Categories <span class="muted">(optional)</span></legend>
    <p class="form-hint">Choose all that apply.</p>
    <div class="category-options">
      ${instrumentCategories.map((category) => /* HTML */ `<label><input type="checkbox" name="${name}" value="${category}" ${selected.includes(category) ? "checked" : ""} /><span>${categoryLabel(category)}</span></label>`).join("")}
    </div>
  </fieldset>`;
}

export function renderInstrumentsView(
  state: InstrumentBrowseState,
  data: LibraryData,
): string {
  return /* HTML */ `<section
    class="instrument-page catalog-page instruments-page"
    aria-labelledby="page-title"
  >
    ${renderCatalogHeading("Instruments", "instrument")}
    <div class="toolbar library-toolbar">
      <label class="search-field"
        >${icon("search")}<span class="sr-only">Search instruments</span
        ><input
          id="instruments-search"
          type="search"
          placeholder="Search instruments"
          value="${escapeHtml(state.query)}"
      /></label>
      ${renderCatalogFilters(
        renderFilterControls(
          renderCategoryFilter(
            "instrumentCategory",
            state.filters,
            data,
            "instrument",
          ),
          "instrument",
        ),
        Object.keys(state.filters).length,
      )}
      ${renderSortDropdown(instrumentSorting, state.sort)}
    </div>
    <div id="instrument-filter-chips" class="library-filter-chips">
      ${renderFilterChips(state.filters, data, "instrument")}
    </div>
    ${renderResultsMeta("instruments")}
    <div id="instruments-list"></div>
  </section>`;
}

export function updateInstrumentsView(
  { instruments, albums }: LibraryData,
  { query, filters, sort }: InstrumentBrowseState,
  root: ParentNode = document,
): void {
  const order = sort ?? defaultInstrumentSort;
  const categoryIds = filters.instrumentCategory?.ids;
  const results = instruments
    .filter(
      (item) =>
        matches(query, item.name) &&
        (!categoryIds?.length ||
          categoryIds.some((id) =>
            matchesInstrumentCategory(item.categories, id),
          )),
    )
    .map((item) => {
      const stats = catalogStats(albumsUsing(albums, item.id));
      return {
        item,
        name: item.name,
        count: stats.count,
        recent: stats.recent || null,
        updated: stats.updated || null,
      };
    })
    .sort(
      (a, b) =>
        compareSortValues(
          a[order.category],
          b[order.category],
          order.direction,
        ) || a.name.localeCompare(b.name),
    );

  root.querySelector("#instruments-count")!.textContent =
    `${results.length} ${results.length === 1 ? "instrument" : "instruments"}`;
  root.querySelector("#instruments-list")!.innerHTML = results.length
    ? /* HTML */ `<ul
        class="divided-rows catalog-row-list instrument-catalog-list"
      >
        ${results.map(({ item, count }) => renderInstrumentRow(item, count)).join("")}
      </ul>`
    : renderInstrumentEmpty(Boolean(instruments.length));
}

function renderInstrumentRow(item: Instrument, count: number): string {
  const categories =
    item.categories.map(categoryLabel).join(", ") || "Uncategorized";
  return /* HTML */ `<li>
    <a
      class="catalog-row instrument-catalog-row"
      href="${instrumentUrl(item.id)}"
    >
      ${catalogImage(item.name, item.imageUrl, false, item.categories)}
      <span class="catalog-row-identity instrument-row-identity">
        <strong class="catalog-row-name">${escapeHtml(item.name)}</strong>
        <span class="muted instrument-row-category"
          >${escapeHtml(categories)}</span
        >
      </span>
      <span class="catalog-row-count"
        >${count} ${count === 1 ? "album" : "albums"}</span
      >
      ${icon("chevron", 16)}
    </a>
  </li>`;
}

function renderInstrumentEmpty(hasItems: boolean): string {
  return /* HTML */ `<div class="empty">
    <h2>
      ${hasItems ? "No matching instruments" : "Start your instrument catalog"}
    </h2>
    <p>
      ${hasItems ? "Try another search or adjust your filters." : "Add an instrument here or while editing an album."}
    </p>
    ${hasItems ? /* HTML */ `<button type="button" class="button secondary" data-action="clear-instrument-filters">Clear filters</button>` : ""}
  </div>`;
}

export function renderInstrumentDetail(
  item: Instrument,
  albums: Album[],
): string {
  const used = albumsUsing(albums, item.id).sort((a, b) =>
    (a.sortTitle || a.title).localeCompare(b.sortTitle || b.title),
  );
  return /* HTML */ `<section
    class="instrument-page"
    aria-labelledby="page-title"
  >
    <a class="back-link" href="#instruments"
      >${icon("back", 17)} Back to instruments</a
    >
    <div class="instrument-page-heading">
      <div>
        <div class="catalog-detail-summary">
          ${catalogImage(item.name, item.imageUrl, false, item.categories)}${catalogSummary(used, false)}
        </div>
        <h1 id="page-title">${escapeHtml(item.name)}</h1>
        <div class="tags">
          ${item.categories.length ? chips(item.categories.map(categoryLabel)) : /* HTML */ `<span class="muted">Uncategorized</span>`}
        </div>
      </div>
      <button
        type="button"
        class="button secondary"
        data-action="edit-catalog-instrument"
      >
        ${icon("edit", 16)} Edit instrument
      </button>
    </div>
    <section
      class="instrument-albums"
      aria-labelledby="instrument-albums-title"
    >
      <div class="detail-heading">
        <h2 id="instrument-albums-title">Albums featuring this instrument</h2>
        <span class="count-pill">${used.length}</span>
      </div>
      ${
        used.length
          ? renderAlbumGrid(used)
          : /* HTML */ `<div class="empty detail-empty">
              <h3>No albums feature this instrument yet</h3>
              <p>
                This instrument stays in your catalog until you add it to an
                album or delete it.
              </p>
            </div>`
      }
    </section>
    <div class="instrument-delete">
      <button
        type="button"
        class="button secondary danger"
        data-action="delete-catalog-instrument"
        ${used.length ? 'disabled aria-describedby="instrument-delete-help"' : ""}
      >
        Delete instrument
      </button>
      <p id="instrument-delete-help" class="muted">
        ${used.length ? "Remove this instrument from its albums before deleting it." : "Unused instruments can be deleted from your catalog."}
      </p>
    </div>
  </section>`;
}
