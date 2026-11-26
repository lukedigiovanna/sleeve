import { renderResultsMeta } from "../components/resultsMeta";
import { findCountry } from "../app/countries";
import { libraryUrl } from "../app/libraryUrl";
import { countryFlag } from "../components/countryFlag";
import {
  artistSorting,
  renderSortDropdown,
  type ArtistBrowseSort,
} from "../components/sortOptions";
import { catalogImage, catalogStats } from "../components/catalogSummary";
import {
  compareSortValues,
  dateAddedSortValue,
  type SortSelection,
} from "../app/librarySort";
import { matchesAlbumGenres, type LibraryFilters } from "../app/libraryFilters";
import { renderCategoryFilter } from "../components/libraryCategoryFilters";
import { renderFilterChips } from "../components/libraryFilters";
import type { LibraryData } from "../types/library";
import { renderLayoutToggle } from "../components/layoutToggle";
import { renderCatalogHeading } from "../components/catalogHeading";
import { renderExternalLinks } from "../components/externalLinks";
import { renderFilterControls } from "../components/catalogFilters";
import { renderCatalogSearchRow } from "../components/catalogSearchRow";
import type { Album, Artist } from "../types/albums";
import { escapeHtml as e } from "../components/html";
import { webUrl } from "../components/presentation";
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
} as const satisfies SortSelection<ArtistBrowseSort>;

export interface ArtistsState {
  query: string;
  filters: Pick<LibraryFilters, (typeof artistFilterFields)[number]>;
  sort: SortSelection<ArtistBrowseSort> | null;
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
    ${renderCatalogSearchRow({
      inputId: "artists-search",
      label: "Search artists",
      query: state.query,
      filters: {
        content: controls,
        activeCount: Object.keys(state.filters).length,
      },
      sort: renderSortDropdown(artistSorting, state.sort),
    })}
    <div id="artist-filter-chips" class="library-filter-chips">
      ${renderFilterChips(state.filters, data, "artist")}
    </div>
    ${renderResultsMeta("artists")}
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

      return {
        item,
        count: stats.count,
        name: item.sortName || item.name,
        recent: stats.recent || null,
        created: dateAddedSortValue(item.createdAt),
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
    ? /* HTML */ `<ul class="divided-rows catalog-row-list">
        ${results.map(({ item, count }) => renderArtistRow(item, count)).join("")}
      </ul>`
    : renderArtistEmpty(Boolean(data.artists.length));
}

function renderArtistRow(item: Artist, count: number): string {
  return /* HTML */ `<li>
    <a class="catalog-row artist-catalog-row" href="${artistUrl(item.id)}">
      ${catalogImage(item.name, item.photoUrl, true)}
      <span class="catalog-row-identity">
        <strong class="catalog-row-name artist-catalog-name"
          >${e(item.name)}</strong
        >
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

function renderArtistPortrait(item: Artist): string {
  const photo = webUrl(item.photoUrl);
  const thumbnail = catalogImage(item.name, item.photoUrl, true);
  if (!photo) return thumbnail;

  return /* HTML */ `<button
      type="button"
      class="artist-photo-button"
      data-action="open-artist-photo"
      aria-haspopup="dialog"
      aria-label="View artist photo"
    >
      ${thumbnail}
    </button>
    <dialog
      id="artist-photo"
      class="artist-photo-dialog"
      aria-label="Photo of ${e(item.name)}"
    >
      <button
        type="button"
        class="icon-button artist-photo-close"
        data-action="close-artist-photo"
        aria-label="Close photo"
        autofocus
      >
        ${icon("close", 16)}
      </button>
      <img
        src="${e(photo.href)}"
        alt="${e(item.name)}"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
    </dialog>`;
}

export function renderArtistAlbums(
  item: Artist,
  albums: Album[],
  layout = "list",
): string {
  const used = artistAlbums(albums, item.id).sort(
    (a, b) =>
      (a.releaseYear ?? Infinity) - (b.releaseYear ?? Infinity) ||
      (a.sortTitle || a.title).localeCompare(b.sortTitle || b.title),
  );
  if (used.length) return renderAlbumGrid(used, layout);

  return /* HTML */ `<div class="empty detail-empty">
    <p>This artist has no albums. Would you like to delete it?</p>
    <button
      type="button"
      class="button secondary danger"
      data-action="delete-catalog-artist"
      data-id="${e(item.id)}"
    >
      Delete artist
    </button>
  </div>`;
}

export function renderArtistDetail(
  item: Artist,
  albums: Album[],
  layout = "list",
): string {
  const links = renderExternalLinks(item.links ?? [], "icons");
  const country = findCountry(item.country);
  return /* HTML */ `<section
    class="instrument-page"
    aria-labelledby="page-title"
  >
    <a class="back-link" href="#artists">${icon("back", 17)} Back to artists</a>
    <header class="artist-page-heading">
      <h1 id="page-title">${e(item.name)}</h1>
      <div class="artist-profile">
        ${renderArtistPortrait(item)}
        <div class="artist-details">
          ${
            country
              ? /* HTML */ `<a
                  class="artist-country-link artist-link-icon"
                  href="${e(libraryUrl({ filters: { country: { ids: [country.id] } } }))}"
                  aria-label="Browse albums by artists from ${e(country.name)}"
                >
                  ${countryFlag(country)}
                  <span class="artist-link-label" aria-hidden="true">
                    Browse albums from ${e(country.name)}
                  </span>
                </a>`
              : ""
          }
          ${country && links ? /* HTML */ `<span class="muted" aria-hidden="true">·</span>` : ""}
          ${links}
        </div>
        ${renderLayoutToggle(layout, "Albums layout", "artist-layout")}
      </div>
      <button
        type="button"
        class="icon-button artist-edit"
        data-action="edit-catalog-artist"
        aria-label="Edit artist"
        title="Edit artist"
      >
        ${icon("edit", 19)}
      </button>
    </header>
    <section class="instrument-albums" aria-label="Albums" data-artist-albums>
      ${renderArtistAlbums(item, albums, layout)}
    </section>
  </section>`;
}
