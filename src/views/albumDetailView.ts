import { vinylStatusIcon } from "../app/vinylStatus";
import { genreUrl } from "../app/genres";
import { artistUrl, roleLabel } from "./artistsView";
import type { Album, ListeningEntry } from "../types/albums";
import {
  cover,
  latestRatedListen,
  orderedListens,
  webUrl,
} from "../components/presentation";
import { escapeHtml } from "../components/html";
import { instrumentUrl } from "../app/instruments";
import { icon } from "../components/icons";
import { renderExternalLinks } from "../components/externalLinks";
import { renderRating } from "../components/rating";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date.slice(0, 10) + "T00:00:00Z"));
}

function historyCard(listen: ListeningEntry) {
  return /* HTML */ `<button
    type="button"
    class="listen-card"
    data-action="edit-listen"
    data-id="${escapeHtml(listen.id)}"
    aria-label="Edit listen from ${formatDate(listen.listenedAt)}"
  >
    <span class="listen-top">
      <time datetime="${listen.listenedAt}"
        >${formatDate(listen.listenedAt)}</time
      >${renderRating(listen.rating)}
    </span>
    ${listen.notes ? /* HTML */ `<span class="listen-notes">${escapeHtml(listen.notes)}</span>` : ""}
    <span class="listen-edit">${icon("edit", 14)} Edit listen</span>
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

function renderInstrumentation(instruments: Album["instruments"]): string {
  return /* HTML */ ` <section aria-labelledby="instruments-title">
    <div class="detail-heading">
      ${icon("music", 21)}
      <h2 id="instruments-title">Instrumentation</h2>
      <button
        type="button"
        class="button section-edit"
        data-action="edit-instruments"
        aria-label="Edit instruments"
      >
        ${icon("edit", 14)} Edit
      </button>
    </div>
    ${instruments.length ? /* HTML */ `<div class="tags">${instruments.map((item) => /* HTML */ `<a class="chip" href="${instrumentUrl(item.id)}">${escapeHtml(item.name)}</a>`).join("")}</div>` : /* HTML */ `<p class="muted">No instruments added yet. Add them whenever you know what you heard.</p>`}
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
      <button
        type="button"
        id="vinyl-status-button"
        class="vinyl-art-button"
        popovertarget="vinyl-status-options"
        aria-label="Track vinyl: ${vinylStatusText(status)}"
        title="Track vinyl · ${vinylStatusText(status)}"
        aria-describedby="vinyl-status-text"
      >
        ${icon(vinylStatusIcon(status), 18)}
      </button>
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

export function renderAlbumDetailView(album: Album): string {
  const listens = orderedListens(album);
  const rating = latestRatedListen(album)?.rating;
  const credits = [...album.artists].sort((a, b) => a.position - b.position);
  const primaryArtists = credits.filter((artist) => artist.role === "primary");
  const additionalArtists = credits.filter(
    (artist) => artist.role !== "primary",
  );
  const appleMusicUrl = album.links
    .map((link) => webUrl(link.url))
    .find((url) => url?.hostname.replace(/^www\./, "") === "music.apple.com");
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
        ${album.genres.length ? /* HTML */ `<div class="tags">${album.genres.map((g) => /* HTML */ `<a class="chip" href="${genreUrl(g.id)}">${escapeHtml(g.name)}</a>`).join("")}</div>` : ""}
        ${rating !== undefined ? /* HTML */ `<div class="detail-rating">${renderRating(rating)}</div>` : ""}
        <div class="detail-actions">
          <button type="button" class="button secondary" data-action="edit">
            ${icon("edit", 17)} Edit album
          </button>
          ${
            appleMusicUrl
              ? /* HTML */ `<a
                  class="button album-music-shortcut"
                  href="${escapeHtml(appleMusicUrl.href)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open in Apple Music (opens in a new tab)"
                  title="Open in Apple Music"
                  >${icon("music", 17)} Apple Music</a
                >`
              : ""
          }
        </div>
      </div>
    </section>
    <div class="detail-body">
      <div>
        <section aria-labelledby="history-title">
          <div class="detail-heading">
            ${icon("history", 21)}
            <h2 id="history-title">Listening history</h2>
            <span class="count-pill">${listens.length}</span>
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
              ? listens.map(historyCard).join("")
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
        ${renderInstrumentation(album.instruments)}
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
