import type { ExternalLink } from "../types/albums";
import { escapeHtml } from "./html";
import { icon } from "./icons";
import { webUrl } from "./presentation";

function linkProvider(domain: string): { name: string; icon: string } {
  if (domain === "music.apple.com")
    return { name: "Apple Music", icon: "music" };
  if (
    ["youtube.com", "music.youtube.com", "m.youtube.com", "youtu.be"].includes(
      domain,
    )
  )
    return { name: "YouTube", icon: "play" };
  if (domain === "wikipedia.org" || domain.endsWith(".wikipedia.org"))
    return { name: "Wikipedia", icon: "wikipedia" };
  if (domain === "discogs.com" || domain.endsWith(".discogs.com"))
    return { name: "Discogs", icon: "disc" };
  return { name: domain, icon: "link" };
}

interface LinkPresentation {
  href: string;
  label: string;
  iconName: string;
}

function renderLink(link: LinkPresentation, iconOnly = false): string {
  const label = escapeHtml(link.label);
  const href = escapeHtml(link.href);
  if (iconOnly)
    return /* HTML */ `<a
      class="artist-link-icon"
      href="${href}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="${label} (opens in a new tab)"
    >
      ${icon(link.iconName, 14)}
      <span class="artist-link-label" aria-hidden="true">${label}</span>
    </a>`;

  return /* HTML */ `<a
    class="external-link"
    href="${href}"
    target="_blank"
    rel="noopener noreferrer"
  >
    <span>${icon(link.iconName, 19)} ${label}</span>
    ${icon("external", 18)}<span class="sr-only"> (opens in a new tab)</span>
  </a>`;
}

function renderArtistLinks(links: LinkPresentation[]): string {
  const ordered = [
    ...links.filter((link) => link.iconName !== "link"),
    ...links.filter((link) => link.iconName === "link"),
  ];
  const inline = ordered.slice(0, 2);
  const discogs = ordered.find((link) => link.iconName === "disc");
  if (discogs && !inline.includes(discogs)) inline.push(discogs);

  const extra = ordered.filter((link) => !inline.includes(link));
  return /* HTML */ `<div
    class="artist-links"
    role="group"
    aria-label="Artist links"
  >
    ${inline.map((link) => renderLink(link, true)).join("")}
    ${
      extra.length
        ? /* HTML */ `<details class="artist-more-links">
            <summary class="artist-link-icon" aria-label="More links">
              <span aria-hidden="true">⋯</span>
            </summary>
            <div class="external-links">
              ${extra.map((link) => renderLink(link)).join("")}
            </div>
          </details>`
        : ""
    }
  </div>`;
}

export function renderExternalLinks(
  links: readonly ExternalLink[],
  appearance: "list" | "icons" = "list",
): string {
  const items = links.flatMap((link) => {
    const parsed = webUrl(link.url);
    if (!parsed) return [];
    const provider = linkProvider(parsed.hostname.replace(/^www\./, ""));
    return [
      {
        href: parsed.href,
        label: link.label || provider.name,
        iconName: provider.icon,
      },
    ];
  });
  if (!items.length) return "";
  if (appearance === "icons") return renderArtistLinks(items);

  return /* HTML */ `<div class="external-links">
    ${items.map((link) => renderLink(link)).join("")}
  </div>`;
}
