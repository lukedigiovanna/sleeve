import { artistSorting, selectBrowseSort } from "../components/sortOptions";
import {
  searchCategoryFilter,
  selectCategoryFilter,
  type CategoryFilterControls,
} from "../components/libraryCategoryFilters";
import { updateBrowseFilters } from "../components/libraryFilters";
import type { EditorDialog, PickerInteraction } from "./editorContracts";
import { updateCatalogImage } from "../components/formFields";
import type { DraftTarget } from "./editorDrafts";

import type { LibraryData } from "../types/library";
import {
  catalogFormFooter,
  field,
  catalogImageField,
  linkRow,
} from "../components/formFields";
import { readLinkFields } from "./linkFields";
import { formValue } from "./formValues";
import { artistIdentity, findArtist } from "./artistIdentity";
import { makeId } from "./id";
import {
  artistUrl,
  artistFilterFields,
  defaultArtistSort,
  renderArtistsView,
  type ArtistsState,
  artistAlbums,
  artistRoles,
  roleLabel,
  updateArtistsView,
} from "../views/artistsView";
import type { Artist, AlbumArtist, ArtistRole } from "../types/albums";
import { icon } from "../components/icons";
import { escapeHtml } from "../components/html";
import { requiredNameSchema, optionalHttpUrlSchema } from "./formValidation";
import { findCountry } from "./countries";
import {
  CountryPicker,
  renderCountryPicker,
} from "../components/countryPicker";
import { matches } from "./search";
import { focusForTyping } from "./device";

export interface ArtistPickerSnapshot {
  selectedArtists: AlbumArtist[];
  artistChoices: Artist[];
}

export interface ArtistFeatureDependencies {
  dialog: EditorDialog;
  drafts: { begin: (target: DraftTarget) => boolean };
  persistence: {
    finishCatalogSave: (message: string, destination: string) => Promise<void>;
  };
  picker: PickerInteraction;
  readonly library: LibraryData;
  navigation: {
    renderRoute: () => void;
    updateCatalogFilters: (id: string) => void;
  };
}

function isArtistRole(value: string): value is ArtistRole {
  return artistRoles.some((role) => role === value);
}

function renderArtistForm(item?: Artist): string {
  return /* HTML */ `<form
    id="catalog-artist-form"
    data-id="${escapeHtml(item?.id ?? "")}"
  >
    <div class="dialog-body">
      ${field("Artist name", "artistName", item?.name, { attributes: 'required maxlength="150"', placeholder: "e.g. Miles Davis" })}
      ${catalogImageField("Photo URL", item?.name ?? "Artist", item?.photoUrl, true)}
      ${renderCountryPicker(item?.country)}
      <fieldset class="artist-link-fields">
        <legend>Links</legend>
        <div id="link-rows">${(item?.links ?? []).map(linkRow).join("")}</div>
        <button
          type="button"
          class="button secondary compact"
          data-action="add-link"
        >
          ${icon("plus", 15)} Add link
        </button>
      </fieldset>
      <p id="form-error" class="form-error" role="alert" hidden></p>
    </div>
    ${catalogFormFooter("Save artist")}
  </form>`;
}

function readArtistForm(
  form: HTMLFormElement,
  artists: Artist[],
  formError: EditorDialog["formError"],
): Artist | void {
  const data = new FormData(form);
  const value = (key: string) => formValue(data, key);
  const input = form.querySelector<HTMLInputElement>('[name="artistName"]')!;
  const name = value("artistName");

  if (!requiredNameSchema.safeParse(name).success)
    return formError("Enter an artist name.", input);
  if (
    artists.some(
      (item) =>
        item.id !== form.dataset.id &&
        item.name.toLowerCase() === name.toLowerCase(),
    )
  )
    return formError("An artist with this name already exists.", input);

  if (!optionalHttpUrlSchema.safeParse(value("catalogImage")).success)
    return formError(
      "Enter an HTTP or HTTPS photo URL.",
      form.querySelector('[name="catalogImage"]')!,
    );

  const existing = artists.find((item) => item.id === form.dataset.id);
  const links = readLinkFields(form, formError, existing?.links ?? []);
  if (!links) return;

  return {
    id: form.dataset.id || makeId(),
    name,
    photoUrl: value("catalogImage") || null,
    sortName: existing?.sortName ?? null,
    country: findCountry(value("country"))?.id ?? null,
    musicbrainzId: existing?.musicbrainzId ?? null,
    links,
    updatedAt: new Date().toISOString(),
  };
}

