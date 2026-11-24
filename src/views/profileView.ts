import { currentTheme, themeOptions } from "../app/theme.ts";
import { libraryUrl } from "../app/libraryUrl.ts";
import { renderActivitySection } from "./activityView.ts";
import type { LibraryData } from "../types/library";
import type { Album } from "../types/albums";
import { escapeHtml } from "../components/html.ts";
import { icon } from "../components/icons.ts";
import { latestRatedListen } from "../components/presentation.ts";

export type YearGrouping = "decade" | "year";

interface ChartBin {
  label: string;
  count: number;
}

export interface ProfileStatistics {
  albums: number;
  artists: number;
  listens: number;
  average: number | undefined;
  unrated: number;
  unknownYear: number;
  ratings: ChartBin[];
  years: ChartBin[];
}

export function profileStatistics(
  albums: Album[],
  grouping: YearGrouping,
): ProfileStatistics {
  const ratings = Array.from({ length: 10 }, (_, index) => ({
    label: String((index + 1) / 2),
    count: 0,
  }));
  const yearCounts = new Map<number, number>();
  const artists = new Set<string>();
  let listens = 0;
  let rated = 0;
  let totalRating = 0;
  let unknownYear = 0;

  for (const album of albums) {
    album.artists.forEach((artist) => artists.add(artist.id));
    listens += album.listeningEntries.length;
    const rating = latestRatedListen(album)?.rating;
    if (
      rating !== undefined &&
      Number.isInteger(rating) &&
      rating >= 1 &&
      rating <= 10
    ) {
      ratings[rating - 1].count++;
      rated++;
      totalRating += rating / 2;
    }

    if (album.releaseYear === null) {
      unknownYear++;
      continue;
    }
    const year =
      grouping === "decade"
        ? Math.floor(album.releaseYear / 10) * 10
        : album.releaseYear;
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
  }

  const years: ChartBin[] = [];
  if (yearCounts.size) {
    const sorted = [...yearCounts.keys()].sort((a, b) => a - b);
    const step = grouping === "decade" ? 10 : 1;
    for (
      let year = sorted[0];
      year <= sorted[sorted.length - 1];
      year += step
    ) {
      years.push({
        label: `${year}${grouping === "decade" ? "s" : ""}`,
        count: yearCounts.get(year) ?? 0,
      });
    }
  }

  return {
    albums: albums.length,
    artists: artists.size,
    listens,
    average: rated ? totalRating / rated : undefined,
    unrated: albums.length - rated,
    unknownYear,
    ratings,
    years,
  };
}

function chartBinUrl(
  bin: ChartBin,
  rating: boolean,
  grouping: YearGrouping,
): string {
  if (rating)
    return libraryUrl({
      filters: { rating: { operator: "eq", value: Number(bin.label) } },
    });
  const year = Number.parseInt(bin.label, 10);
  return libraryUrl({
    filters: {
      releaseYear:
        grouping === "decade"
          ? { operator: "between", min: year, max: year + 9 }
          : { operator: "eq", value: year },
    },
  });
}

function renderChart(
  bins: ChartBin[],
  label: string,
  stars = false,
  compact = false,
  grouping: YearGrouping = "decade",
): string {
  const maximum = Math.max(1, ...bins.map((bin) => bin.count));
  return /* HTML */ `<div
    class="profile-chart-scroll"
    role="region"
    aria-label="${escapeHtml(label)}"
    tabindex="0"
  >
    <div
      class="profile-chart${compact ? " profile-chart-years" : ""}"
      role="list"
      style="--bins:${bins.length}"
    >
      ${bins
        .map(
          (bin) =>
            /* HTML */ `<a
              href="${escapeHtml(chartBinUrl(bin, stars, grouping))}"
              class="chart-column"
              role="listitem"
              tabindex="0"
              aria-label="${escapeHtml(bin.label)}${stars ? " stars" : ""}: ${bin.count} albums"
            >
              <span class="chart-bar-space"
                ><span class="chart-count"
                  >${compact ? `${bin.label}: ${bin.count} albums` : bin.count}</span
                ><span
                  class="chart-bar"
                  style="--height:${(bin.count / maximum) * 100}%"
                ></span
              ></span>
              ${compact ? "" : /* HTML */ `<span class="chart-label">${escapeHtml(bin.label)}</span>`}
            </a>`,
        )
        .join("")}
    </div>
  </div>`;
}

