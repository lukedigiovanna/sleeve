import { restoreListeningNoteEditor } from "../components/listeningNoteEditor";
import { syncCountryPicker } from "../components/countryPicker";
import { linkRow, updateCatalogImage } from "../components/formFields";
import { icon } from "../components/icons";
import type {
  Album,
  Instrument,
  AlbumArtist,
  AlbumGenre,
  AlbumInstrument,
  Artist,
  Genre,
  ListeningEntry,
} from "../types/albums";
import type { AlbumEditorMode } from "./editorContracts";
import { draftSchema } from "./draftValidation";
import { createLifecycle } from "./lifecycle";

export interface EditorDraftsDependencies {
  setBaseline: (value: string) => void;
  updateRating: (value: number | null) => void;
  editor: HTMLDialogElement;
  accountId: string;
  isSaving: () => boolean;
  hasChanges: () => boolean;
  baseline: () => string;
  serializeSelections: () => Pick<
    Draft,
    | "artists"
    | "genres"
    | "instruments"
    | "artistChoices"
    | "genreChoices"
    | "instrumentChoices"
  >;
  resumeDraft: () => void;
  announce: (message: string) => void;
}

export type DraftTarget =
  | { kind: "album"; item?: Partial<Album>; mode?: AlbumEditorMode }
  | { kind: "artist"; item?: Artist }
  | { kind: "genre"; item?: Genre }
  | { kind: "instrument"; item?: Instrument }
  | { kind: "instruments"; item: Album }
  | { kind: "listen"; item: Album; entry?: ListeningEntry };
export type Draft = {
  version: 1;
  target: DraftTarget;
  hash: string;
  open: boolean;
  baseline: string;
  source: string;
  fields: { name: string; id: string; value: string; checked: boolean }[];
  links: number;
  artists: AlbumArtist[];
  genres: AlbumGenre[];
  instruments: AlbumInstrument[];
  artistChoices: Artist[];
  genreChoices: Genre[];
  instrumentChoices: AlbumInstrument[];
};

export interface EditorDrafts {
  readonly state: {
    target: DraftTarget | undefined;
    restoring: boolean;
    source: string;
  };
  readonly current: Draft | undefined;
  readonly resumeButton: HTMLButtonElement;
  restore: (saved: Draft, openEditor: () => void) => void;
  writeDraft: () => boolean;
  clearDraft: () => void;
  captureDraft: () => void;
  beginDraft: (target: DraftTarget) => boolean;
  draftCloseChoices: () => void;
  dispose: () => void;
}

export class EditorDraftController implements EditorDrafts {
  private readonly lifecycle = createLifecycle();
  private readonly draftKey: string;
  private draft: Draft | undefined;
  private readonly closePrompt = document.createElement("dialog");
  readonly state: EditorDrafts["state"] = {
    target: undefined,
    restoring: false,
    source: "",
  };
  readonly resumeButton = document.createElement("button");

  private readonly ops: EditorDraftsDependencies;

  constructor(ops: EditorDraftsDependencies) {
    this.ops = ops;
    this.draftKey = `sleeve:editor-draft:v1:${ops.accountId}`;
    this.resumeButton.className = "button secondary draft-resume";
    this.resumeButton.textContent = "Resume draft";
    this.resumeButton.hidden = true;
    document.querySelector(".masthead-inner")!.append(this.resumeButton);
    this.renderClosePrompt();
    this.loadDraft();
    this.listen();
  }

  get current(): Draft | undefined {
    return this.draft;
  }

  writeDraft(): boolean {
    try {
      if (this.draft)
        localStorage.setItem(this.draftKey, JSON.stringify(this.draft));
      else localStorage.removeItem(this.draftKey);
      return true;
    } catch {
      return false;
    }
  }

  clearDraft(): void {
    this.draft = undefined;
    this.state.target = undefined;
    this.writeDraft();
    this.resumeButton.hidden = true;
  }

  captureDraft(): void {
    this.storeEditorDraft(true);
  }

