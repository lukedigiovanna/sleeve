import { listeningSubmissionSchema } from "./formValidation";
import { today } from "./date";
import type { EditorDialog } from "./editorContracts";
import type { EditorDrafts } from "./editorDrafts";
import { field } from "../components/formFields";
import { makeId } from "./id";
import type { Album, ListeningEntry } from "../types/albums";
import { ratingLabels } from "../data/mockData";
import { escapeHtml } from "../components/html";
import { artistText } from "../components/presentation";
import type { LibraryData } from "../types/library";
import { ListeningNoteEditor } from "../components/listeningNoteEditor";
import {
  listeningNoteTargets,
  suggestedNoteLinks,
} from "../components/listeningNoteLinks";
import { stars } from "../components/rating";

export interface ListeningDependencies {
  editor: HTMLDialogElement;
  showDialog: EditorDialog["show"];
  beginDraft: EditorDrafts["beginDraft"];
  library: () => LibraryData;
  finishSave: (id: string, message: string) => Promise<void>;
}

export interface Listening {
  openListen: (album: Album, entry?: ListeningEntry) => void;
  updateRating: (rating: number | null) => void;
  saveListenForm: (form: HTMLFormElement) => void;
  today: () => string;
  click: (button: HTMLButtonElement, album?: Album) => boolean;
}

