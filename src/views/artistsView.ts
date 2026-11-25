import { findCountry } from "../app/countries";
import { libraryUrl } from "../app/libraryUrl";
import { countryFlag } from "../components/countryFlag";
import {
  artistSorting,
  renderSortDropdown,
  type CatalogBrowseSort,
} from "../components/sortOptions";
import { catalogImage, catalogStats } from "../components/catalogSummary";
import { compareSortValues, type SortSelection } from "../app/librarySort";
import { matchesAlbumGenres, type LibraryFilters } from "../app/libraryFilters";
import { renderCategoryFilter } from "../components/libraryCategoryFilters";
import { renderFilterChips } from "../components/libraryFilters";
import type { LibraryData } from "../types/library";
import { renderAlbumListHeading } from "../components/albumListHeading";
import { renderCatalogHeading } from "../components/catalogHeading";
import { renderExternalLinks } from "../components/externalLinks";
import {
  renderCatalogFilters,
  renderFilterControls,
} from "../components/catalogFilters";
import type { Album, Artist } from "../types/albums";
import { escapeHtml as e } from "../components/html";
import { icon } from "../components/icons";
import { renderAlbumGrid } from "../components/albumGrid";
import { matches } from "../app/search";

export const artistUrl = (id: string): string =>
  `#artist/${encodeURIComponent(id)}`;
export const artistAlbums = (albums: Album[], id: string): Album[] =>
  albums.filter((album) => album.artists.some((artist) => artist.id === id));
export const artistRoles = ["primary", "featured", "other"] as const;
export const roleLabel = (role: string): string =>
  role.charAt(0).toUpperCase() + role.slice(1);

export const artistFilterFields = ["country", "genres"] as const;
export const defaultArtistSort = {
  category: "name",
  direction: "ascending",
} as const satisfies SortSelection<CatalogBrowseSort>;

export interface ArtistsState {
  query: string;
  filters: Pick<LibraryFilters, (typeof artistFilterFields)[number]>;
  sort: SortSelection<CatalogBrowseSort> | null;
}

export function renderArtistsView(
  state: ArtistsState,
  data: LibraryData,
): string {
  const controls = renderFilterControls(
    artistFilterFields
      .map((field) =>
        renderCategoryFilter(field, state.filters, data, "artist"),
      )
      .join(""),
    "artist",
  );

  return /* HTML */ `<section
    class="instrument-page catalog-page artists-page"
    aria-labelledby="page-title"
  >
    ${renderCatalogHeading("Artists", "artist")}
    <div class="toolbar library-toolbar">
      <label class="search-field"
        >${icon("search")}<span class="sr-only">Search artists</span
        ><input
          id="artists-search"
          type="search"
          placeholder="Find an artist…"
          value="${e(state.query)}"
      /></label>
      ${renderCatalogFilters(controls, Object.keys(state.filters).length)}
      ${renderSortDropdown(artistSorting, state.sort)}
    </div>
    <div id="artist-filter-chips" class="library-filter-chips">
      ${renderFilterChips(state.filters, data, "artist")}
    </div>
    <p id="artists-count" class="result-count" role="status"></p>
    <div id="artists-list"></div>
  </section>`;
}

