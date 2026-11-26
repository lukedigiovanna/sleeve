import { renderResultsMeta } from "../components/resultsMeta";
import { renderCatalogSearchRow } from "../components/catalogSearchRow";
import { renderLayoutToggle } from "../components/layoutToggle";
import type { Layout } from "../app/layoutPreferences";
import {
  compareLibraryAlbums,
  type LibrarySortSelection,
} from "../app/librarySort";
import { librarySorting, renderSortDropdown } from "../components/sortOptions";
import type { Genre } from "../types/albums";
import type { LibraryData } from "../types/library";
import {
  matchesLibraryFilters,
  type LibraryFilters,
} from "../app/libraryFilters";
import {
  renderLibraryFilters,
  renderFilterChips,
} from "../components/libraryFilters";
import type { Album } from "../types/albums";
import { icon } from "../components/icons";
import { renderAlbumGrid } from "../components/albumGrid";
import { matches } from "../app/search";

export interface LibraryState {
  query: string;
  filters: LibraryFilters;
  sort: LibrarySortSelection | null;
  layout: Layout;
}

export function renderLibraryView(
  state: LibraryState,
  data: LibraryData,
): string {
  return /* HTML */ `<section class="library" aria-labelledby="page-title">
    <div class="library-heading instrument-page-heading catalog-heading">
      <h1 id="page-title">Your library</h1>
      <button
        type="button"
        class="button library-discover"
        data-action="discover"
      >
        ${icon("sparkle", 16)} Discover
      </button>
    </div>
    ${renderCatalogSearchRow({
      inputId: "library-query",
      label: "Search library",
      placeholder: "Search albums",
      query: state.query,
      filters: {
        content: renderLibraryFilters(state.filters, data),
        activeCount: Object.keys(state.filters).length,
      },
      sort: renderSortDropdown(librarySorting, state.sort),
    })}
    <div id="library-filter-chips" class="library-filter-chips">
      ${renderFilterChips(state.filters, data)}
    </div>
    ${renderResultsMeta("library", { controls: renderLayoutToggle(state.layout) })}
    <div id="library-results"></div>
  </section>`;
}

export function updateLibrary(
  albums: Album[],
  state: LibraryState,
  catalog: Genre[],
  root: ParentNode = document,
): void {
  const list = root.querySelector("#library-results");
  if (!list) return;
  const filtered = albums.filter(
    (album) =>
      matchesLibraryFilters(album, state.filters, catalog) &&
      matches(
        state.query,
        album.title,
        album.sortTitle,
        ...album.artists.map((artist) => artist.name),
        album.releaseYear,
        ...album.genres.map((genre) => genre.name),
      ),
  );
  const sort = state.sort;
  if (sort) filtered.sort((a, b) => compareLibraryAlbums(a, b, sort));

  root.querySelector("#library-count")!.textContent =
    filtered.length === albums.length
      ? `${filtered.length} ${filtered.length === 1 ? "album" : "albums"}`
      : `${filtered.length} of ${albums.length} albums`;
  list.innerHTML = filtered.length
    ? renderAlbumGrid(filtered, state.layout)
    : /* HTML */ `<div class="empty">
        ${icon("disc", 35)}
        <h3>${albums.length ? "No matching albums" : "Your shelf is empty"}</h3>
        <p>
          ${albums.length ? "Try a different search or clear your filters." : "Add a record to start your listening journal."}
        </p>
        <button
          class="button secondary"
          type="button"
          data-action="${albums.length ? "clear" : "add"}"
        >
          ${albums.length ? "Clear filters" : "Add album"}
        </button>
      </div>`;
}
