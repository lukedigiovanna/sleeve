import { librarySorting, selectBrowseSort } from "../components/sortOptions";
import type { Album, Artist, Genre, Instrument } from "../types/albums";
import type { LibraryData } from "../types/library";
import { isLibraryRoute, libraryUrl, parseLibraryUrl } from "./libraryUrl";
import { filterFields } from "./libraryFilters";
import {
  readLibraryFilters,
  updateBrowseFilters,
  toggleSelectedRating,
} from "../components/libraryFilters";
import { categoryFields } from "./libraryCategoryFilters";
import {
  searchCategoryFilter,
  selectCategoryFilter,
  type CategoryFilterControls,
} from "../components/libraryCategoryFilters";
import type { LibraryState } from "../views/libraryView";
import { renderLibraryView, updateLibrary } from "../views/libraryView";
import { renderAlbumDetailView } from "../views/albumDetailView";
import {
  artistUrl,
  renderArtistAlbums,
  renderArtistDetail,
} from "../views/artistsView";
import { renderGenreDetail } from "../views/genresView";
import { renderInstrumentDetail } from "../views/instrumentsView";
import { albumUrl } from "../components/presentation";
import { icon } from "../components/icons";
import { escapeHtml } from "../components/html";
import { focusForTyping } from "./device";
import { genreUrl } from "./genres";
import { instrumentUrl } from "./instruments";
import { readLayout, saveLayout } from "./layoutPreferences";
import { createRouteHistory } from "./routeHistory";
import { createLifecycle } from "./lifecycle";
import { MobileTabPanels } from "./mobileTabPanels";

import { renderProfileView, type YearGrouping } from "../views/profileView";

type RouteSection =
  "profile" | "genres" | "artists" | "instruments" | "library";

interface RouteItems {
  genre: Genre | undefined;
  artist: Artist | undefined;
  instrument: Instrument | undefined;
  album: Album | undefined;
}

const listRouteLabels = new Map([
  ["", "library"],
  ["#", "library"],
  ["#artists", "artists"],
  ["#genres", "genres"],
  ["#instruments", "instruments"],
]);

export function isProfileRoute(hash: string): boolean {
  return hash === "#profile" || hash === "#activity";
}

function routeSection(hash: string): RouteSection {
  if (isProfileRoute(hash)) return "profile";
  if (hash === "#genres" || hash.startsWith("#genre/")) return "genres";
  if (hash === "#artists" || hash.startsWith("#artist/")) return "artists";
  if (hash === "#instruments" || hash.startsWith("#instrument/"))
    return "instruments";
  return "library";
}

export interface AppRouterDependencies {
  accountId: string;
  accountEmail: () => string | undefined;
  main: HTMLElement;
  library: () => LibraryData;
  libraryRevision: () => number;
  lists: {
    artists: (root: HTMLElement) => void;
    genres: (root: HTMLElement) => void;
    instruments: (root: HTMLElement) => void;
  };
  onRendered: () => void;
  onUrlChanged: () => void;
}

export class AppRouter {
  private readonly dependencies: AppRouterDependencies;
  private readonly lifecycle = createLifecycle();
  private readonly routeHistory;
  private readonly originalScrollRestoration = history.scrollRestoration;
  private readonly detailLayouts = {
    artist: readLayout("artist"),
    genre: readLayout("genre"),
  };
  private readonly tabs: MobileTabPanels;
  private renderedHash = location.hash;
  private renderedRevision: number;
  private yearGrouping: YearGrouping = "decade";
  private readonly state: LibraryState = {
    query: "",
    filters: {},
    sort: { category: "created", direction: "descending" },
    layout: readLayout("library"),
  };

  constructor(dependencies: AppRouterDependencies) {
    this.dependencies = dependencies;
    this.tabs = new MobileTabPanels((hash, root) =>
      this.renderListRoute(hash, root),
    );
    this.renderedRevision = dependencies.libraryRevision();
    this.lifecycle.listen(this.tabs.media).addEventListener("change", () => {
      this.tabs.resize(this.renderedHash);
    });
    this.routeHistory = createRouteHistory(dependencies.accountId);
    history.scrollRestoration = "manual";
    this.lifecycle
      .listen(window)
      .addEventListener("scroll", () => this.routeHistory.saveScroll());
    this.readLibraryUrl();
    this.listen();
  }

