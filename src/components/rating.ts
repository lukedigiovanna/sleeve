import { escapeHtml } from "./html.ts";
import { starPath } from "./icons.ts";
import { displayRating } from "./presentation.ts";

const starMask = `url("data:image/svg+xml,${encodeURIComponent(
  /* HTML */ `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path
      d="${starPath}"
      stroke="black"
      stroke-width="1.65"
      stroke-linejoin="round"
    />
  </svg>`,
)}")`;

export function stars(rating: number): string {
  return /* HTML */ `<span
    class="stars"
    aria-hidden="true"
    style="--star-mask:${escapeHtml(starMask)}"
    >${Array.from({ length: 5 }, (_, i) => {
      const fill = Math.max(0, Math.min(2, rating - i * 2));

      return /* HTML */ `<span class="star" style="--star-index:${i}"
        ><svg viewBox="0 0 24 24"><path d="${starPath}" /></svg
        ><span class="star-fill" style="--fill:${fill * 50}%"
          ><svg viewBox="0 0 24 24"><path d="${starPath}" /></svg></span
      ></span>`;
    }).join("")}</span
  >`;
}

export function renderRating(rating: number | null | undefined): string {
  return rating
    ? /* HTML */ `<span
        class="rating"
        aria-label="${displayRating(rating)} out of 5 stars"
        >${stars(rating)}</span
      >`
    : /* HTML */ `<span class="rating unrated" aria-label="Unrated"
        >${stars(0)}</span
      >`;
}