export function renderProfileView(
  library: LibraryData,
  email: string | undefined,
  authenticated: boolean,
  grouping: YearGrouping,
): string {
  const stats = profileStatistics(library.albums, grouping);
  const metrics = [
    ["Albums", stats.albums],
    ["Artists", stats.artists],
    ["Listens", stats.listens],
    [
      "Avg. rating",
      stats.average === undefined ? "—" : `${stats.average.toFixed(2)} / 5`,
    ],
  ];

  return /* HTML */ `<div class="profile-page">
    <a class="back-link" href="#">${icon("back", 17)} Back to library</a>
    <header class="profile-heading">
      <div>
        <h1 id="page-title">Profile</h1>
        <p id="profile-email">
          ${escapeHtml(email ?? (authenticated ? "Your account" : "Demo library"))}
        </p>
      </div>
      <button
        type="button"
        class="button secondary"
        data-action="open-profile-settings"
        aria-haspopup="dialog"
      >
        Settings
      </button>
    </header>
    <dl class="profile-stats">
      ${metrics
        .map(
          ([label, value]) =>
            /* HTML */ `<div>
              <dt>${label}</dt>
              <dd>${value}</dd>
            </div>`,
        )
        .join("")}
    </dl>
    <div class="profile-charts">
      <section class="profile-panel" aria-labelledby="ratings-heading">
        <h2 id="ratings-heading">Your ratings</h2>
        ${renderChart(stats.ratings, "Rating distribution", true)}
        <p class="profile-note">
          Unrated: ${stats.unrated}
          albums${!stats.albums ? " · Add an album to start your catalog." : ""}
        </p>
      </section>
      <section class="profile-panel" aria-labelledby="years-heading">
        <div class="profile-panel-heading">
          <h2 id="years-heading">Albums by release year</h2>
          <div
            class="profile-grouping"
            role="group"
            aria-label="Group release years"
          >
            <button
              type="button"
              data-action="profile-grouping"
              data-grouping="decade"
              aria-pressed="${grouping === "decade"}"
            >
              By decade
            </button>
            <button
              type="button"
              data-action="profile-grouping"
              data-grouping="year"
              aria-pressed="${grouping === "year"}"
            >
              By year
            </button>
          </div>
        </div>
        ${stats.years.length ? renderChart(stats.years, "Release year distribution", false, grouping === "year", grouping) : /* HTML */ `<p class="profile-chart-empty">Add release years to see your collection’s eras.</p>`}
        <p class="profile-note">
          Unknown release year: ${stats.unknownYear} albums
        </p>
      </section>
    </div>
    ${renderActivitySection(library)} ${renderProfileSettings(authenticated)}
  </div>`;
}

function renderProfileSettings(authenticated: boolean): string {
  return /* HTML */ `<dialog
    id="profile-settings"
    aria-labelledby="profile-settings-title"
  >
    <div class="dialog-heading">
      <h2 id="profile-settings-title">Settings</h2>
      <button
        type="button"
        class="icon-button close"
        data-action="close-profile-settings"
        aria-label="Close settings"
        autofocus
      >
        ${icon("close")}
      </button>
    </div>
    <div class="dialog-body">
      <section class="profile-account" aria-labelledby="appearance-heading">
        <div>
          <h3 id="appearance-heading">Appearance</h3>
          <p>Choose a mood for Sleeve. Saved on this device.</p>
        </div>
        <label class="theme-picker">
          <span>Theme</span>
          <select id="theme-select" name="theme">
            ${themeOptions()
              .map(
                ({ id, label }) =>
                  /* HTML */ `<option
                    value="${id}"
                    ${currentTheme() === id ? "selected" : ""}
                  >
                    ${escapeHtml(label)}
                  </option>`,
              )
              .join("")}
          </select>
        </label>
      </section>
      <section class="profile-account" aria-labelledby="account-heading">
        <div>
          <h3 id="account-heading">Account</h3>
          <p>
            ${authenticated ? "Signed in to Sleeve" : "You’re exploring the demo library."}
          </p>
        </div>
        <button
          type="button"
          class="button secondary"
          data-action="profile-account"
        >
          ${authenticated ? "Sign out" : "Sign in"}
        </button>
      </section>
    </div>
  </dialog>`;
}