export function createListening(ops: ListeningDependencies): Listening {
  function openListen(album: Album, entry?: ListeningEntry): void {
    if (!ops.beginDraft({ kind: "listen", item: album, entry })) return;
    ops.showDialog(
      entry ? "Edit listen" : "Log a listen",
      /* HTML */ `<form
        id="listen-form"
        data-id="${escapeHtml(album.id)}"
        data-entry-id="${escapeHtml(entry?.id ?? "")}"
      >
        <div class="dialog-body">
          <div class="listen-intro">
            <p class="dialog-intro">
              ${escapeHtml(album.title)}
              <span class="separator">·</span> ${escapeHtml(artistText(album))}
            </p>
          </div>
          ${field("Date listened", "date", entry?.listenedAt.slice(0, 10) ?? today(), { type: "date", attributes: 'required min="1900-01-01" max="' + today() + '"' })}
          <fieldset class="rate-field">
            <legend>Rating (optional)</legend>
            <div class="rating-picker">
              <span id="rating-stars">${stars(entry?.rating ?? 0)}</span>
              <div class="rating-options">
                ${ratingLabels.map((label, i) => /* HTML */ `<label><input name="rating" type="radio" value="${i + 1}" ${entry?.rating === i + 1 ? "checked" : ""} aria-label="${(i + 1) / 2} out of 5 stars: ${escapeHtml(label)}" /></label>`).join("")}
              </div>
            </div>
          </fieldset>
          <div class="field">
            <span id="listen-notes-label">Listening notes</span>
            <div
              id="listening-notes"
              class="listen-note-editor"
              contenteditable="true"
              role="combobox"
              aria-labelledby="listen-notes-label"
              aria-describedby="listen-note-error"
              aria-autocomplete="list"
              aria-controls="listen-note-options"
              aria-expanded="false"
              data-placeholder="What stood out on this listen?"
            ></div>
            <textarea name="notes" hidden>
${escapeHtml(entry?.notes ?? "")}</textarea>
            <small id="listen-note-error" role="alert"></small>
            <div class="listen-note-picker" popover="manual">
              <div
                id="listen-note-options"
                role="listbox"
                aria-label="Smart links"
              ></div>
              <p class="listen-note-empty" role="status" hidden></p>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button type="button" class="button secondary" data-action="close">
            Cancel</button
          ><button type="submit" class="button primary">
            ${entry ? "Save changes" : "Save listen"}
          </button>
        </div>
        ${
          entry
            ? /* HTML */ `<div class="listen-delete">
                <details>
                  <summary>Delete listening entry</summary>
                  <p>
                    This will permanently remove this listen, including its
                    rating and notes.
                  </p>
                  <button
                    type="button"
                    class="button secondary danger"
                    data-action="delete-listen"
                  >
                    Delete entry permanently
                  </button>
                </details>
              </div>`
            : ""
        }
      </form>`,
      entry ? "#listening-notes" : '[name="date"]',
    );
    new ListeningNoteEditor({
      form: ops.editor.querySelector("#listen-form")!,
      targets: () => listeningNoteTargets(ops.library()),
      suggested: suggestedNoteLinks(album),
    });

    const preview = ops.editor.querySelector<HTMLElement>("#rating-stars")!;
    const options = ops.editor.querySelector(".rating-options")!;

    // A radio is already checked by the time its click handler runs.
    function clearSelectedRating(event: Event): void {
      const input = event.target;
      if (
        !(input instanceof HTMLInputElement) ||
        input.value !== preview.dataset.rating
      )
        return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== " ") return;
        event.preventDefault();
      }

      input.checked = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    options.addEventListener("pointerover", (event) => {
      if (!(event instanceof PointerEvent) || event.pointerType !== "mouse")
        return;
      const input = event.target;
      if (input instanceof HTMLInputElement)
        preview.style.setProperty("--rating-hover", input.value);
    });
    options.addEventListener("pointerleave", () => {
      preview.style.removeProperty("--rating-hover");
    });
    options.addEventListener("click", clearSelectedRating);
    options.addEventListener("keydown", clearSelectedRating);
    if (entry) updateRating(entry.rating);
  }

  function updateRating(rating: number | null): void {
    const preview = ops.editor.querySelector<HTMLElement>("#rating-stars")!;
    preview.style.removeProperty("--rating-hover");
    preview.innerHTML = stars(rating ?? 0);
    preview.dataset.rating = rating === null ? "" : String(rating);
  }

  function saveListenForm(form: HTMLFormElement): void {
    const data = new FormData(form);
    const album = ops
      .library()
      .albums.find((item) => item.id === form.dataset.id);
    if (!album) return;
    const entry = album.listeningEntries.find(
      (item) => item.id === form.dataset.entryId,
    );
    if (form.dataset.entryId && !entry) return;
    const rating = data.get("rating");
    const parsed = listeningSubmissionSchema.safeParse({
      date: String(data.get("date")),
      rating: rating ? Number(rating) : null,
      notes: String(data.get("notes")),
    });
    if (!parsed.success) return;

    const now = new Date().toISOString();
    album.updatedAt = now;
    const updates = {
      updatedAt: now,
      listenedAt: parsed.data.date,
      rating: parsed.data.rating,
      notes: parsed.data.notes,
    };
    if (entry) Object.assign(entry, updates);
    else
      album.listeningEntries.unshift({
        id: makeId(),
        createdAt: now,
        ...updates,
      });
    ops.finishSave(album.id, entry ? "Listen updated." : "Listen saved.");
  }

  function click(button: HTMLButtonElement, album?: Album): boolean {
    switch (button.dataset.action) {
      case "edit-listen": {
        const entry = album?.listeningEntries.find(
          (item) => item.id === button.dataset.id,
        );
        if (album && entry) openListen(album, entry);
        break;
      }
      case "delete-listen": {
        const form = button.closest<HTMLFormElement>("#listen-form");
        const owner = ops
          .library()
          .albums.find((item) => item.id === form?.dataset.id);
        if (
          !owner ||
          !owner.listeningEntries.some(
            (item) => item.id === form?.dataset.entryId,
          )
        )
          break;
        owner.listeningEntries = owner.listeningEntries.filter(
          (item) => item.id !== form?.dataset.entryId,
        );
        owner.updatedAt = new Date().toISOString();
        ops.finishSave(owner.id, "Listen deleted.");
        break;
      }
      case "listen":
        if (album) openListen(album);
        break;
      default:
        return false;
    }
    return true;
  }

  return { openListen, updateRating, saveListenForm, today, click };
}
