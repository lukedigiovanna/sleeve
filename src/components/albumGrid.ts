import type { Album } from "../types/albums";
import { renderAlbumCard } from "./albumCard";

export function renderAlbumGrid(
  albums: Album[],
  layout: string = "grid",
): string {
  const isList = layout === "list";
  return /* HTML */ `<ul
    class="album-collection ${isList ? "album-list divided-rows" : "album-grid"}"
  >
    ${albums.map((album) => renderAlbumCard(album, isList)).join("")}
  </ul>`;
}