  public navigate(): void {
    const hash = location.hash;
    const mobile = this.tabs.media.matches;
    const dataChanged = this.syncTabData();
    if (mobile && this.renderedHash !== hash) {
      this.tabs.saveScroll(this.renderedHash, window.scrollY);
      if (!dataChanged)
        this.tabs.leave(this.renderedHash, this.dependencies.main);
    }
    this.readLibraryUrl();
    const scroll = this.routeHistory.arrive(
      mobile ? this.tabs.scrollFor(hash) : 0,
    );
    this.renderRoute(true, mobile && this.tabs.supports(hash), scroll);
  }

  private readLibraryUrl(): void {
    if (!isLibraryRoute(location.hash)) return;
    const state = parseLibraryUrl(location.hash);
    this.state.query = state.query;
    this.state.filters = state.filters;
  }

  private syncLibraryUrl(): void {
    if (!isLibraryRoute(location.hash)) return;
    const hash = libraryUrl(this.state);
    if (hash === location.hash) return;
    history.replaceState(history.state, "", hash);
    this.routeHistory.replace();
    this.renderedHash = location.hash;
    this.tabs.rememberLibrary(location.hash);
    this.dependencies.onUrlChanged();
  }

  public replaceHistory(): void {
    this.routeHistory.replace();
  }

  public activeAlbum(): Album | undefined {
    return this.dependencies
      .library()
      .albums.find((album) => albumUrl(album.id) === location.hash);
  }

  public activeInstrument(): Instrument | undefined {
    return this.dependencies
      .library()
      .instruments.find((item) => instrumentUrl(item.id) === location.hash);
  }

  private renderListRoute(hash: string, root: HTMLElement): void {
    if (hash === "#artists") this.dependencies.lists.artists(root);
    else if (hash === "#genres") this.dependencies.lists.genres(root);
    else if (hash === "#instruments") this.dependencies.lists.instruments(root);
    else {
      const state =
        root === this.dependencies.main
          ? this.state
          : { ...this.state, ...parseLibraryUrl(hash) };
      root.innerHTML = renderLibraryView(state, this.dependencies.library());
      updateLibrary(
        this.dependencies.library().albums,
        state,
        this.dependencies.library().genres,
        root,
      );
    }
  }

  private syncTabData(): boolean {
    const revision = this.dependencies.libraryRevision();
    if (revision === this.renderedRevision) return false;

    this.renderedRevision = revision;
    this.tabs.invalidate();
    return true;
  }

  public render(focus = false): void {
    this.syncTabData();
    this.renderRoute(focus, false);
  }

