import { escapeHtml } from "../components/html";
import { formatListeningDate } from "../components/listeningDate";
import {
  listeningNoteTargets,
  noteLinkKey,
  renderListeningNote,
  type NoteLinkTarget,
} from "../components/listeningNoteLinks";
import { albumUrl, artistText, cover } from "../components/presentation";
import { renderRating } from "../components/rating";
import type { Album, ListeningEntry } from "../types/albums";
import type { LibraryData } from "../types/library";

interface ActivityEntry {
  album: Album;
  listen: ListeningEntry;
}

function renderEntry(
  { album, listen }: ActivityEntry,
  targets: ReadonlyMap<string, NoteLinkTarget>,
): string {
  const note = renderListeningNote(listen.notes ?? "", targets);

  return /* HTML */ `<li class="activity-entry">
    ${cover(album)}
    <div class="activity-entry-content">
      <a class="activity-album" href="${albumUrl(album.id)}"
        >${escapeHtml(album.title)}</a
      >
      <div class="activity-artist">${escapeHtml(artistText(album))}</div>
      ${listen.rating === null ? "" : renderRating(listen.rating)}
    </div>
    ${
      listen.notes
        ? /* HTML */ `<div class="listen-notes">${note.html}</div>`
        : ""
    }
  </li>`;
}

export function renderActivityView(library: LibraryData): string {
  const entries = library.albums
    .flatMap((album) =>
      album.listeningEntries.map((listen) => ({ album, listen })),
    )
    .sort(
      (a, b) =>
        b.listen.listenedAt.localeCompare(a.listen.listenedAt) ||
        b.listen.createdAt.localeCompare(a.listen.createdAt),
    );
  const days = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const date = entry.listen.listenedAt.slice(0, 10);
    const day = days.get(date);
    if (day) day.push(entry);
    else days.set(date, [entry]);
  }

  const targets = new Map(
    listeningNoteTargets(library).map((target) => [
      noteLinkKey(target),
      target,
    ]),
  );

  return /* HTML */ `<section class="activity" aria-labelledby="page-title">
    <div class="catalog-heading"><h1 id="page-title">Activity</h1></div>
    ${
      days.size
        ? [...days]
            .map(
              ([date, day]) =>
                /* HTML */ `<section class="activity-day">
                  <h2>
                    <time datetime="${escapeHtml(date)}"
                      >${formatListeningDate(date)}</time
                    >
                  </h2>
                  <ul class="activity-list">
                    ${day.map((entry) => renderEntry(entry, targets)).join("")}
                  </ul>
                </section>`,
            )
            .join("")
        : /* HTML */ `<p class="empty">
            Your logged listens will appear here.
          </p>`
    }
  </section>`;
}
