import type { EditorDialog } from "./editorContracts";
import { icon } from "../components/icons";
import { prefersTouchInteraction } from "./device";
import { createLifecycle } from "./lifecycle";

export interface DialogDependencies {
  editor: HTMLDialogElement;
  main: HTMLElement;
  formState: () => string;
  onRendered: () => void;
  dismissDialog: () => void;
  updateArtists: () => void;
  updateGenres: () => void;
  onClose: () => void;
  routeHash: () => string;
}

export interface PickerPress {
  button: HTMLButtonElement;
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
}

export interface DialogController {
  baseline: string;
  readonly pickerPress: PickerPress | null;
  pickerRenderPending: boolean;
  mount: () => void;
  showDialog: EditorDialog["show"];
  updateSearchDropdowns: (target: EventTarget | null) => void;
  dispose: () => void;
}

export class Dialog implements DialogController {
  baseline = "";
  pickerRenderPending = false;
  private currentPickerPress: PickerPress | null = null;
  private readonly lifecycle = createLifecycle(true);
  private origin: HTMLElement | undefined;
  private suppressPickerClick = false;
  private pointerStartedOutside = false;
  private suppressBackdropClick = false;

  private readonly ops: DialogDependencies;

  constructor(ops: DialogDependencies) {
    this.ops = ops;
    this.listen();
  }

  get pickerPress(): PickerPress | null {
    return this.currentPickerPress;
  }

  mount(): void {
    this.lifecycle.mount();
  }

  showDialog(
    title: string,
    content: string,
    focusSelector: string,
    backToSearch = false,
  ): void {
    const opening = !this.ops.editor.open;
    if (opening) this.origin = document.activeElement as HTMLElement;
    this.ops.editor.innerHTML = /* HTML */ `<div
        class="dialog-heading ${backToSearch ? "dialog-heading-with-back" : ""}"
      >
        <div>
          ${
            backToSearch
              ? /* HTML */ `<button
                  class="dialog-back"
                  type="button"
                  data-action="back-search"
                >
                  ${icon("back", 16)} Back to search
                </button>`
              : ""
          }
          <h2 id="dialog-title" tabindex="-1">${title}</h2>
        </div>
        <button
          class="icon-button close"
          type="button"
          aria-label="Close dialog"
          data-action="close"
        >
          ${icon("close", 22)}
        </button>
      </div>
      ${content}`;
    // Picker controls finish rendering synchronously after showDialog returns.
    this.lifecycle.queue(() => {
      this.baseline = this.ops.formState();
      this.ops.onRendered();
    });
    if (opening) this.ops.editor.showModal();
    this.ops.editor.scrollTop = 0;
    // Keep dialog focus accessible without opening a touch keyboard.
    this.ops.editor
      .querySelector<HTMLElement>(
        prefersTouchInteraction() ? "#dialog-title" : focusSelector,
      )
      ?.focus({ preventScroll: true });
  }

  private isOutsideDialog(event: PointerEvent | MouseEvent): boolean {
    const bounds = this.ops.editor.getBoundingClientRect();
    return (
      this.ops.editor.open &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    );
  }

  updateSearchDropdowns(target: EventTarget | null): void {
    for (const search of this.ops.editor.querySelectorAll(".catalog-search")) {
      search.classList.toggle(
        "is-open",
        target instanceof Node && search.contains(target),
      );
    }
  }

  private finishPickerPress(): void {
    this.currentPickerPress = null;
    if (this.pickerRenderPending) {
      this.pickerRenderPending = false;
      this.ops.updateArtists();
      this.ops.updateGenres();
    }
  }