export class ArtistFeature {
  private readonly dependencies: ArtistFeatureDependencies;
  private selectedArtists: AlbumArtist[] = [];
  private artistChoices: Artist[] = [];
  private readonly browse: ArtistsState = {
    query: "",
    filters: {},
    sort: defaultArtistSort,
  };

  constructor(dependencies: ArtistFeatureDependencies) {
    this.dependencies = dependencies;
  }

  public get selections(): AlbumArtist[] {
    return this.selectedArtists;
  }

  public snapshotPicker(): ArtistPickerSnapshot {
    return structuredClone({
      selectedArtists: this.selectedArtists,
      artistChoices: this.artistChoices,
    });
  }

  public restorePicker(snapshot: ArtistPickerSnapshot): void {
    this.selectedArtists = structuredClone(snapshot.selectedArtists);
    this.artistChoices = structuredClone(snapshot.artistChoices);
  }

  public openCatalogArtist(item?: Artist): void {
    if (!this.dependencies.drafts.begin({ kind: "artist", item })) return;

    this.dependencies.dialog.show(
      item ? "Edit artist" : "Add artist",
      renderArtistForm(item),
      '[name="artistName"]',
    );
    const picker =
      this.dependencies.dialog.element.querySelector<HTMLElement>(
        ".country-picker",
      );
    if (picker) new CountryPicker(picker, this.dependencies.library.artists);
  }

  public artistPicker(credits: AlbumArtist[]): string {
    this.artistChoices = structuredClone(this.dependencies.library.artists);
    this.selectedArtists = credits.map((credit) => {
      const existing = findArtist(this.artistChoices, credit);
      if (!existing) this.artistChoices.push(artistIdentity(credit));
      return existing
        ? { ...credit, ...artistIdentity(existing) }
        : { ...credit };
    });

    return /* HTML */ `<div class="instrument-picker">
      <h3><label for="artist-query">Artists</label></h3>
      <div id="artist-selected"></div>
      <div class="catalog-search">
        <input
          id="artist-query"
          type="search"
          maxlength="150"
          autocomplete="off"
          placeholder="Search or create an artist…"
          aria-controls="artist-results"
        />
        <div
          id="artist-results"
          class="instrument-results"
          aria-label="Available artists"
        ></div>
      </div>
    </div>`;
  }

