import { escapeHtml } from "./html";
import { renderLayoutToggle } from "./layoutToggle";

interface AlbumListHeadingOptions {
  id?: string;
  count?: number;
}

export function renderAlbumListHeading(
  title: string,
  layout: string,
  action: string,
  { id, count }: AlbumListHeadingOptions = {},
): string {
  return /* HTML */ `<div class="album-list-heading">
    <div class="detail-heading">
      <h2 ${id ? `id="${escapeHtml(id)}"` : ""}>${escapeHtml(title)}</h2>
      ${count === undefined ? "" : /* HTML */ `<span class="count-pill">${count}</span>`}
    </div>
    ${renderLayoutToggle(layout, `${title} layout`, action)}
  </div>`;
}