  private listen(): void {
    this.lifecycle
      .listen(this.ops.editor)
      .addEventListener("input", (event) => {
        this.updateSearchDropdowns(event.target);
      });
    this.lifecycle.listen(document).addEventListener("focusin", (event) => {
      if (!this.currentPickerPress) this.updateSearchDropdowns(event.target);
    });

    this.lifecycle.listen(document).addEventListener("pointermove", (event) => {
      if (this.currentPickerPress?.pointerId !== event.pointerId) return;
      if (
        Math.hypot(
          event.clientX - this.currentPickerPress.x,
          event.clientY - this.currentPickerPress.y,
        ) > 8
      )
        this.currentPickerPress.moved = true;
    });
    this.lifecycle.listen(document).addEventListener(
      "pointerdown",
      (event) => {
        this.finishPickerPress();
        this.suppressPickerClick = false;
        const option = (event.target as Element).closest<HTMLButtonElement>(
          ".catalog-search .instrument-results button:not([disabled])",
        );
        if (
          option &&
          this.ops.editor.contains(option) &&
          event.isPrimary &&
          event.button === 0
        ) {
          this.currentPickerPress = {
            button: option,
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            moved: false,
          };
          // Keep input focus and the software keyboard stable. Touch scrolling
          // remains native; pointercancel or movement prevents selection.
          event.preventDefault();
        }
        this.updateSearchDropdowns(event.target);
        this.suppressBackdropClick = false;
        this.pointerStartedOutside =
          event.target === this.ops.editor && this.isOutsideDialog(event);
      },
      true,
    );
    this.lifecycle.listen(document).addEventListener("pointercancel", () => {
      if (this.currentPickerPress) this.suppressPickerClick = true;
      this.finishPickerPress();
      this.pointerStartedOutside = false;
    });
    this.lifecycle.listen(document).addEventListener(
      "pointerup",
      (event) => {
        if (this.currentPickerPress?.pointerId === event.pointerId) {
          const press = this.currentPickerPress;
          this.currentPickerPress = null;
          this.suppressPickerClick = true;
          const releasedOn = document.elementFromPoint(
            event.clientX,
            event.clientY,
          );
          if (
            !press.moved &&
            press.button.isConnected &&
            releasedOn &&
            press.button.contains(releasedOn)
          ) {
            // Activate the original option once, before focus or keyboard changes
            // can retarget the browser's subsequent compatibility click.
            press.button.click();
          }
          this.finishPickerPress();
        }
        // Handle the release directly, before a synthesized click or focus change.
        // Dragging from a field to the backdrop must not dismiss the form.
        const dismiss =
          this.pointerStartedOutside && this.isOutsideDialog(event);
        this.pointerStartedOutside = false;
        if (dismiss) {
          this.suppressBackdropClick = true;
          event.preventDefault();
          event.stopPropagation();
          this.ops.dismissDialog();
        }
      },
      true,
    );
    this.lifecycle.listen(document).addEventListener(
      "click",
      (event) => {
        if (this.suppressPickerClick && event.detail > 0) {
          this.suppressPickerClick = false;
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        if (!this.suppressBackdropClick) return;
        this.suppressBackdropClick = false;
        // iOS can send a click to the control exposed by closing the dialog.
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true,
    );
    this.lifecycle
      .listen(this.ops.editor)
      .addEventListener("cancel", (event) => {
        event.preventDefault();
        this.ops.dismissDialog();
      });

    // Keep Tab at the dialog boundaries rather than moving into browser chrome.
    this.lifecycle
      .listen(this.ops.editor)
      .addEventListener("keydown", (event) => {
        const search = (event.target as HTMLElement).closest(".catalog-search");
        if (search) {
          const input = search.querySelector<HTMLInputElement>("input")!;
          const options = [
            ...search.querySelectorAll<HTMLButtonElement>(
              "button:not([disabled])",
            ),
          ];
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const index = options.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const next =
              event.key === "ArrowDown"
                ? index + 1
                : index < 0
                  ? options.length - 1
                  : index - 1;
            (options[next] ?? input).focus();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            this.updateSearchDropdowns(null);
            this.ops.editor
              .querySelector<HTMLElement>("#dialog-title")
              ?.focus({ preventScroll: true });
            return;
          }
        }
        if (
          event.key === "Enter" &&
          ["instrument-query", "artist-query", "genre-query"].includes(
            (event.target as HTMLElement).id,
          )
        ) {
          event.preventDefault();
          this.ops.editor
            .querySelector<HTMLButtonElement>(
              (event.target as HTMLElement).id === "artist-query"
                ? "#artist-results button"
                : (event.target as HTMLElement).id === "genre-query"
                  ? "#genre-results button:not([disabled])"
                  : "#instrument-create:not([hidden]) button, #instrument-results button",
            )
            ?.click();
          return;
        }
        if (event.key !== "Tab") return;
        const controls = [
          ...this.ops.editor.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary",
          ),
        ].filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      });

    this.lifecycle.listen(this.ops.editor).addEventListener("close", () => {
      this.ops.onClose();
      if (
        this.origin?.isConnected &&
        location.hash === this.ops.routeHash() &&
        !this.ops.main.contains(document.activeElement)
      )
        this.origin.focus();
      this.origin = undefined;
    });
  }

  dispose(): void {
    this.lifecycle.dispose();
    this.origin = undefined;
    this.currentPickerPress = null;
  }
}