  public updateArtists(): void {
    if (this.dependencies.picker.deferRender()) return;
    const input =
      this.dependencies.dialog.element.querySelector<HTMLInputElement>(
        "#artist-query",
      );
    if (!input) return;

    const query = input.value.trim();
    this.dependencies.dialog.element.querySelector(
      "#artist-selected",
    )!.innerHTML = this.selectedArtists
      .map(
        (item, index) =>
          /* HTML */ `<div class="artist-credit-row">
            <strong>${escapeHtml(item.name)}</strong
            ><label class="field"
              ><span class="sr-only">Role for ${escapeHtml(item.name)}</span
              ><select data-artist-role="${escapeHtml(item.id)}">
                ${artistRoles.map((role) => /* HTML */ `<option value="${role}" ${item.role === role ? "selected" : ""}>${roleLabel(role)}</option>`).join("")}
              </select></label
            ><button
              type="button"
              class="icon-button"
              data-action="move-artist"
              data-id="${escapeHtml(item.id)}"
              aria-label="Move ${escapeHtml(item.name)} earlier"
              ${index === 0 ? "disabled" : ""}
            >
              ↑</button
            ><button
              type="button"
              class="icon-button"
              data-action="remove-artist"
              data-id="${escapeHtml(item.id)}"
              aria-label="Remove ${escapeHtml(item.name)}"
            >
              ${icon("close", 16)}
            </button>
          </div>`,
      )
      .join("");

    const choices = this.artistChoices
      .filter(
        (item) =>
          !this.selectedArtists.some((credit) => credit.id === item.id) &&
          matches(query, item.name, item.sortName ?? ""),
      )
      .sort((a, b) =>
        (a.sortName || a.name).localeCompare(b.sortName || b.name),
      );
    this.dependencies.dialog.element.querySelector(
      "#artist-results",
    )!.innerHTML =
      choices
        .slice(0, 20)
        .map(
          (item) =>
            /* HTML */ `<button
              type="button"
              class="button secondary compact"
              data-action="select-artist"
              data-id="${escapeHtml(item.id)}"
            >
              ${escapeHtml(item.name)}
            </button>`,
        )
        .join("") +
      (!choices.length && !query
        ? /* HTML */ `<p class="form-hint">Type a name to create one.</p>`
        : "") +
      (choices.length > 20
        ? /* HTML */ `<p class="form-hint">Type to narrow the results.</p>`
        : "") +
      (query &&
      !this.artistChoices.some(
        (item) => item.name.toLowerCase() === query.toLowerCase(),
      )
        ? /* HTML */ `<button
            type="button"
            class="button secondary compact"
            data-action="create-artist"
          >
            ${icon("plus", 14)} Create “${escapeHtml(query)}”
          </button>`
        : "");
  }

  private categoryControls(): CategoryFilterControls {
    return {
      scope: "artist",
      fields: artistFilterFields,
      filters: this.browse.filters,
      data: this.dependencies.library,
    };
  }

  private updateArtistList(): void {
    updateArtistsView(this.dependencies.library, this.browse);
  }

  private updateArtistFilters(): void {
    const root = document.querySelector<HTMLElement>(".artists-page")!;
    updateBrowseFilters(
      root,
      this.browse.filters,
      this.dependencies.library,
      "artist",
    );
    this.updateArtistList();
  }

  private clearArtistFilters(button: HTMLButtonElement): void {
    this.browse.filters = {};

    if (button.closest(".genre-filter-dropdown")) {
      this.dependencies.navigation.updateCatalogFilters(
        "artist-country-search",
      );
      return;
    }

    this.browse.query = "";
    this.dependencies.navigation.renderRoute();
    focusForTyping(document.querySelector<HTMLInputElement>("#artists-search"));
  }

  private clearArtistFilterChip(
    field: (typeof artistFilterFields)[number],
  ): void {
    delete this.browse.filters[field];
    this.dependencies.navigation.renderRoute();
    document
      .querySelector<HTMLElement>(
        ".artists-page .genre-filter-dropdown summary",
      )
      ?.focus();
  }

