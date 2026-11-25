import { isInstrumentCategory } from "./instruments";
import { instrumentSorting, selectBrowseSort } from "../components/sortOptions";
import {
  searchCategoryFilter,
  selectCategoryFilter,
  type CategoryFilterControls,
} from "../components/libraryCategoryFilters";
import { updateBrowseFilters } from "../components/libraryFilters";
import type { EditorDialog } from "./editorContracts";
import { updateCatalogImage } from "../components/formFields";
import type { DraftTarget } from "./editorDrafts";

import type { LibraryData } from "../types/library";
import {
  catalogFormFooter,
  field,
  catalogImageField,
} from "../components/formFields";
import { makeId } from "./id";
import type { Album, AlbumInstrument, Instrument } from "../types/albums";
import { icon } from "../components/icons";
import { escapeHtml } from "../components/html";
import { requiredNameSchema, optionalHttpUrlSchema } from "./formValidation";
import { albumsUsing, instrumentUrl } from "./instruments";
import {
  categoryFields,
  defaultInstrumentSort,
  instrumentFilterFields,
  renderInstrumentsView,
  type InstrumentBrowseState,
  updateInstrumentsView,
} from "../views/instrumentsView";
import { focusForTyping } from "./device";

export interface InstrumentPickerSnapshot {
  selectedInstruments: AlbumInstrument[];
  instrumentChoices: AlbumInstrument[];
}

export interface InstrumentFeatureDependencies {
  dialog: EditorDialog;
  drafts: { begin: (target: DraftTarget) => boolean };
  persistence: {
    finishSave: (id: string, message: string) => Promise<void>;
    finishCatalogSave: (message: string, destination: string) => Promise<void>;
  };
  readonly library: LibraryData;
  navigation: {
    renderRoute: (focus?: boolean) => void;
    updateCatalogFilters: (id: string) => void;
  };
}

function renderInstrumentForm(item?: Instrument): string {
  return /* HTML */ `<form
    id="catalog-instrument-form"
    data-id="${escapeHtml(item?.id ?? "")}"
  >
    <div class="dialog-body">
      ${field("Instrument name", "instrumentName", item?.name ?? "", { attributes: 'required maxlength="80"', placeholder: "e.g. Vibraphone" })}
      ${catalogImageField("Image URL", item?.name ?? "Instrument", item?.imageUrl, false, item?.categories)}
      ${categoryFields(item?.categories)}
      <p class="form-hint">
        Name and category changes apply everywhere this instrument is used.
      </p>
      <p id="form-error" class="form-error" role="alert" hidden></p>
    </div>
    ${catalogFormFooter(item ? "Save changes" : "Add instrument")}
  </form>`;
}

function readInstrumentForm(
  form: HTMLFormElement,
  instruments: Instrument[],
  formError: EditorDialog["formError"],
): Instrument | void {
  const input = form.querySelector<HTMLInputElement>(
    '[name="instrumentName"]',
  )!;
  const name = input.value.trim();

  if (!requiredNameSchema.safeParse(name).success)
    return formError("Enter an instrument name.", input);
  if (
    instruments.some(
      (item) =>
        item.id !== form.dataset.id &&
        item.name.toLowerCase() === name.toLowerCase(),
    )
  )
    return formError("An instrument with this name already exists.", input);

  const data = new FormData(form);
  const imageUrl = String(data.get("catalogImage") ?? "").trim();
  if (!optionalHttpUrlSchema.safeParse(imageUrl).success)
    return formError(
      "Enter an HTTP or HTTPS image URL.",
      form.querySelector('[name="catalogImage"]')!,
    );

  return {
    imageUrl: imageUrl || null,
    id: form.dataset.id || makeId(),
    name,
    categories: data.getAll("category").filter(isInstrumentCategory),
  };
}

export class InstrumentFeature {
  private readonly dependencies: InstrumentFeatureDependencies;
  private selectedInstruments: AlbumInstrument[] = [];
  private instrumentChoices: AlbumInstrument[] = [];
  private readonly browse: InstrumentBrowseState = {
    query: "",
    filters: {},
    sort: defaultInstrumentSort,
  };

  constructor(dependencies: InstrumentFeatureDependencies) {
    this.dependencies = dependencies;
  }

