import { escapeHtml } from "./html";
import { icon } from "./icons";
import {
  encodeNoteLink,
  mapNoteLinks,
  noteLinkKey,
  type NoteLinkTarget,
} from "./listeningNoteLinks";

export const listeningNoteLimit = 3000;

interface ListeningNoteEditorOptions {
  form: HTMLFormElement;
  targets: () => NoteLinkTarget[];
  suggested: ReadonlySet<string>;
}

interface NoteQuery {
  text: string;
  range: Range;
}

const typeIcons = {
  artist: ["people", "Artist"],
  album: ["disc", "Album"],
  instrument: ["music", "Instrument"],
  genre: ["bars", "Genre"],
} as const;

function referenceSpan(label: string, source: string, linked: boolean): string {
  return /* HTML */ `<span
    class="${linked ? "listen-note-chip" : ""}"
    contenteditable="false"
    data-note-link="${escapeHtml(source)}"
    >${escapeHtml(label)}</span
  >`;
}

function readNote(parent: HTMLElement): string {
  let value = "";
  let previousBlock = false;
  for (const node of parent.childNodes) {
    if (node instanceof HTMLElement && node.dataset.noteLink) {
      if (previousBlock) value += "\n";
      value += node.dataset.noteLink;
      previousBlock = false;
    } else if (node instanceof HTMLBRElement) {
      if (node.nextSibling) value += "\n";
    } else if (node instanceof HTMLElement) {
      const block = node.tagName === "DIV" || node.tagName === "P";
      if ((block || previousBlock) && node.previousSibling) value += "\n";
      value += readNote(node);
      previousBlock = block;
    } else if (node instanceof Text) {
      if (previousBlock) value += "\n";
      value += node.data;
      previousBlock = false;
    }
  }
  return value;
}

function matchRank(target: NoteLinkTarget, query: string): number {
  const label = target.label.toLocaleLowerCase();
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (label.includes(query)) return 2;
  return target.detail?.toLocaleLowerCase().includes(query) ? 3 : -1;
}

const editors = new WeakMap<Element, ListeningNoteEditor>();

export function restoreListeningNoteEditor(root: HTMLElement): void {
  const form = root.querySelector("#listen-form");
  if (form) editors.get(form)?.restore();
}

export class ListeningNoteEditor {
  private readonly input: HTMLElement;
  private readonly value: HTMLTextAreaElement;
  private readonly popup: HTMLElement;
  private readonly list: HTMLElement;
  private readonly empty: HTMLElement;
  private readonly error: HTMLElement;
  private readonly options: ListeningNoteEditorOptions;
  private query: NoteQuery | undefined;
  private results: NoteLinkTarget[] = [];
  private active = 0;

  constructor(options: ListeningNoteEditorOptions) {
    this.options = options;
    const { form } = options;
    this.input = form.querySelector("#listening-notes")!;
    this.value = form.querySelector('[name="notes"]')!;
    this.popup = form.querySelector(".listen-note-picker")!;
    this.list = form.querySelector("#listen-note-options")!;
    this.empty = form.querySelector(".listen-note-empty")!;
    this.error = form.querySelector("#listen-note-error")!;

    editors.set(form, this);
    this.restore();
    this.input.addEventListener("input", (event) => {
      this.value.value = readNote(this.input);
      this.updateLimit();
      if (!(event instanceof InputEvent) || !event.isComposing)
        this.updatePicker();
    });
    this.input.addEventListener("compositionend", () => this.updatePicker());
    this.input.addEventListener("keydown", (event) => this.keydown(event));
    this.input.addEventListener("click", () => this.updatePicker());
    this.input.addEventListener("blur", () => this.closePicker());
    this.input.addEventListener("paste", (event) => {
      event.preventDefault();
      document.execCommand(
        "insertText",
        false,
        event.clipboardData?.getData("text/plain") ?? "",
      );
    });
    this.input.addEventListener("drop", (event) => event.preventDefault());
    this.popup.addEventListener("mousedown", (event) => event.preventDefault());
    this.list.addEventListener("click", (event) => {
      const option = (event.target as Element).closest<HTMLElement>(
        "[data-option]",
      );
      if (option) this.choose(Number(option.dataset.option));
    });
    form.addEventListener("submit", (event) => {
      if (this.value.value.length <= listeningNoteLimit) return;
      event.preventDefault();
      event.stopPropagation();
      this.input.focus();
    });
  }

  public restore(): void {
    const targets = new Map(
      this.options.targets().map((target) => [noteLinkKey(target), target]),
    );
    this.input.innerHTML = mapNoteLinks(
      this.value.value,
      escapeHtml,
      (reference, source) => {
        const target = targets.get(noteLinkKey(reference));
        return referenceSpan(
          target?.label ?? reference.label,
          source,
          Boolean(target),
        );
      },
    );
    // A final non-editable chip needs a trailing caret position. Like the
    // browser's own trailing break, this is omitted when reading the note.
    if (
      this.input.lastChild instanceof HTMLElement &&
      this.input.lastChild.hasAttribute("data-note-link")
    ) {
      this.input.append(document.createElement("br"));
    }

    this.updateLimit();
    this.closePicker();
  }

