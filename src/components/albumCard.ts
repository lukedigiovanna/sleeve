import { vinylStatusIcon, vinylStatusLabel } from "../app/vinylStatus";
import type { Album } from "../types/albums";
import { cover, artistText, albumUrl, latestRatedListen } from "./presentation";
import { escapeHtml } from "./html";
import { renderRating } from "./rating";
import { icon } from "./icons";

export function renderAlbumCard(
  album: Album,
  showUnratedLabel = false,
): string {
  return /* HTML */ `<li class="album-item">
    <a class="album-card" href="${albumUrl(album.id)}">
      ${cover(album)}
      <span class="album-text"
        ><span class="album-title">
          <strong>${escapeHtml(album.title)}</strong>
          ${album.vinylStatus ? /* HTML */ `<span class="album-vinyl-status" role="img" aria-label="${vinylStatusLabel(album.vinylStatus)}" title="${vinylStatusLabel(album.vinylStatus)}">${icon(vinylStatusIcon(album.vinylStatus), 15)}</span>` : ""} </span
        ><span class="album-artist"
          >${escapeHtml(artistText(album))}${album.releaseYear ? /* HTML */ `<span class="separator">·</span>${album.releaseYear}` : ""}</span
        ></span
      >
      <span class="album-genre"
        >${escapeHtml(album.genres[0]?.name ?? "")}</span
      >
      ${renderRating(latestRatedListen(album)?.rating, showUnratedLabel)}
      <span class="card-arrow">${icon("chevron", 16)}</span>
    </a>
  </li>`;
}