  public click(button: HTMLButtonElement): boolean {
    switch (button.dataset.action) {
      case "new-catalog-artist":
        this.openCatalogArtist();
        break;
      case "edit-catalog-artist":
        this.openCatalogArtist(
          this.dependencies.library.artists.find(
            (item) => artistUrl(item.id) === location.hash,
          ),
        );
        break;
      case "delete-catalog-artist":
      case "confirm-delete-artist": {
        const library = this.dependencies.library;
        const artist = library.artists.find(
          (item) => item.id === button.dataset.id,
        );
        if (!artist || artistAlbums(library.albums, artist.id).length) break;

        if (button.dataset.action === "delete-catalog-artist") {
          this.dependencies.dialog.show(
            "Delete artist?",
            /* HTML */ `<div class="dialog-body">
                <p>Delete ${escapeHtml(artist.name)} from your catalog?</p>
                <p id="form-error" class="form-error" role="alert" hidden></p>
              </div>
              <div class="dialog-footer">
                <button
                  type="button"
                  class="button secondary"
                  data-action="close"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="button primary danger"
                  data-action="confirm-delete-artist"
                  data-id="${escapeHtml(artist.id)}"
                >
                  Delete artist
                </button>
              </div>`,
            '.dialog-footer [data-action="close"]',
          );
          break;
        }

        library.artists = library.artists.filter(
          (item) => item.id !== artist.id,
        );
        void this.dependencies.persistence.finishCatalogSave(
          "Artist deleted.",
          "#artists",
        );
        break;
      }
      case "artist-sort": {
        const sort = selectBrowseSort(button, artistSorting, this.browse.sort);
        if (sort === undefined) return false;
        this.browse.sort = sort;
        this.updateArtistList();
        break;
      }
      case "add-artist-category":
      case "remove-artist-category":
        if (!selectCategoryFilter(button, this.categoryControls()))
          return false;
        this.updateArtistFilters();
        break;
      case "remove-artist-filter": {
        const field = artistFilterFields.find(
          (field) => field === button.dataset.filter,
        );
        if (!field) return false;
        this.clearArtistFilterChip(field);
        break;
      }
      case "clear-artist-filters":
        this.clearArtistFilters(button);
        break;
      case "create-artist":
      case "select-artist": {
        const input =
          this.dependencies.dialog.element.querySelector<HTMLInputElement>(
            "#artist-query",
          )!;
        let item = this.artistChoices.find(
          (item) => item.id === button.dataset.id,
        );
        if (button.dataset.action === "create-artist") {
          const name = input.value.trim();
          if (
            !name ||
            this.artistChoices.some(
              (item) => item.name.toLowerCase() === name.toLowerCase(),
            )
          )
            break;

          item = {
            id: makeId(),
            name,
            sortName: null,
            country: null,
            musicbrainzId: null,
          };
          this.artistChoices.push(item);
        }

        if (
          item &&
          !this.selectedArtists.some((credit) => credit.id === item.id)
        )
          this.selectedArtists.push({
            ...artistIdentity(item),
            role: "primary",
            position: this.selectedArtists.length,
          });

        input.value = "";
        this.updateArtists();
        focusForTyping(input);
        this.dependencies.picker.closeSearch();
        break;
      }
      case "remove-artist":
        this.selectedArtists = this.selectedArtists.filter(
          (item) => item.id !== button.dataset.id,
        );
        this.updateArtists();
        focusForTyping(
          this.dependencies.dialog.element.querySelector("#artist-query"),
        );
        break;
      case "move-artist": {
        const index = this.selectedArtists.findIndex(
          (item) => item.id === button.dataset.id,
        );

        if (index > 0)
          [this.selectedArtists[index - 1], this.selectedArtists[index]] = [
            this.selectedArtists[index],
            this.selectedArtists[index - 1],
          ];

        this.updateArtists();
        this.dependencies.dialog.element
          .querySelector<HTMLElement>(
            `[data-action="move-artist"][data-id="${button.dataset.id}"]`,
          )
          ?.focus();
        break;
      }

      default:
        return false;
    }

    return true;
  }

  public submit(form: HTMLFormElement): void {
    const item = readArtistForm(
      form,
      this.dependencies.library.artists,
      this.dependencies.dialog.formError,
    );
    if (!item) return;

    this.dependencies.library.artists = this.dependencies.library.artists
      .filter((existing) => existing.id !== item.id)
      .concat(item);
    this.dependencies.persistence.finishCatalogSave(
      "Artist saved.",
      artistUrl(item.id),
    );
  }

  public input(input: HTMLInputElement): void {
    if (input.closest("#catalog-artist-form") && input.name === "catalogImage")
      updateCatalogImage(input);

    if (input.id === "artists-search") {
      this.browse.query = input.value;
      this.updateArtistList();
    }
    if (input.id === "artist-query") this.updateArtists();
    if (input.dataset.categorySearch)
      searchCategoryFilter(input, this.categoryControls());
  }

  public change(input: HTMLInputElement): void {
    if (input.dataset.artistRole && isArtistRole(input.value)) {
      const credit = this.selectedArtists.find(
        (item) => item.id === input.dataset.artistRole,
      );
      if (credit) credit.role = input.value;
    }
  }

  public renderList(root: HTMLElement): void {
    root.innerHTML = renderArtistsView(this.browse, this.dependencies.library);
    updateArtistsView(this.dependencies.library, this.browse, root);
  }
}