  private updateLimit(): void {
    const tooLong = this.value.value.length > listeningNoteLimit;
    this.input.setAttribute("aria-invalid", String(tooLong));
    this.error.textContent = tooLong
      ? `Listening notes must be ${listeningNoteLimit.toLocaleString()} characters or fewer, including smart links.`
      : "";
  }

  private currentQuery(): NoteQuery | undefined {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.isCollapsed) return;
    const caret = selection.getRangeAt(0);
    const node = caret.startContainer;
    if (!(node instanceof Text) || !this.input.contains(node)) return;
    if (node.parentElement?.closest('[contenteditable="false"]')) return;

    const text = node.data.slice(0, caret.startOffset);
    const match = /(^|[\s([{“‘])@([^@\r\n]*)$/u.exec(text);
    if (!match) return;

    const start = match.index + match[1].length;
    const previous = node.previousSibling;
    if (start === 0 && previous instanceof Text && /\S$/u.test(previous.data))
      return;

    const range = caret.cloneRange();
    range.setStart(node, start);
    return { text: match[2], range };
  }

  private updatePicker(): void {
    this.query = this.currentQuery();
    if (!this.query) {
      this.closePicker();
      return;
    }

    const query = this.query.text.trim().toLocaleLowerCase();
    this.results = this.options
      .targets()
      .map((target) => ({ target, rank: matchRank(target, query) }))
      .filter(({ rank, target }) =>
        query ? rank >= 0 : this.options.suggested.has(noteLinkKey(target)),
      )
      .sort(
        (a, b) =>
          a.rank - b.rank || a.target.label.localeCompare(b.target.label),
      )
      .slice(0, 8)
      .map(({ target }) => target);

    this.list.innerHTML = this.results
      .map((target, index) => {
        const [symbol, type] = typeIcons[target.type];
        return /* HTML */ `<div
          id="listen-note-option-${index}"
          role="option"
          data-option="${index}"
          class="listen-note-option"
        >
          ${icon(symbol, 17)}
          <span>
            <span class="sr-only">${type} </span>${escapeHtml(target.label)}
            ${target.detail ? /* HTML */ `<small>${escapeHtml(target.detail)}</small>` : ""}
          </span>
        </div>`;
      })
      .join("");
    this.empty.textContent = query
      ? "No matches"
      : "Type to search your library";
    this.empty.hidden = this.results.length > 0;
    this.input.setAttribute("aria-expanded", "true");
    if (!this.popup.matches(":popover-open")) this.popup.showPopover();
    this.positionPicker();
    this.setActive(0);
  }

  private positionPicker(): void {
    if (!this.query) return;
    const caret = this.query.range.cloneRange();
    caret.collapse(false);
    const anchor = caret.getBoundingClientRect();
    const field = this.input.getBoundingClientRect();
    const viewport = window.visualViewport;
    const right = Math.min(
      field.right,
      (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth),
    );
    const bottom =
      (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
    const below = bottom - anchor.bottom - 8;
    const above = anchor.top - (viewport?.offsetTop ?? 0) - 8;
    const placeAbove = below < this.popup.scrollHeight && above > below;
    const room = Math.max(0, placeAbove ? above : below);

    this.popup.style.maxHeight = `${Math.min(260, room)}px`;
    this.popup.style.left = `${Math.max(field.left, Math.min(anchor.left, right - this.popup.offsetWidth))}px`;
    this.popup.style.top = `${placeAbove ? anchor.top - this.popup.offsetHeight - 4 : anchor.bottom + 4}px`;
  }

  private setActive(index: number): void {
    this.active = index;
    const options = [...this.list.children];
    options.forEach((option, position) =>
      option.setAttribute("aria-selected", String(position === index)),
    );
    const option = options[index];
    if (option) {
      this.input.setAttribute("aria-activedescendant", option.id);
      const bounds = option.getBoundingClientRect();
      const popup = this.popup.getBoundingClientRect();
      if (bounds.top < popup.top)
        this.popup.scrollTop -= popup.top - bounds.top;
      if (bounds.bottom > popup.bottom)
        this.popup.scrollTop += bounds.bottom - popup.bottom;
    } else {
      this.input.removeAttribute("aria-activedescendant");
    }
  }

  private closePicker(): void {
    this.query = undefined;
    this.popup.hidePopover();
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
  }

  private keydown(event: KeyboardEvent): void {
    if (!this.query || event.isComposing) return;
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        this.closePicker();
        break;
      case "Enter":
        this.closeOrChoose(event);
        break;
      case "ArrowDown":
      case "ArrowUp": {
        const count = this.results.length;
        if (!count) break;
        event.preventDefault();
        const offset = event.key === "ArrowDown" ? 1 : -1;
        this.setActive((this.active + offset + count) % count);
        break;
      }
      case "ArrowLeft":
      case "ArrowRight":
      case "Home":
      case "End":
        this.closePicker();
        break;
    }
  }

  private closeOrChoose(event: KeyboardEvent): void {
    if (!this.results.length || event.shiftKey) {
      this.closePicker();
      return;
    }
    event.preventDefault();
    this.choose(this.active);
  }

  private choose(index: number): void {
    const target = this.results[index];
    if (!this.query || !target) return;

    const { range } = this.query;
    const source = encodeNoteLink(target);
    this.closePicker();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    // Use the editing command so the replacement participates in native undo.
    document.execCommand(
      "insertHTML",
      false,
      referenceSpan(target.label, source, true) + " ",
    );
  }
}
