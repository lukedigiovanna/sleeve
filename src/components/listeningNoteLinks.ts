import type { LibraryData } from "../types/library";
import type { Album } from "../types/albums";
import { artistText } from "./presentation.ts";
import { escapeHtml } from "./html.ts";

const linkTypes = ["artist", "album", "instrument", "genre"] as const;
type LinkType = (typeof linkTypes)[number];

interface NoteReference {
  type: LinkType;
  id: string;
  label: string;
}

export interface NoteLinkTarget extends NoteReference {
  detail?: string;
}

const linkPattern =
  /\[((?:\\[\\\[\]]|[^\\\[\]\r\n])+)\]\(sleeve:(artist|album|instrument|genre)\/([\w.%~-]+)\)/g;

export function noteLinkKey(reference: NoteReference): string {
  return `${reference.type}/${reference.id}`;
}

export function encodeNoteLink(reference: NoteReference): string {
  const label = reference.label
    .replace(/[\r\n]+/g, " ")
    .replace(/[\\[\]]/g, "\\$&");
  const id = encodeURIComponent(reference.id).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16)}`,
  );
  return `[${label}](sleeve:${reference.type}/${id})`;
}

export function mapNoteLinks(
  notes: string,
  text: (value: string) => string,
  link: (reference: NoteReference, source: string) => string,
): string {
  let end = 0;
  let output = "";
  for (const match of notes.matchAll(linkPattern)) {
    const [source, label, type, encodedId] = match;
    if (!linkTypes.some((value) => value === type)) continue;

    let id: string;
    try {
      id = decodeURIComponent(encodedId);
    } catch {
      continue;
    }

    output += text(notes.slice(end, match.index));
    output += link(
      {
        type: type as LinkType,
        id,
        label: label.replace(/\\([\\[\]])/g, "$1"),
      },
      source,
    );
    end = match.index + source.length;
  }
  return output + text(notes.slice(end));
}

export function listeningNoteTargets(library: LibraryData): NoteLinkTarget[] {
  return [
    ...library.artists.map(({ id, name }): NoteLinkTarget => ({
      type: "artist",
      id,
      label: name,
    })),
    ...library.albums.map((album): NoteLinkTarget => ({
      type: "album",
      id: album.id,
      label: album.title,
      detail: [artistText(album), album.releaseYear]
        .filter(Boolean)
        .join(" · "),
    })),
    ...library.instruments.map(({ id, name }): NoteLinkTarget => ({
      type: "instrument",
      id,
      label: name,
    })),
    ...library.genres.map(({ id, name }): NoteLinkTarget => ({
      type: "genre",
      id,
      label: name,
    })),
  ];
}

export function suggestedNoteLinks(album: Album): Set<string> {
  return new Set([
    ...album.artists.map(({ id }) => `artist/${id}`),
    ...album.instruments.map(({ id }) => `instrument/${id}`),
    ...album.genres.map(({ id }) => `genre/${id}`),
  ]);
}

export function renderListeningNote(
  notes: string,
  targets: ReadonlyMap<string, NoteLinkTarget>,
): { html: string; hasLinks: boolean } {
  let hasLinks = false;
  const html = mapNoteLinks(notes, escapeHtml, (reference) => {
    const target = targets.get(noteLinkKey(reference));
    if (!target) return escapeHtml(reference.label);

    hasLinks = true;
    return /* HTML */ `<a
      class="listen-note-link"
      href="#${target.type}/${escapeHtml(encodeURIComponent(target.id))}"
      >${escapeHtml(target.label)}</a
    >`;
  });
  return { html, hasLinks };
}