  public get selections(): AlbumInstrument[] {
    return this.selectedInstruments;
  }

  public get choices(): AlbumInstrument[] {
    return this.instrumentChoices;
  }

  public snapshotPicker(): InstrumentPickerSnapshot {
    return structuredClone({
      selectedInstruments: this.selectedInstruments,
      instrumentChoices: this.instrumentChoices,
    });
  }

  public restorePicker(snapshot: InstrumentPickerSnapshot): void {
    this.selectedInstruments = structuredClone(snapshot.selectedInstruments);
    this.instrumentChoices = structuredClone(snapshot.instrumentChoices);
  }

  public openCatalogInstrument(item?: Instrument): void {
    if (!this.dependencies.drafts.begin({ kind: "instrument", item })) return;

    this.dependencies.dialog.show(
      item ? "Edit instrument" : "Add instrument",
      renderInstrumentForm(item),
      '[name="instrumentName"]',
    );
  }

  public instrumentPicker(
    items: AlbumInstrument[],
    renderSuggestions: () => string = () => "",
  ): string {
    this.selectedInstruments = structuredClone(items);
    this.instrumentChoices = this.dependencies.library.instruments.map(
      (item) => ({
        ...structuredClone(item),
        notes: null,
      }),
    );

    return /* HTML */ `<div class="instrument-picker">
      <label class="field" for="instrument-query"
        ><span
          >Featured instruments <span class="muted">(optional)</span></span
        ></label
      >
      <div id="instrument-selected" class="tags" aria-live="polite"></div>
      ${renderSuggestions()}
      <input
        id="instrument-query"
        type="search"
        maxlength="80"
        autocomplete="off"
        placeholder="Search or create an instrument…"
      />
      <div
        id="instrument-results"
        class="instrument-results"
        aria-label="Available instruments"
      ></div>
      <div id="instrument-create" class="inline-instrument-create" hidden>
        ${categoryFields([], "inline-category")}
        <button
          type="button"
          class="button secondary compact"
          data-action="create-instrument"
        ></button>
      </div>
    </div>`;
  }

  public updateInstruments(): void {
    const input =
      this.dependencies.dialog.element.querySelector<HTMLInputElement>(
        "#instrument-query",
      );
    if (!input) return;

    const query = input.value.trim();
    this.dependencies.dialog.element.querySelector(
      "#instrument-selected",
    )!.innerHTML = this.selectedInstruments
      .map(
        (item) =>
          /* HTML */ `<button
            type="button"
            class="instrument-chip"
            data-action="remove-instrument"
            data-id="${escapeHtml(item.id)}"
            aria-label="Remove ${escapeHtml(item.name)}"
          >
            ${escapeHtml(item.name)} ${icon("close", 14)}
          </button>`,
      )
      .join("");
    const create =
      this.dependencies.dialog.element.querySelector<HTMLElement>(
        "#instrument-create",
      )!;
    create.hidden =
      !query ||
      this.instrumentChoices.some(
        (item) => item.name.toLowerCase() === query.toLowerCase(),
      );
    create.querySelector("button")!.textContent = `Create “${query}”`;
    const usage = new Map<string, number>();
    for (const album of this.dependencies.library.albums)
      for (const id of new Set(album.instruments.map((item) => item.id)))
        usage.set(id, (usage.get(id) ?? 0) + 1);

    const choices = this.instrumentChoices
      .filter(
        (item) =>
          !this.selectedInstruments.some(
            (selected) => selected.id === item.id,
          ) && item.name.toLowerCase().includes(query.toLowerCase()),
      )
      .sort(
        (a, b) =>
          (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) ||
          a.name.localeCompare(b.name),
      );
    this.dependencies.dialog.element.querySelector(
      "#instrument-results",
    )!.innerHTML =
      choices
        .map(
          (item) =>
            /* HTML */ `<button
              type="button"
              class="button secondary compact"
              data-action="select-instrument"
              data-id="${escapeHtml(item.id)}"
            >
              ${icon("plus", 14)} ${escapeHtml(item.name)}
            </button>`,
        )
        .join("") +
      (!choices.length && !query
        ? /* HTML */ `<p class="form-hint">
            Search for an instrument name to add one.
          </p>`
        : "");
  }

