import type { LibraryData } from "../types/library";
import {
  listeningNoteTargets,
  noteLinkKey,
  renderListeningNote,
  type NoteLinkTarget,
} from "../components/listeningNoteLinks";
import { vinylStatusIcon } from "../app/vinylStatus";
import { genreUrl } from "../app/genres";
import { artistUrl, roleLabel } from "./artistsView";
import type { Album, ListeningEntry } from "../types/albums";
import {
  cover,
  latestRatedListen,
  orderedListens,
} from "../components/presentation";
import { escapeHtml } from "../components/html";
import { instrumentUrl } from "../app/instruments";
import { icon } from "../components/icons";
import {
  preferredListeningLink,
  renderExternalLinks,
} from "../components/externalLinks";
import { formatListeningDate } from "../components/listeningDate";
import { renderRating } from "../components/rating";

function renderHistoryRow(
  listen: ListeningEntry,
  targets: ReadonlyMap<string, NoteLinkTarget>,
): string {
  const date = formatListeningDate(listen.listenedAt);
  const note = renderListeningNote(listen.notes ?? "", targets);
  const label = `Edit listen from ${date}`;
  const editAttributes = `data-action="edit-listen" data-id="${escapeHtml(listen.id)}" aria-label="${label}"`;
  const editIcon = icon("edit", 15);
  const edit = note.hasLinks
    ? /* HTML */ `<button
        type="button"
        class="icon-button listen-edit"
        ${editAttributes}
      >
        ${editIcon}
      </button>`
    : /* HTML */ `<span class="listen-edit">${editIcon}</span>`;
  const body = /* HTML */ `<span class="listen-top">
      <time datetime="${escapeHtml(listen.listenedAt)}">${date}</time>
      ${renderRating(listen.rating, true)} ${edit}
    </span>
    ${listen.notes ? /* HTML */ `<span class="listen-notes">${note.html}</span>` : ""}`;

  if (note.hasLinks)
    return /* HTML */ `<article class="listen-row">${body}</article>`;

  return /* HTML */ `<button type="button" class="listen-row" ${editAttributes}>
    ${body}
  </button>`;
}

function renderAdditionalCredits(additionalArtists: Album["artists"]): string {
  return /* HTML */ ` ${
    additionalArtists.length
      ? /* HTML */ `<section
          class="additional-credits"
          aria-labelledby="credits-title"
        >
          <div class="detail-heading">
            ${icon("people", 21)}
            <h2 id="credits-title">Additional credits</h2>
          </div>
          <ul class="additional-credit-list">
            ${additionalArtists.map((artist) => /* HTML */ `<li><a href="${artistUrl(artist.id)}">${escapeHtml(artist.name)}</a><span class="artist-role-label">${roleLabel(artist.role)}</span></li>`).join("")}
          </ul>
        </section>`
      : ""
  }`;
}

function renderFeaturedInstruments(instruments: Album["instruments"]): string {
  return /* HTML */ ` <section aria-labelledby="instruments-title">
    <div class="detail-heading">
      ${icon("music", 21)}
      <h2 id="instruments-title">Featured instruments</h2>
      <button
        type="button"
        class="button section-edit"
        data-action="edit-instruments"
        aria-label="Edit featured instruments"
      >
        ${icon("edit", 14)} Edit
      </button>
    </div>
    ${instruments.length ? /* HTML */ `<div class="tags">${instruments.map((item) => /* HTML */ `<a class="chip" href="${instrumentUrl(item.id)}">${escapeHtml(item.name)}</a>`).join("")}</div>` : /* HTML */ `<p class="muted">No featured instruments added yet.</p>`}
  </section>`;
}

function vinylStatusText(status: Album["vinylStatus"]): string {
  switch (status) {
    case "owned":
      return "Owned";
    case "wishlisted":
      return "Wishlist";
    default:
      return "Not tracked";
  }
}

