import type { ExternalLink } from "../types/albums";
import { escapeHtml } from "./html";
import { icon } from "./icons";
import { webUrl } from "./presentation";

const providers = [
  {
    name: "Apple Music",
    icon: "music",
    matches: (domain: string) => domain === "music.apple.com",
  },
  {
    name: "YouTube",
    icon: "play",
    matches: (domain: string) =>
      [
        "youtube.com",
        "music.youtube.com",
        "m.youtube.com",
        "youtu.be",
      ].includes(domain),
  },
  {
    name: "Wikipedia",
    icon: "wikipedia",
    matches: (domain: string) =>
      domain === "wikipedia.org" || domain.endsWith(".wikipedia.org"),
  },
  {
    name: "Discogs",
    icon: "discogs",
    matches: (domain: string) =>
      domain === "discogs.com" || domain.endsWith(".discogs.com"),
  },
] as const;

interface LinkPresentation {
  href: string;
  label: string;
  iconName: string;
  priority: number;
  provider?: (typeof providers)[number]["name"];
}

function orderedLinks(links: readonly ExternalLink[]): LinkPresentation[] {
  return links
    .flatMap((link) => {
      const parsed = webUrl(link.url);
      if (!parsed) return [];

      const domain = parsed.hostname.replace(/^www\./, "");
      const index = providers.findIndex((provider) => provider.matches(domain));
      const provider = providers[index];

      return [
        {
          href: parsed.href,
          label: link.label || provider?.name || domain,
          iconName: provider?.icon ?? "link",
          priority: index < 0 ? providers.length : index,
          provider: provider?.name,
        },
      ];
    })
    .sort((a, b) => a.priority - b.priority);
}

export interface ListeningLink {
  href: string;
  provider: "Apple Music" | "YouTube";
}

export function preferredListeningLink(
  links: readonly ExternalLink[],
): ListeningLink | undefined {
  for (const { href, provider } of orderedLinks(links)) {
    if (provider === "Apple Music" || provider === "YouTube") {
      return { href, provider };
    }
  }
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
  const inlineCount = links[2]?.provider ? 3 : 2;
  const inline = links.slice(0, inlineCount);
  const extra = links.slice(inlineCount);

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
  const items = orderedLinks(links);

  if (!items.length) return "";
  if (appearance === "icons") return renderArtistLinks(items);

  return /* HTML */ `<div class="external-links">
    ${items.map((link) => renderLink(link)).join("")}
  </div>`;
}
