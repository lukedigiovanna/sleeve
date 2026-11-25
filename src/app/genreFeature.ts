import { requiredNameSchema } from "./formValidation";
import type { EditorDialog, PickerInteraction } from "./editorContracts";
import { renderGenresView } from "../views/genresView";
import type { DraftTarget } from "./editorDrafts";
import type { LibraryData } from "../types/library";
import { catalogFormFooter, field } from "../components/formFields";
import { makeId } from "./id";
import {
  ancestors,
  genreDepths,
  genrePaths,
  genreUrl,
  normalizeGenres,
} from "./genres";
import type { Genre, AlbumGenre } from "../types/albums";
import { icon } from "../components/icons";
import { escapeHtml } from "../components/html";
import { matches } from "./search";
import { focusForTyping } from "./device";

export interface GenrePickerSnapshot {
  selectedGenres: AlbumGenre[];
  genreChoices: Genre[];
}

export interface GenreFeatureDependencies {
  dialog: EditorDialog;
  drafts: { begin: (target: DraftTarget) => boolean };
  persistence: {
    finishCatalogSave: (message: string, destination: string) => Promise<void>;
  };
  picker: PickerInteraction;
  library: {
    readonly albums: LibraryData["albums"];
    genres: LibraryData["genres"];
  };
  navigation: {
    main: HTMLElement;
    announce: (message: string) => void;
    renderRoute: (focus?: boolean) => void;
    updateCatalogFilters: (id: string) => void;
  };
}

function genreChoiceContext(
  genre: Genre,
  selected: AlbumGenre[],
  choices: Genre[],
): string {
  const descendant = selected.find((item) =>
    ancestors(item.id, choices).some((parent) => parent.id === genre.id),
  );
  if (descendant) return ` — Included through ${escapeHtml(descendant.name)}`;

  const parents = ancestors(genre.id, choices);
  if (!parents.length) return "";

  return ` (${parents.map((parent) => escapeHtml(parent.name)).join(", ")})`;
}

function renderGenreForm(genres: Genre[], item?: Genre): string {
  const depths = genreDepths(genres);

  return /* HTML */ `<form
    id="catalog-genre-form"
    data-id="${escapeHtml(item?.id ?? "")}"
  >
    <div class="dialog-body">
      ${field("Genre name", "genreName", item?.name ?? "", { attributes: 'required maxlength="80"' })}
      <div
        class="instrument-picker genre-parent-picker"
        role="group"
        aria-labelledby="genre-parents-label"
      >
        <label class="field" id="genre-parents-label" for="genre-parent-search"
          ><span
            >Broader genres <span class="muted">(optional)</span></span
          ></label
        >
        <p class="form-hint">Select a row to add or remove a broader genre.</p>
        <div class="catalog-search">
          <input
            type="search"
            id="genre-parent-search"
            aria-label="Search broader genres"
            placeholder="Find a broader genre…"
            aria-controls="genre-parent-options"
          />
        </div>
        <div id="genre-parent-options">
          ${genres
            .filter(
              (genre) =>
                genre.id !== item?.id &&
                !ancestors(genre.id, genres).some(
                  (parent) => parent.id === item?.id,
                ),
            )
            .sort((a, b) => {
              const aDepth = depths.get(a.id) ?? Infinity;
              const bDepth = depths.get(b.id) ?? Infinity;
              return (
                (aDepth === bDepth ? 0 : aDepth - bDepth) ||
                a.name.localeCompare(b.name)
              );
            })
            .map(
              (genre) =>
                /* HTML */ `<label class="genre-parent-option"
                  ><input
                    type="checkbox"
                    aria-label="${escapeHtml(genre.name)}"
                    name="parentGenreIds"
                    id="genre-parent-${escapeHtml(genre.id)}"
                    value="${escapeHtml(genre.id)}"
                    ${item?.parentGenreIds.includes(genre.id) ? "checked" : ""}
                  />
                  <span class="genre-parent-info"
                    ><span class="genre-parent-name"
                      >${escapeHtml(genre.name)}</span
                    >
                    <span class="genre-parent-paths"
                      >${genrePaths(genre.id, genres)
                        .filter((path) => path.length > 1)
                        .map(
                          (path) =>
                            /* HTML */ `<span class="genre-parent-path"
                              >${path.map((ancestor) => escapeHtml(ancestor.name)).join(" › ")}</span
                            >`,
                        )
                        .join(", ")}</span
                    >
                  </span></label
                >`,
            )
            .join("")}
        </div>
      </div>
      <p id="form-error" class="form-error" role="alert" hidden></p>
    </div>
    ${catalogFormFooter("Save genre")}
  </form>`;
}