  private renderDraftStatus(stored: boolean): void {
    const editor = this.ops.editor;
    let indicator = editor.querySelector<HTMLElement>(".draft-indicator");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.className = "draft-indicator";
      indicator.innerHTML = /* HTML */ `<button
          type="button"
          class="icon-button draft-indicator-button"
          aria-label="Draft status"
          aria-describedby="editor-draft-message"
          aria-controls="editor-draft-message"
          aria-expanded="false"
        >
          ${icon("draft", 17)}
          <span aria-hidden="true">!</span>
        </button>
        <span
          id="editor-draft-message"
          data-draft-status
          role="status"
        ></span>`;
      const button = indicator.querySelector("button")!;
      button.addEventListener("click", () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!expanded));
      });
      button.addEventListener("blur", () => {
        button.setAttribute("aria-expanded", "false");
      });

      const placement =
        editor.querySelector(".listen-intro") ??
        editor.querySelector(".dialog-heading-actions")!;
      placement.append(indicator);
    }

    indicator.toggleAttribute("data-save-failed", !stored);
    const status = indicator.querySelector("[data-draft-status]")!;
    const message = stored
      ? "Draft saved on this device"
      : "Draft could not be saved on this device";
    if (status.textContent !== message) status.textContent = message;
  }

  private storeEditorDraft(open: boolean): boolean {
    const target = this.state.target;
    if (
      this.state.restoring ||
      this.ops.isSaving() ||
      !this.ops.editor.open ||
      !target
    )
      return false;
    const form = this.ops.editor.querySelector("form");
    if (!form) return false;
    const isImportReview = target.kind === "album" && target.mode === "review";
    if (open && !this.draft && !isImportReview && !this.ops.hasChanges())
      return false;

    const previous = this.draft;
    this.draft = {
      version: 1,
      target,
      hash: location.hash,
      open,
      baseline: this.ops.baseline(),
      source: this.state.source,
      fields: [
        ...form.querySelectorAll<HTMLInputElement>(
          "input:not([data-suggestion-search]), select, textarea",
        ),
      ].map((input) => ({
        name: input.name,
        id: input.id,
        value: input.value,
        checked: input.checked ?? false,
      })),
      links: form.querySelectorAll(".link-fields").length,
      ...this.ops.serializeSelections(),
    };
    const stored = this.writeDraft();
    if (!open && !stored) this.draft = previous;

    this.renderDraftStatus(stored);
    this.resumeButton.hidden = true;
    return stored;
  }

  beginDraft(target: DraftTarget): boolean {
    if (!this.state.restoring && this.draft && !this.ops.editor.open) {
      this.ops.resumeDraft();
      return false;
    }
    this.state.target = target;
    this.state.source = JSON.stringify(target.item ?? null);
    return true;
  }

  draftCloseChoices(): void {
    if (this.closePrompt.open) return;

    this.closePrompt.querySelector("[role=alert]")!.textContent = "";
    this.closePrompt.showModal();
  }

  private renderClosePrompt(): void {
    this.closePrompt.className = "draft-close-dialog";
    this.closePrompt.setAttribute("aria-labelledby", "draft-close-title");
    this.closePrompt.setAttribute(
      "aria-describedby",
      "draft-close-description",
    );
    this.closePrompt.innerHTML = /* HTML */ `
      <div class="draft-close-heading">
        <h2 id="draft-close-title">Unsaved changes</h2>
        <button
          type="button"
          class="icon-button"
          aria-label="Continue editing"
          data-draft-continue
          autofocus
        >
          ${icon("close", 22)}
        </button>
      </div>
      <p id="draft-close-description">Keep a draft on this device?</p>
      <p class="draft-close-error" role="alert"></p>
      <div class="draft-actions">
        <button type="button" class="button secondary" data-draft-discard>
          Discard changes
        </button>
        <button type="button" class="button primary" data-draft-keep>
          Keep draft
        </button>
      </div>
    `;
    this.ops.editor.after(this.closePrompt);

    this.lifecycle
      .listen(this.closePrompt.querySelector("[data-draft-continue]")!)
      .addEventListener("click", () => this.closePrompt.close());
    this.lifecycle
      .listen(this.closePrompt.querySelector("[data-draft-discard]")!)
      .addEventListener("click", () => {
        this.clearDraft();
        this.closePrompt.close();
        this.ops.editor.close();
      });
    this.lifecycle
      .listen(this.closePrompt.querySelector("[data-draft-keep]")!)
      .addEventListener("click", () => this.keepDraftAndClose());
    this.lifecycle.listen(this.ops.editor).addEventListener("close", () => {
      if (!this.ops.editor.open) this.closePrompt.close();
    });
  }

  private keepDraftAndClose(): void {
    if (!this.storeEditorDraft(false)) {
      this.closePrompt.querySelector("[role=alert]")!.textContent =
        "Couldn’t save the draft on this device.";
      return;
    }

    this.state.target = undefined;
    this.resumeButton.hidden = false;
    this.closePrompt.close();
    this.ops.editor.close();
    this.ops.announce("Draft kept on this device.");
  }

  restore(saved: Draft, openEditor: () => void): void {
    this.state.restoring = true;
    openEditor();
    const rows = this.ops.editor.querySelector("#link-rows");
    if (rows)
      rows.innerHTML = Array.from({ length: saved.links }, () =>
        linkRow(),
      ).join("");
    const controls = [
      ...this.ops.editor.querySelectorAll<HTMLInputElement>(
        "input, select, textarea",
      ),
    ];
    const used = new Set<HTMLInputElement>();
    for (const field of saved.fields) {
      const input = controls.find(
        (control) =>
          !used.has(control) &&
          control.name === field.name &&
          control.id === field.id,
      );
      if (input) {
        input.value = field.value;
        if (input.type === "checkbox" || input.type === "radio")
          input.checked = field.checked;
        used.add(input);
      }
    }
    syncCountryPicker(this.ops.editor);
    restoreListeningNoteEditor(this.ops.editor);
    const imageInput = this.ops.editor.querySelector<HTMLInputElement>(
      ".catalog-image-editor input",
    );
    if (imageInput) updateCatalogImage(imageInput);

    for (const row of this.ops.editor.querySelectorAll<HTMLElement>(
      "[data-suggestion-row]",
    ))
      row.hidden =
        row.querySelector<HTMLInputElement>('input[type="hidden"]')?.value ===
        "__done";
    const rating = this.ops.editor.querySelector<HTMLInputElement>(
      '[name="rating"]:checked',
    );
    if (this.ops.editor.querySelector("#listen-form"))
      this.ops.updateRating(rating?.value ? Number(rating.value) : null);
    this.lifecycle.queue(() => {
      this.ops.setBaseline(saved.baseline);
      this.state.source = saved.source;
      this.state.restoring = false;
      this.captureDraft();
      if (!this.ops.editor.open) return;

      this.ops.announce("Restored from draft.");
      this.ops.editor
        .querySelector<HTMLElement>("#dialog-title")
        ?.focus({ preventScroll: true });
    });
  }

  private loadDraft(): void {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(this.draftKey) ?? "null",
      );
      const result = draftSchema.safeParse(stored);
      if (result.success) {
        this.draft = result.data;
        const parentField = this.draft.fields.find(
          (field) => field.name === "parentGenreId",
        );
        if (parentField?.value)
          this.draft.fields.push({
            name: "parentGenreIds",
            id: `genre-parent-${parentField.value}`,
            value: parentField.value,
            checked: true,
          });
      }
    } catch {
      /* An unavailable or damaged draft must not prevent opening the library. */
    }
  }

  private listen(): void {
    this.lifecycle
      .listen(this.resumeButton)
      .addEventListener("click", this.ops.resumeDraft);
    for (const event of ["input", "change", "click"])
      this.lifecycle
        .listen(this.ops.editor)
        .addEventListener(event, () =>
          this.lifecycle.queue(() => this.captureDraft()),
        );
    this.lifecycle
      .listen(window)
      .addEventListener("pagehide", () => this.captureDraft());
    this.lifecycle.listen(document).addEventListener("visibilitychange", () => {
      if (document.hidden) this.captureDraft();
    });
  }

  dispose(): void {
    this.lifecycle.dispose();
    this.closePrompt.remove();
    this.resumeButton.remove();
  }
}