export function updateArtistsView(
  data: LibraryData,
  { query, filters, sort }: ArtistsState,
  root: ParentNode = document,
): void {
  const order = sort ?? defaultArtistSort;
  const countryIds = filters.country?.ids;
  const genreArtistIds = filters.genres?.ids.length
    ? new Set(
        data.albums
          .filter((album) =>
            matchesAlbumGenres(album, data.genres, filters.genres),
          )
          .flatMap((album) => album.artists.map((artist) => artist.id)),
      )
    : null;
  const results = data.artists
    .filter((item) => {
      const country = findCountry(item.country);
      return (
        (!countryIds?.length || countryIds.includes(country?.id ?? "")) &&
        (!genreArtistIds || genreArtistIds.has(item.id)) &&
        matches(
          query,
          item.name,
          item.sortName ?? "",
          country?.name ?? "",
          country?.id ?? "",
          ...(country?.aliases ?? []),
        )
      );
    })
    .map((item) => {
      const stats = catalogStats(artistAlbums(data.albums, item.id));
      if (
        item.updatedAt &&
        Date.parse(item.updatedAt) > (Date.parse(stats.updated) || 0)
      )
        stats.updated = item.updatedAt;

      return {
        item,
        count: stats.count,
        name: item.sortName || item.name,
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

  root.querySelector("#artists-count")!.textContent =
    `${results.length} ${results.length === 1 ? "artist" : "artists"}`;
  root.querySelector("#artists-list")!.innerHTML = results.length
    ? /* HTML */ `<ul class="catalog-row-list">
        ${results.map(({ item, count }) => renderArtistRow(item, count)).join("")}
      </ul>`
    : renderArtistEmpty(Boolean(data.artists.length));
}

function renderArtistRow(item: Artist, count: number): string {
  const country = findCountry(item.country);
  return /* HTML */ `<li>
    <a class="catalog-row artist-catalog-row" href="${artistUrl(item.id)}">
      ${catalogImage(item.name, item.photoUrl, true)}
      <span class="catalog-row-identity">
        <strong class="catalog-row-name artist-catalog-name"
          >${e(item.name)}</strong
        >
        ${country ? /* HTML */ `<span class="artist-catalog-country" role="img" aria-label="${e(country.name)}" title="${e(country.name)}">${countryFlag(country)}</span>` : ""}
      </span>
      <span class="catalog-row-count"
        >${count} ${count === 1 ? "album" : "albums"}</span
      >
      ${icon("chevron", 16)}
    </a>
  </li>`;
}

function renderArtistEmpty(hasItems: boolean): string {
  return /* HTML */ `<div class="empty">
    <h2>${hasItems ? "No matching artists" : "Start your artist catalog"}</h2>
    <p>Add an artist here or while editing an album.</p>
    ${hasItems ? /* HTML */ `<button class="button secondary" data-action="clear-artist-filters">Clear filters</button>` : ""}
  </div>`;
}

export function renderArtistDetail(
  item: Artist,
  albums: Album[],
  layout = "list",
): string {
  const used = artistAlbums(albums, item.id).sort(
    (a, b) =>
      (a.releaseYear ?? Infinity) - (b.releaseYear ?? Infinity) ||
      (a.sortTitle || a.title).localeCompare(b.sortTitle || b.title),
  );
  const links = renderExternalLinks(item.links ?? [], "icons");
  const country = findCountry(item.country);
  return /* HTML */ `<section
    class="instrument-page"
    aria-labelledby="page-title"
  >
    <a class="back-link" href="#artists">${icon("back", 17)} Back to artists</a>
    <div class="artist-page-heading">
      ${catalogImage(item.name, item.photoUrl, true)}
      <div class="artist-profile">
        <h1 id="page-title">${e(item.name)}</h1>
        ${
          country || links
            ? /* HTML */ `<div class="artist-details">
                ${country ? /* HTML */ `<a class="artist-country-link" href="${e(libraryUrl({ filters: { country: { ids: [country.id] } } }))}" aria-label="Browse albums by artists from ${e(country.name)}" title="${e(country.name)}">${countryFlag(country)}</a>` : ""}
                ${country && links ? /* HTML */ `<span class="muted" aria-hidden="true">·</span>` : ""}
                ${links}
              </div>`
            : ""
        }
      </div>
      <button
        class="button secondary artist-edit"
        data-action="edit-catalog-artist"
        aria-label="Edit artist"
      >
        ${icon("edit", 16)} <span>Edit artist</span>
      </button>
    </div>
    <section class="instrument-albums">
      ${renderAlbumListHeading("Albums", layout, "artist-layout")}
      ${
        used.length
          ? renderAlbumGrid(used, layout)
          : /* HTML */ `<div class="empty detail-empty">
              <h3>No albums yet</h3>
              <p>
                This artist stays in your catalog until you use or delete it.
              </p>
            </div>`
      }
    </section>
    <div class="instrument-delete">
      <button
        class="button secondary danger"
        data-action="delete-catalog-artist"
        ${used.length ? 'disabled aria-describedby="artist-delete-help"' : ""}
      >
        Delete artist
      </button>
      <p id="artist-delete-help" class="muted">
        ${used.length ? "Remove this artist from its albums before deleting it." : "Unused artists can be deleted from your catalog."}
      </p>
    </div>
  </section>`;
}