  public openInstruments(album: Album): void {
    if (!this.dependencies.drafts.begin({ kind: "instruments", item: album }))
      return;

    this.dependencies.dialog.show(
      "Edit featured instruments",
      /* HTML */ `<form id="instruments-form" data-id="${escapeHtml(album.id)}">
        <div class="dialog-body">
          <p class="dialog-intro">${escapeHtml(album.title)}</p>
          ${this.instrumentPicker(album.instruments)}
        </div>
        <div class="dialog-footer">
          <button type="button" class="button secondary" data-action="close">
            Cancel</button
          ><button type="submit" class="button primary">
            Save featured instruments
          </button>
        </div>
      </form>`,
      "#instrument-query",
    );

    this.updateInstruments();
  }

  private categoryControls(): CategoryFilterControls {
    return {
      scope: "instrument",
      fields: instrumentFilterFields,
      filters: this.browse.filters,
      data: this.dependencies.library,
    };
  }

  private updateInstrumentList(): void {
    updateInstrumentsView(this.dependencies.library, this.browse);
  }

  private updateInstrumentFilters(): void {
    const root = document.querySelector<HTMLElement>(".instruments-page")!;
    updateBrowseFilters(
      root,
      this.browse.filters,
      this.dependencies.library,
      "instrument",
    );
    this.updateInstrumentList();
  }

  private clearInstrumentFilters(button: HTMLButtonElement): void {
    this.browse.filters = {};

    if (button.closest(".genre-filter-dropdown")) {
      this.dependencies.navigation.updateCatalogFilters(
        "instrument-instrumentCategory-search",
      );
      return;
    }

    this.browse.query = "";
    this.dependencies.navigation.renderRoute();
    focusForTyping(
      document.querySelector<HTMLInputElement>("#instruments-search"),
    );
  }

  public commitInstrumentChoices(): void {
    this.dependencies.library.instruments = this.instrumentChoices.map(
      ({ id, name, categories, imageUrl }) => ({
        imageUrl,
        id,
        name,
        categories,
      }),
    );
  }

  private saveCatalogInstrument(form: HTMLFormElement): void {
    const item = readInstrumentForm(
      form,
      this.dependencies.library.instruments,
      this.dependencies.dialog.formError,
    );
    if (!item) return;

    this.dependencies.library.instruments =
      this.dependencies.library.instruments
        .filter((existing) => existing.id !== item.id)
        .concat(item);
    this.dependencies.persistence.finishCatalogSave(
      "Instrument saved.",
      instrumentUrl(item.id),
    );
  }