function readGenreForm(
  form: HTMLFormElement,
  genres: Genre[],
  formError: EditorDialog["formError"],
): Genre | void {
  const data = new FormData(form);
  const input = form.querySelector<HTMLInputElement>('[name="genreName"]')!;
  const name = input.value.trim();
  const id = form.dataset.id || makeId();
  const parentGenreIds = [
    ...new Set(data.getAll("parentGenreIds").map(String)),
  ];

  if (
    !requiredNameSchema.safeParse(name).success ||
    genres.some(
      (g) => g.id !== id && g.name.toLowerCase() === name.toLowerCase(),
    )
  )
    return formError("Enter a unique genre name.", input);
  if (
    parentGenreIds.some(
      (parentId) =>
        !genres.some((genre) => genre.id === parentId) ||
        parentId === id ||
        ancestors(parentId, genres).some((genre) => genre.id === id),
    )
  )
    return formError("Choose a parent that does not create a cycle.", input);

  return { id, name, parentGenreIds };
}

export class GenreFeature {
  private readonly dependencies: GenreFeatureDependencies;
  private selectedGenres: AlbumGenre[] = [];
  private genreChoices: Genre[] = [];
  private genreQuery = "";
  private genreAlphabetical = false;
  private genreUnused = false;

  constructor(dependencies: GenreFeatureDependencies) {
    this.dependencies = dependencies;
  }

  public get selections(): AlbumGenre[] {
    return this.selectedGenres;
  }

  public get choices(): Genre[] {
    return this.genreChoices;
  }

  public snapshotPicker(): GenrePickerSnapshot {
    return structuredClone({
      selectedGenres: this.selectedGenres,
      genreChoices: this.genreChoices,
    });
  }

  public restorePicker(snapshot: GenrePickerSnapshot): void {
    this.selectedGenres = structuredClone(snapshot.selectedGenres);
    this.genreChoices = structuredClone(snapshot.genreChoices);
  }

  public openCatalogGenre(item?: Genre): void {
    if (!this.dependencies.drafts.begin({ kind: "genre", item })) return;

    this.dependencies.dialog.show(
      item ? "Edit genre" : "Add genre",
      renderGenreForm(this.dependencies.library.genres, item),
      '[name="genreName"]',
    );
  }

  public genrePicker(
    selected: AlbumGenre[],
    renderSuggestions: () => string = () => "",
  ): string {
    this.genreChoices = structuredClone(this.dependencies.library.genres);
    this.selectedGenres = normalizeGenres(
      selected.map((g) => ({
        ...g,
        id:
          this.dependencies.library.genres.find(
            (c) => c.name.toLowerCase() === g.name.toLowerCase(),
          )?.id ?? g.id,
      })),
      [
        ...this.genreChoices,
        ...selected.filter(
          (g) => !this.genreChoices.some((c) => c.id === g.id),
        ),
      ],
    );
    for (const g of this.selectedGenres)
      if (!this.genreChoices.some((c) => c.id === g.id))
        this.genreChoices.push({
          id: g.id,
          name: g.name,
          parentGenreIds: [...g.parentGenreIds],
        });

    return /* HTML */ `<div class="instrument-picker">
      <h3><label for="genre-query">Genres</label></h3>
      <div id="genre-selected" aria-live="polite"></div>
      ${renderSuggestions()}
      <div class="catalog-search">
        <input
          id="genre-query"
          type="search"
          maxlength="80"
          autocomplete="off"
          placeholder="Search or create a genre…"
          aria-controls="genre-results"
        />
        <div
          id="genre-results"
          class="instrument-results"
          aria-label="Available genres"
        ></div>
      </div>
    </div>`;
  }