  private renderRoute(focus: boolean, useCachedTab: boolean, scroll = 0): void {
    const hash = location.hash;
    const library = this.dependencies.library();
    const genre = hash.startsWith("#genre/")
      ? library.genres.find((item) => genreUrl(item.id) === hash)
      : undefined;
    const artist = hash.startsWith("#artist/")
      ? library.artists.find((item) => artistUrl(item.id) === hash)
      : undefined;
    const album = hash.startsWith("#album/") ? this.activeAlbum() : undefined;
    const instrument = hash.startsWith("#instrument/")
      ? this.activeInstrument()
      : undefined;
    const section = routeSection(hash);

    for (const link of document.querySelectorAll<HTMLElement>("[data-nav]")) {
      if (link.dataset.nav === section)
        link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    const profileLink = document.querySelector('[href="#profile"]');
    if (section === "profile")
      profileLink?.setAttribute("aria-current", "page");
    else profileLink?.removeAttribute("aria-current");

    const missing = location.hash.startsWith("#album/") && !album;
    if (useCachedTab) {
      this.tabs.show(location.hash, this.dependencies.main);
    } else if (section === "profile") {
      this.dependencies.main.innerHTML = renderProfileView(
        this.dependencies.library(),
        this.dependencies.accountEmail(),
        this.dependencies.accountId !== "demo",
        this.yearGrouping,
      );
    } else if (section === "genres") {
      if (genre)
        this.dependencies.main.innerHTML = renderGenreDetail(
          genre,
          this.dependencies.library().genres,
          this.dependencies.library().albums,
          this.detailLayouts.genre,
        );
      else if (location.hash === "#genres")
        this.renderListRoute("#genres", this.dependencies.main);
      else
        this.dependencies.main.innerHTML = /* HTML */ `<div class="empty">
          <h1 id="page-title">Genre unavailable</h1>
          <a href="#genres">Back to genres</a>
        </div>`;
    } else if (
      listRouteLabels.has(location.hash) &&
      !isLibraryRoute(location.hash)
    ) {
      this.renderListRoute(location.hash, this.dependencies.main);
    } else if (artist) {
      this.dependencies.main.innerHTML = renderArtistDetail(
        artist,
        this.dependencies.library().albums,
        this.detailLayouts.artist,
      );
    } else if (section === "artists") {
      this.dependencies.main.innerHTML = /* HTML */ `<div class="empty">
        <h1 id="page-title">Artist unavailable</h1>
        <a href="#artists">Back to artists</a>
      </div>`;
    } else if (instrument) {
      this.dependencies.main.innerHTML = renderInstrumentDetail(
        instrument,
        this.dependencies.library().albums,
      );
    } else if (section === "instruments") {
      this.dependencies.main.innerHTML = /* HTML */ `<div
        class="empty route-empty"
      >
        <h1 id="page-title">Instrument unavailable</h1>
        <p>This instrument may have been deleted.</p>
        <a class="button secondary" href="#instruments">Back to instruments</a>
      </div>`;
    } else if (album) {
      this.dependencies.main.innerHTML = renderAlbumDetailView(
        album,
        this.dependencies.library(),
      );
    } else if (missing) {
      this.dependencies.main.innerHTML = /* HTML */ `<div
        class="empty route-empty"
      >
        ${icon("disc", 35)}
        <h1 id="page-title">Album unavailable</h1>
        <p>This album may have been added in another browser.</p>
        <a class="button secondary" href="#">${icon("back")} Back to library</a>
      </div>`;
    } else {
      this.renderListRoute("#", this.dependencies.main);
    }
    const backLink = this.dependencies.main.querySelector<HTMLAnchorElement>(
      '.back-link, .empty a[href^="#"]',
    );
    const previous = this.routeHistory.previous();
    if (backLink && previous !== undefined) {
      const label = this.routeLabel(previous);
      backLink.href = previous || "#";
      backLink.innerHTML = /* HTML */ `${icon("back", 17)} Back to
      ${escapeHtml(label)}`;
      backLink.dataset.routeBack = "";
    }
    document.title = this.pageTitle(section, {
      genre,
      artist,
      instrument,
      album,
    });
    this.renderedHash = location.hash;
    this.tabs.rememberLibrary(this.renderedHash);
    this.dependencies.onRendered();
    this.tabs.warm(this.renderedHash);
    if (focus) {
      window.scrollTo(0, scroll);
      const heading = document.querySelector<HTMLElement>("#page-title");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
    }
  }

  private routeLabel(hash: string): string {
    if (isLibraryRoute(hash)) return "library";
    if (isProfileRoute(hash)) return "profile";
    const listLabel = listRouteLabels.get(hash);
    if (listLabel !== undefined) return listLabel;

    const library = this.dependencies.library();

    switch (hash.split("/")[0]) {
      case "#album":
        return (
          library.albums.find((item) => albumUrl(item.id) === hash)?.title ??
          "previous page"
        );
      case "#artist":
        return (
          library.artists.find((item) => artistUrl(item.id) === hash)?.name ??
          "previous page"
        );
      case "#genre":
        return (
          library.genres.find((item) => genreUrl(item.id) === hash)?.name ??
          "previous page"
        );
      case "#instrument":
        return (
          library.instruments.find((item) => instrumentUrl(item.id) === hash)
            ?.name ?? "previous page"
        );
      default:
        return "previous page";
    }
  }

  private pageTitle(section: RouteSection, items: RouteItems): string {
    switch (section) {
      case "profile":
        return "Profile — Sleeve";
      case "genres":
        return `${items.genre?.name ?? "Genres"} — Sleeve`;
      case "artists":
        return `${items.artist?.name ?? "Artists"} — Sleeve`;
      case "instruments":
        return `${items.instrument?.name ?? "Instruments"} — Sleeve`;
      case "library":
        if (items.album) return `${items.album.title} — Sleeve`;
        return "Sleeve — Your library";
    }
  }

  public renderPreview(hash: string): HTMLElement {
    return this.tabs.renderPreview(hash);
  }

  public prepareTab(hash: string): HTMLElement {
    return this.tabs.prepare(hash);
  }

  public restoreTabPreview(hash: string, element: HTMLElement): void {
    this.tabs.restorePreview(hash, element);
  }

  public tabScroll(hash: string): number {
    return this.tabs.scrollFor(hash);
  }

  public updateCatalogFilters(focusId: string): void {
    this.render();
    const dropdown = this.dependencies.main.querySelector<HTMLDetailsElement>(
      ".genre-filter-dropdown",
    );
    if (dropdown) dropdown.open = true;
    this.dependencies.main.querySelector<HTMLElement>(`#${focusId}`)?.focus();
  }

  private openArtistPhoto(button: HTMLButtonElement): void {
    const dialog =
      button.parentElement?.querySelector<HTMLDialogElement>("#artist-photo");
    if (!dialog) return;

    const isBackdrop = (event: MouseEvent): boolean => {
      if (event.target !== dialog) return false;

      const { left, right, top, bottom } = dialog.getBoundingClientRect();
      return (
        event.clientX < left ||
        event.clientX >= right ||
        event.clientY < top ||
        event.clientY >= bottom
      );
    };

    let startedOnBackdrop = false;
    dialog.onpointerdown = (event) => {
      startedOnBackdrop = isBackdrop(event);
    };
    dialog.onclick = (event) => {
      if (startedOnBackdrop && isBackdrop(event)) dialog.close();
    };
    dialog.showModal();
  }

  public click(button: HTMLButtonElement): boolean {
    switch (button.dataset.action) {
      case "open-artist-photo":
        this.openArtistPhoto(button);
        return true;
      case "close-artist-photo":
        button.closest("dialog")?.close();
        return true;
      case "open-profile-settings":
        this.dependencies.main
          .querySelector<HTMLDialogElement>("#profile-settings")
          ?.showModal();
        return true;
      case "close-profile-settings":
        button.closest("dialog")?.close();
        return true;
      case "profile-grouping": {
        const grouping = button.dataset.grouping;
        if (grouping !== "decade" && grouping !== "year") return false;

        this.yearGrouping = grouping;
        this.render();
        this.dependencies.main
          .querySelector<HTMLElement>(`[data-grouping="${grouping}"]`)
          ?.focus({ preventScroll: true });
        return true;
      }
      case "library-sort": {
        const sort = selectBrowseSort(button, librarySorting, this.state.sort);
        if (sort === undefined) return false;

        this.state.sort = sort;
        updateLibrary(
          this.dependencies.library().albums,
          this.state,
          this.dependencies.library().genres,
        );
        return true;
      }
      case "artist-layout": {
        const library = this.dependencies.library();
        const artist = library.artists.find(
          (item) => artistUrl(item.id) === location.hash,
        );
        const albums = this.dependencies.main.querySelector<HTMLElement>(
          "[data-artist-albums]",
        );
        if (!artist || !albums) return false;

        const layout = button.dataset.layout === "list" ? "list" : "grid";
        if (layout !== this.detailLayouts.artist) {
          this.detailLayouts.artist = layout;
          saveLayout("artist", layout);
          albums.innerHTML = renderArtistAlbums(artist, library.albums, layout);
          for (const toggle of this.dependencies.main.querySelectorAll(
            '[data-action="artist-layout"]',
          )) {
            toggle.setAttribute("aria-pressed", String(toggle === button));
          }
          this.dependencies.onRendered();
        }
        button.focus({ preventScroll: true });
        return true;
      }
      case "genre-layout": {
        const layout = button.dataset.layout === "list" ? "list" : "grid";
        this.detailLayouts.genre = layout;
        saveLayout("genre", layout);
        this.render();
        this.dependencies.main
          .querySelector<HTMLButtonElement>(
            `[data-action="genre-layout"][data-layout="${layout}"]`,
          )
          ?.focus();
        return true;
      }
      case "layout": {
        const layout = button.dataset.layout === "list" ? "list" : "grid";
        this.state.layout = layout;
        saveLayout("library", layout);
        for (const toggle of document.querySelectorAll("[data-layout]")) {
          toggle.setAttribute(
            "aria-pressed",
            toggle === button ? "true" : "false",
          );
        }
        updateLibrary(
          this.dependencies.library().albums,
          this.state,
          this.dependencies.library().genres,
        );
        return true;
      }
      case "remove-library-filter": {
        const field = filterFields.find(
          (field) => field === button.dataset.filter,
        );
        if (field) delete this.state.filters[field];
        this.syncLibraryUrl();
        this.render();
        this.dependencies.main
          .querySelector<HTMLElement>(".library-toolbar summary")
          ?.focus();
        return true;
      }
      case "add-library-category":
      case "remove-library-category": {
        if (!selectCategoryFilter(button, this.categoryControls()))
          return false;
        this.updateLibraryResults();
        return true;
      }
      case "clear-library-year": {
        const root = this.dependencies.main;
        const min = root.querySelector<HTMLSelectElement>("#releaseYear-min");
        const max = root.querySelector<HTMLSelectElement>("#releaseYear-max");
        if (!min || !max) return false;

        min.value = "";
        max.value = "";
        min.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      case "clear-library-filters":
        this.state.filters = {};
        this.syncLibraryUrl();
        this.updateCatalogFilters("rating-unset");
        return true;
      case "clear":
        this.state.query = "";
        this.state.filters = {};
        this.syncLibraryUrl();
        this.render();
        focusForTyping(
          document.querySelector<HTMLInputElement>("#library-query"),
        );
        return true;

      default:
        return false;
    }
  }

  public input(input: HTMLInputElement): void {
    if (input.dataset.categorySearch) {
      searchCategoryFilter(input, this.categoryControls());
      return;
    }
    if (input.id !== "library-query") return;
    this.state.query = input.value;
    this.syncLibraryUrl();
    updateLibrary(
      this.dependencies.library().albums,
      this.state,
      this.dependencies.library().genres,
    );
  }

  public change(input: HTMLInputElement): void {
    if (
      input.closest(".library .library-filter-controls") &&
      !input.dataset.categorySearch
    ) {
      const root = this.dependencies.main;
      this.state.filters = readLibraryFilters(root, this.state.filters);
      this.updateLibraryResults();
    }
  }

  private categoryControls(): CategoryFilterControls {
    return {
      scope: "library",
      fields: categoryFields,
      filters: this.state.filters,
      data: this.dependencies.library(),
    };
  }

  private updateLibraryResults(): void {
    this.syncLibraryUrl();
    const root = this.dependencies.main;
    updateBrowseFilters(
      root,
      this.state.filters,
      this.dependencies.library(),
      "library",
    );
    updateLibrary(
      this.dependencies.library().albums,
      this.state,
      this.dependencies.library().genres,
      root,
    );
  }

  private switchMobileTab(event: MouseEvent): void {
    if (
      !this.tabs.media.matches ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;

    const link = (event.target as Element).closest<HTMLAnchorElement>(
      ".main-nav a[data-nav]",
    );
    if (!link || link.hash === location.hash) return;

    event.preventDefault();
    const oldURL = location.href;
    history.pushState(null, "", link.href);
    // Run the shared route handoff before the next tap can target the old panel.
    window.dispatchEvent(
      new HashChangeEvent("hashchange", { oldURL, newURL: location.href }),
    );
  }

  private listen(): void {
    this.lifecycle.listen(document).addEventListener("click", (event) => {
      if (event.target instanceof HTMLInputElement)
        toggleSelectedRating(event.target);
      this.routeHistory.saveScroll();
      const backLink = (event.target as Element).closest("a[data-route-back]");
      if (
        backLink &&
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        event.preventDefault();
        history.back();
        return;
      }
      for (const dropdown of this.dependencies.main.querySelectorAll<HTMLDetailsElement>(
        ".genre-filter-dropdown[open], .library-sort-dropdown[open]",
      )) {
        if (!event.composedPath().includes(dropdown)) dropdown.open = false;
      }
      this.switchMobileTab(event);
    });
    this.lifecycle.listen(document).addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      for (const dropdown of this.dependencies.main.querySelectorAll<HTMLDetailsElement>(
        ".genre-filter-dropdown[open], .library-sort-dropdown[open]",
      )) {
        dropdown.open = false;
        dropdown.querySelector<HTMLElement>("summary")?.focus();
      }
    });
  }

  public dispose(): void {
    this.lifecycle.dispose();
    this.tabs.invalidate();
    history.scrollRestoration = this.originalScrollRestoration;
  }
}
