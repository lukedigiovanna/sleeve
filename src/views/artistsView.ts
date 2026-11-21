import { findCountry } from "../app/countries";
import { libraryUrl } from "../app/libraryUrl";
import { countryFlag } from "../components/countryFlag";
import type { CatalogSort } from "../components/sortOptions";
import {
  catalogImage,
  catalogSort,
  catalogStats,
  renderCatalogSummary,
  type CatalogStats,
  compareCatalog,
} from "../components/catalogSummary";
import { renderAlbumListHeading } from "../components/albumListHeading";
import { renderCatalogHeading } from "../components/catalogHeading";
import { renderExternalLinks } from "../components/externalLinks";
import { renderCatalogFilters } from "../components/catalogFilters";
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

export function renderArtistsView(
  query: string,
  unused: boolean,
  sort: CatalogSort = "updated",
  primary = false,
): string {
  return /* HTML */ `<section
    class="instrument-page catalog-page"
    aria-labelledby="page-title"
  >
    ${renderCatalogHeading("Artists", "artist")}
    <div class="instrument-toolbar genre-toolbar">
      <label class="search-field"
        >${icon("search")}<span class="sr-only">Search artists</span
        ><input
          id="artists-search"
          type="search"
          placeholder="Find an artist…"
          value="${e(query)}" /></label
      >${renderCatalogFilters(/* HTML */ `${catalogSort("artists-sort", sort)}<label><input id="artists-unused" type="checkbox" ${unused ? "checked" : ""} /> Unused only</label><label><input id="artists-primary" type="checkbox" ${primary ? "checked" : ""} /> Primary artist only</label>`, Number(unused) + Number(primary))}
    </div>
    <p id="artists-count" class="result-count" role="status"></p>
    <div id="artists-list"></div>
  </section>`;
}
export function updateArtistsView(
  artists: Artist[],
  albums: Album[],
  query: string,
  unused: boolean,
  root: ParentNode = document,
  sort: CatalogSort = "updated",
  primary = false,
): void {
  const results = artists
    .map((item) => {
      const used = artistAlbums(albums, item.id).filter(
        (album) =>
          !primary ||
          album.artists.some(
            (artist) => artist.id === item.id && artist.role === "primary",
          ),
      );
      const stats = catalogStats(used);
      if (
        item.updatedAt &&
        Date.parse(item.updatedAt) > (Date.parse(stats.updated) || 0)
      )
        stats.updated = item.updatedAt;
      return { item, stats };
    })
    .filter(({ item, stats }) => {
      const country = findCountry(item.country);
      return (
        matches(
          query,
          item.name,
          item.sortName ?? "",
          country?.name ?? "",
          country?.id ?? "",
          ...(country?.aliases ?? []),
        ) &&
        (!unused || !stats.count)
      );
    })
    .sort(
      (a, b) =>
        compareCatalog(a.stats, b.stats, sort) ||
        (a.item.sortName || a.item.name).localeCompare(
          b.item.sortName || b.item.name,
        ),
    );
  root.querySelector("#artists-count")!.textContent =
    `${results.length} ${results.length === 1 ? "artist" : "artists"}`;
  root.querySelector("#artists-list")!.innerHTML = results.length
    ? /* HTML */ `<ul class="instrument-catalog-list">
        ${results.map(({ item, stats }) => renderArtistRow(item, stats)).join("")}
      </ul>`
    : renderArtistEmpty(Boolean(artists.length));
}
function renderArtistRow(item: Artist, stats: CatalogStats): string {
  const country = findCountry(item.country);
  return /* HTML */ `<li>
    <a class="instrument-catalog-row" href="${artistUrl(item.id)}"
      >${catalogImage(item.name, item.photoUrl, true)}<span
        class="catalog-card-content"
        ><span class="instrument-row-info"
          ><span
            ><strong>${e(item.name)}</strong
            >${country ? /* HTML */ ` <em class="artist-country">(${e(country.name)})</em>` : ""}</span
          ></span
        >${renderCatalogSummary(stats)}</span
      >${icon("chevron", 18)}</a
    >
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
  layout = "grid",
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