function renderVinylControl(album: Album): string {
  const status = album.vinylStatus;
  const listeningLink = preferredListeningLink(album.links);

  return /* HTML */ `<div
    class="album-artwork vinyl-control"
    data-vinyl-status="${status ?? ""}"
  >
    ${
      status
        ? /* HTML */ `<span class="vinyl album-vinyl" aria-hidden="true">
            ${status === "wishlisted" ? /* HTML */ `<span class="album-vinyl-wish">${icon("heart", 18)}</span>` : ""}
          </span>`
        : ""
    }
    <div class="album-sleeve">
      ${cover(album, true)}
      <div class="album-art-actions">
        ${
          listeningLink
            ? /* HTML */ `<a
                class="album-art-button album-listen-button"
                href="${escapeHtml(listeningLink.href)}"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Listen on ${listeningLink.provider} (opens in a new tab)"
                title="Listen on ${listeningLink.provider}"
              >
                ${icon("headphones", 19)}
              </a>`
            : ""
        }
        <button
          type="button"
          id="vinyl-status-button"
          class="album-art-button vinyl-art-button"
          popovertarget="vinyl-status-options"
          aria-label="Track vinyl: ${vinylStatusText(status)}"
          title="Track vinyl · ${vinylStatusText(status)}"
          aria-describedby="vinyl-status-text"
        >
          ${icon(vinylStatusIcon(status), 18)}
        </button>
      </div>
    </div>
    <span id="vinyl-status-text" class="sr-only"
      >${vinylStatusText(status)}</span
    >
    <div
      id="vinyl-status-options"
      class="vinyl-status-options"
      popover
      role="group"
      aria-label="Vinyl status"
    >
      <button
        type="button"
        data-action="set-vinyl-status"
        data-status="owned"
        aria-pressed="${status === "owned"}"
      >
        ${icon("disc", 16)} Mark as owned
        ${status === "owned" ? icon("check", 16) : ""}
      </button>
      <button
        type="button"
        data-action="set-vinyl-status"
        data-status="wishlisted"
        aria-pressed="${status === "wishlisted"}"
      >
        ${icon("disc-wishlist", 16)} Add to wishlist
        ${status === "wishlisted" ? icon("check", 16) : ""}
      </button>
      ${
        status
          ? /* HTML */ `<button
              type="button"
              data-action="set-vinyl-status"
              data-status=""
            >
              ${icon("close", 16)} Clear status
            </button>`
          : ""
      }
    </div>
  </div>`;
}

export function renderAlbumDetailView(
  album: Album,
  library: LibraryData,
): string {
  const targets = new Map(
    listeningNoteTargets(library).map((target) => [
      noteLinkKey(target),
      target,
    ]),
  );
  const listens = orderedListens(album);
  const rating = latestRatedListen(album)?.rating;
  const credits = [...album.artists].sort((a, b) => a.position - b.position);
  const primaryArtists = credits.filter((artist) => artist.role === "primary");
  const additionalArtists = credits.filter(
    (artist) => artist.role !== "primary",
  );
  return /* HTML */ `<div class="detail">
    <a class="back-link" href="#">${icon("back", 17)} Back to library</a>
    <section class="album-hero" aria-labelledby="page-title">
      ${renderVinylControl(album)}
      <div class="album-hero-info">
        <h1 id="page-title">${escapeHtml(album.title)}</h1>
        <p class="detail-artist">
          ${
            primaryArtists.length
              ? primaryArtists
                  .map(
                    (artist) =>
                      /* HTML */ `<a href="${artistUrl(artist.id)}"
                        >${escapeHtml(artist.name)}</a
                      >`,
                  )
                  .join(" · ")
              : "Unknown artist"
          }
          ${album.releaseYear ? /* HTML */ `<span class="detail-year"> · ${escapeHtml(album.releaseYear)}</span>` : ""}
          ${album.recordLabel ? /* HTML */ `<span class="detail-year"> · ${escapeHtml(album.recordLabel)}</span>` : ""}
        </p>
        ${album.genres.length ? /* HTML */ `<div class="tags detail-genres">${album.genres.map((genre) => /* HTML */ `<a class="chip" href="${genreUrl(genre.id)}">${escapeHtml(genre.name)}</a>`).join("")}</div>` : ""}
        ${rating !== undefined ? /* HTML */ `<div class="detail-rating">${renderRating(rating)}</div>` : ""}
      </div>
      <button
        type="button"
        class="button album-edit"
        data-action="edit"
        aria-label="Edit album"
        title="Edit album"
      >
        ${icon("edit", 19)}
      </button>
    </section>
    <div class="detail-body">
      <div>
        <section aria-labelledby="history-title">
          <div class="detail-heading">
            ${icon("history", 21)}
            <h2 id="history-title">Listening history</h2>
            <button
              type="button"
              class="button section-edit"
              data-action="listen"
              aria-label="Log a listen"
            >
              ${icon("plus", 14)} Log
            </button>
          </div>
          ${
            listens.length
              ? /* HTML */ `<div class="divided-rows">
                  ${listens.map((listen) => renderHistoryRow(listen, targets)).join("")}
                </div>`
              : /* HTML */ `<div class="empty detail-empty">
                  <h3>No listens logged yet</h3>
                  <p>Add a rating and notes after your next listen.</p>
                  <button
                    type="button"
                    class="button primary"
                    data-action="listen"
                  >
                    ${icon("plus", 17)} Log a listen
                  </button>
                </div>`
          }
        </section>
      </div>
      <div class="album-sidebar">
        ${renderAdditionalCredits(additionalArtists)}
        ${renderFeaturedInstruments(album.instruments)}
        <section aria-labelledby="links-title">
          <div class="detail-heading">
            ${icon("link", 21)}
            <h2 id="links-title">Music links</h2>
            <button
              type="button"
              class="button section-edit"
              data-action="edit-links"
              aria-label="Edit music links"
            >
              ${icon("edit", 14)} Edit
            </button>
          </div>
          ${renderExternalLinks(album.links) || /* HTML */ `<p class="muted">No music links added.</p>`}
        </section>
      </div>
    </div>
    <div class="album-footer">
      <button type="button" class="button secondary" data-action="delete-album">
        Delete album
      </button>
    </div>
  </div>`;
}