  public click(button: HTMLButtonElement, album?: Album): boolean {
    switch (button.dataset.action) {
      case "new-catalog-instrument":
        this.openCatalogInstrument();
        break;
      case "edit-catalog-instrument": {
        const item = this.dependencies.library.instruments.find(
          (item) => instrumentUrl(item.id) === location.hash,
        );
        if (item) this.openCatalogInstrument(item);
        break;
      }
      case "delete-catalog-instrument": {
        const item = this.dependencies.library.instruments.find(
          (item) => instrumentUrl(item.id) === location.hash,
        );
        if (
          !item ||
          albumsUsing(this.dependencies.library.albums, item.id).length
        )
          break;

        this.dependencies.dialog.show(
          "Delete instrument?",
          /* HTML */ `<div class="dialog-body">
              <p>
                Delete <strong>${escapeHtml(item.name)}</strong> from your
                catalog? It is not used on any albums.
              </p>
            </div>
            <div class="dialog-footer">
              <button
                type="button"
                class="button secondary"
                data-action="close"
              >
                Cancel</button
              ><button
                type="button"
                class="button primary danger"
                data-action="confirm-delete-instrument"
                data-id="${escapeHtml(item.id)}"
              >
                Delete instrument
              </button>
            </div>`,
          '[data-action="close"]',
        );
        break;
      }
      case "confirm-delete-instrument": {
        const item = this.dependencies.library.instruments.find(
          (item) => item.id === button.dataset.id,
        );
        if (
          !item ||
          albumsUsing(this.dependencies.library.albums, item.id).length
        )
          break;
        this.dependencies.library.instruments =
          this.dependencies.library.instruments.filter(
            (existing) => existing.id !== item.id,
          );
        this.dependencies.persistence.finishCatalogSave(
          "Instrument deleted.",
          "#instruments",
        );
        break;
      }
      case "instrument-sort": {
        const sort = selectBrowseSort(
          button,
          instrumentSorting,
          this.browse.sort,
        );
        if (sort === undefined) return false;
        this.browse.sort = sort;
        this.updateInstrumentList();
        break;
      }
      case "add-instrument-category":
      case "remove-instrument-category":
        if (!selectCategoryFilter(button, this.categoryControls()))
          return false;
        this.updateInstrumentFilters();
        break;
      case "remove-instrument-filter":
        if (button.dataset.filter !== "instrumentCategory") return false;
        delete this.browse.filters.instrumentCategory;
        this.dependencies.navigation.renderRoute();
        document
          .querySelector<HTMLElement>(
            ".instruments-page .genre-filter-dropdown summary",
          )
          ?.focus();
        break;
      case "clear-instrument-filters":
        this.clearInstrumentFilters(button);
        break;
      case "edit-instruments":
        if (album) this.openInstruments(album);
        break;
      case "select-instrument": {
        const item = this.instrumentChoices.find(
          (item) => item.id === button.dataset.id,
        );
        if (
          item &&
          !this.selectedInstruments.some((selected) => selected.id === item.id)
        )
          this.selectedInstruments.push({ ...item, notes: null });
        this.dependencies.dialog.element.querySelector<HTMLInputElement>(
          "#instrument-query",
        )!.value = "";
        this.updateInstruments();
        focusForTyping(
          this.dependencies.dialog.element.querySelector<HTMLElement>(
            "#instrument-query",
          ),
        );
        break;
      }
      case "create-instrument": {
        const input =
          this.dependencies.dialog.element.querySelector<HTMLInputElement>(
            "#instrument-query",
          )!;
        const name = input.value.trim();
        if (!name) break;

        const categories = [
          ...this.dependencies.dialog.element.querySelectorAll<HTMLInputElement>(
            '[name="inline-category"]:checked',
          ),
        ]
          .map((input) => input.value)
          .filter(isInstrumentCategory);
        const item = { id: makeId(), name, notes: null, categories };
        for (const input of this.dependencies.dialog.element.querySelectorAll<HTMLInputElement>(
          '[name="inline-category"]',
        ))
          input.checked = false;
        this.instrumentChoices.push(item);
        this.selectedInstruments.push(item);
        input.value = "";
        this.updateInstruments();
        focusForTyping(input);
        break;
      }
      case "remove-instrument":
        this.selectedInstruments = this.selectedInstruments.filter(
          (item) => item.id !== button.dataset.id,
        );
        this.updateInstruments();
        focusForTyping(
          this.dependencies.dialog.element.querySelector<HTMLElement>(
            "#instrument-query",
          ),
        );
        break;
      default:
        return false;
    }

    return true;
  }

  private saveInstruments(form: HTMLFormElement): void {
    const album = this.dependencies.library.albums.find(
      (item) => item.id === form.dataset.id,
    );

    if (album) {
      this.commitInstrumentChoices();
      album.instruments = structuredClone(this.selectedInstruments);
      album.updatedAt = new Date().toISOString();
      this.dependencies.persistence.finishSave(
        album.id,
        "Featured instruments updated.",
      );
    }
  }

  public submit(form: HTMLFormElement): void {
    if (form.id === "instruments-form") this.saveInstruments(form);
    else this.saveCatalogInstrument(form);
  }

  public input(input: HTMLInputElement): void {
    if (
      input.closest("#catalog-instrument-form") &&
      (input.name === "catalogImage" || input.name === "category")
    )
      updateCatalogImage(input);

    if (input.id === "instruments-search") {
      this.browse.query = input.value;
      this.updateInstrumentList();
    }

    if (input.id === "instrument-instrumentCategory-search")
      searchCategoryFilter(input, this.categoryControls());

    if (input.id === "instrument-query") this.updateInstruments();
  }

  public renderList(root: HTMLElement): void {
    root.innerHTML = renderInstrumentsView(
      this.browse,
      this.dependencies.library,
    );
    updateInstrumentsView(this.dependencies.library, this.browse, root);
  }
}