  public updateGenres(): void {
    if (this.dependencies.picker.deferRender()) return;

    const input =
      this.dependencies.dialog.element.querySelector<HTMLInputElement>(
        "#genre-query",
      );
    if (!input) return;

    const query = input.value.trim();
    this.dependencies.dialog.element.querySelector(
      "#genre-selected",
    )!.innerHTML = this.selectedGenres
      .map(
        (g) =>
          /* HTML */ `<div class="genre-credit-row">
            <strong>${escapeHtml(g.name)}</strong
            ><button
              type="button"
              class="icon-button"
              data-action="remove-genre"
              data-id="${escapeHtml(g.id)}"
              aria-label="Remove ${escapeHtml(g.name)}"
            >
              ${icon("close", 16)}
            </button>
          </div>`,
      )
      .join("");

    const choices = this.genreChoices
      .filter(
        (g) =>
          !this.selectedGenres.some((c) => c.id === g.id) &&
          matches(
            query,
            g.name,
            ...ancestors(g.id, this.genreChoices).map((p) => p.name),
          ),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    this.dependencies.dialog.element.querySelector(
      "#genre-results",
    )!.innerHTML =
      choices
        .slice(0, 20)
        .map((g) => {
          return /* HTML */ `<button
            type="button"
            class="button secondary compact"
            data-action="select-genre"
            data-id="${escapeHtml(g.id)}"
          >
            ${escapeHtml(g.name)}${genreChoiceContext(g, this.selectedGenres, this.genreChoices)}
          </button>`;
        })
        .join("") +
      (!choices.length && !query
        ? /* HTML */ `<p class="form-hint">Type a name to create one.</p>`
        : "") +
      (choices.length > 20
        ? /* HTML */ `<p class="form-hint">Type to narrow the results.</p>`
        : "") +
      (query &&
      !this.genreChoices.some(
        (g) => g.name.toLowerCase() === query.toLowerCase(),
      )
        ? /* HTML */ `<button
            type="button"
            class="button secondary compact"
            data-action="create-genre"
          >
            ${icon("plus", 14)} Create “${escapeHtml(query)}”
          </button>`
        : "");
  }

  public click(button: HTMLButtonElement): boolean {
    switch (button.dataset.action) {
      case "new-catalog-genre":
        this.openCatalogGenre();
        break;
      case "edit-catalog-genre":
        this.openCatalogGenre(
          this.dependencies.library.genres.find(
            (g) => genreUrl(g.id) === location.hash,
          ),
        );
        break;
      case "delete-catalog-genre": {
        const item = this.dependencies.library.genres.find(
          (g) => genreUrl(g.id) === location.hash,
        );
        if (
          !item ||
          this.dependencies.library.genres.some((g) =>
            g.parentGenreIds.includes(item.id),
          ) ||
          this.dependencies.library.albums.some((a) =>
            a.genres.some((g) => g.id === item.id),
          )
        )
          break;

        this.dependencies.dialog.show(
          "Delete genre?",
          /* HTML */ `<div class="dialog-body">
              Delete ${escapeHtml(item.name)}?
            </div>
            <div class="dialog-footer">
              <button class="button secondary" data-action="close">
                Cancel</button
              ><button
                class="button primary danger"
                data-action="confirm-delete-genre"
                data-id="${escapeHtml(item.id)}"
              >
                Delete genre
              </button>
            </div>`,
          '[data-action="close"]',
        );
        break;
      }
      case "confirm-delete-genre":
        if (
          !this.dependencies.library.genres.some((g) =>
            g.parentGenreIds.includes(button.dataset.id ?? ""),
          ) &&
          !this.dependencies.library.albums.some((a) =>
            a.genres.some((g) => g.id === button.dataset.id),
          )
        ) {
          this.dependencies.library.genres =
            this.dependencies.library.genres.filter(
              (g) => g.id !== button.dataset.id,
            );
          this.dependencies.persistence.finishCatalogSave(
            "Genre deleted.",
            "#genres",
          );
        }
        break;
      case "select-genre":
      case "create-genre": {
        const input =
          this.dependencies.dialog.element.querySelector<HTMLInputElement>(
            "#genre-query",
          )!;
        let item = this.genreChoices.find((g) => g.id === button.dataset.id);
        if (button.dataset.action === "create-genre") {
          const name = input.value.trim();
          if (!name) break;
          item = this.genreChoices.find(
            (g) => g.name.toLowerCase() === name.toLowerCase(),
          );
          if (!item) {
            item = { id: makeId(), name, parentGenreIds: [] };
            this.genreChoices.push(item);
          }
        }
        if (!item || this.selectedGenres.some((g) => g.id === item.id)) break;

        this.selectedGenres = normalizeGenres(
          [...this.selectedGenres, { ...item, isPrimary: false }],
          this.genreChoices,
        );
        input.value = "";
        this.updateGenres();
        focusForTyping(input);
        this.dependencies.picker.closeSearch();
        break;
      }
      case "remove-genre":
        this.selectedGenres = this.selectedGenres.filter(
          (g) => g.id !== button.dataset.id,
        );
        this.updateGenres();
        break;
      default:
        return false;
    }

    return true;
  }

  public submit(form: HTMLFormElement): void {
    const item = readGenreForm(
      form,
      this.dependencies.library.genres,
      this.dependencies.dialog.formError,
    );
    if (!item) return;

    this.dependencies.library.genres = this.dependencies.library.genres
      .filter((genre) => genre.id !== item.id)
      .concat(item);
    this.dependencies.persistence.finishCatalogSave(
      "Genre saved.",
      genreUrl(item.id),
    );
  }

  public input(input: HTMLInputElement): void {
    if (input.id === "genre-parent-search") {
      const query = input.value.trim().toLocaleLowerCase();
      this.dependencies.dialog.element
        .querySelectorAll<HTMLElement>(".genre-parent-option")
        .forEach((option) => {
          option.hidden = !option.textContent
            ?.toLocaleLowerCase()
            .includes(query);
        });
    }
    if (input.id === "genre-query") this.updateGenres();

    if (input.id === "genres-search") {
      this.genreQuery = input.value;
      const start = input.selectionStart;
      this.dependencies.navigation.renderRoute();
      const next =
        this.dependencies.navigation.main.querySelector<HTMLInputElement>(
          "#genres-search",
        )!;
      next.focus();
      next.setSelectionRange(start, start);
    }
  }

  public change(input: HTMLInputElement): void {
    if (input.id === "genres-alphabetical") {
      this.genreAlphabetical = input.checked;
      this.dependencies.navigation.updateCatalogFilters(input.id);
    }

    if (input.id === "genres-unused") {
      this.genreUnused = input.checked;
      this.dependencies.navigation.updateCatalogFilters(input.id);
    }
  }

  public renderList(root: HTMLElement): void {
    root.innerHTML = renderGenresView(
      this.dependencies.library.genres,
      this.dependencies.library.albums,
      this.genreQuery,
      this.genreAlphabetical,
      this.genreUnused,
    );
  }
}
