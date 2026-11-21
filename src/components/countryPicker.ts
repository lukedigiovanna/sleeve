import {
  countries,
  findCountry,
  matchesCountry,
  type Country,
} from "../app/countries";
import type { Artist } from "../types/albums";
import { escapeHtml } from "./html";
import { countryFlag } from "./countryFlag";
import { icon } from "./icons";

export function renderCountryPicker(value: string | null | undefined): string {
  const country = findCountry(value);
  return /* HTML */ `<div class="field country-picker">
    <label for="artist-country-query">Country</label>
    <input type="hidden" name="country" value="${country?.id ?? ""}" />
    <div class="country-picker-control">
      <span data-country-flag ${country ? "" : "hidden"}
        >${country ? countryFlag(country) : ""}</span
      >
      <input
        id="artist-country-query"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="artist-country-options"
        aria-expanded="false"
        placeholder="Search countries…"
        value="${escapeHtml(country?.name ?? "")}"
        autocomplete="off"
        data-suggestion-search
      />
      <button
        type="button"
        class="icon-button country-picker-clear"
        aria-label="Clear country"
        title="Clear country"
        ${country ? "" : "hidden"}
      >
        ${icon("close", 16)}
      </button>
      <div class="country-picker-popup" hidden>
        <div
          id="artist-country-options"
          role="listbox"
          aria-label="Countries"
        ></div>
        <p class="muted" data-country-empty role="status" hidden>
          No matching countries
        </p>
      </div>
    </div>
  </div>`;
}

export function syncCountryPicker(root: ParentNode): void {
  const picker = root.querySelector(".country-picker");
  if (picker) updateCountrySelection(picker);
}

function updateCountrySelection(picker: Element): void {
  const value = picker.querySelector<HTMLInputElement>('[name="country"]')!;
  const input = picker.querySelector<HTMLInputElement>(
    "#artist-country-query",
  )!;
  const flag = picker.querySelector<HTMLElement>("[data-country-flag]")!;
  const country = findCountry(value.value);

  value.value = country?.id ?? "";
  input.value = country?.name ?? "";
  flag.innerHTML = country ? countryFlag(country) : "";
  flag.hidden = !country;
  picker.querySelector<HTMLElement>(".country-picker-clear")!.hidden = !country;
}

export class CountryPicker {
  private readonly picker: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly value: HTMLInputElement;
  private readonly list: HTMLElement;
  private readonly popup: HTMLElement;
  private readonly empty: HTMLElement;
  private readonly ranked: readonly Country[];

  constructor(picker: HTMLElement, artists: readonly Artist[]) {
    this.picker = picker;
    this.input = picker.querySelector<HTMLInputElement>(
      "#artist-country-query",
    )!;
    this.value = picker.querySelector<HTMLInputElement>('[name="country"]')!;
    this.list = picker.querySelector<HTMLElement>("#artist-country-options")!;
    this.popup = picker.querySelector<HTMLElement>(".country-picker-popup")!;
    this.empty = picker.querySelector<HTMLElement>("[data-country-empty]")!;

    const counts = new Map<string, number>();
    for (const artist of artists) {
      const code = findCountry(artist.country)?.id;
      if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    this.ranked = [...countries].sort(
      (a, b) =>
        (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name),
    );

    this.input.addEventListener("focus", () => this.open(""));
    this.input.addEventListener("click", () => {
      if (this.popup.hidden) this.open("");
    });
    this.input.addEventListener("input", () => this.open(this.input.value));
    this.input.addEventListener("keydown", (event) => this.keydown(event));
    picker.addEventListener("focusout", (event) => {
      if (
        event.relatedTarget instanceof Node &&
        picker.contains(event.relatedTarget)
      )
        return;
      this.close();
    });
    // Keep focus on the combobox when choosing with a pointer.
    this.list.addEventListener("mousedown", (event) => event.preventDefault());
    this.list.addEventListener("click", (event) => {
      const option = (event.target as Element).closest<HTMLElement>(
        "[data-country-code]",
      );
      if (option) this.choose(option.dataset.countryCode ?? "");
    });
    picker
      .querySelector(".country-picker-clear")!
      .addEventListener("click", () => this.choose(""));
  }

  private open(query: string): void {
    const choices = query.trim()
      ? this.ranked.filter((country) => matchesCountry(query, country))
      : this.ranked;

    this.input.removeAttribute("aria-activedescendant");
    this.list.innerHTML = choices
      .map(
        (country) =>
          /* HTML */ `<div
            id="artist-country-option-${country.id}"
            role="option"
            aria-selected="false"
            data-country-code="${country.id}"
          >
            ${countryFlag(country)} ${escapeHtml(country.name)}
          </div>`,
      )
      .join("");
    this.empty.hidden = choices.length > 0;
    this.popup.hidden = false;
    this.popup.scrollTop = 0;
    this.input.setAttribute("aria-expanded", "true");
  }

  private close(): void {
    this.popup.hidden = true;
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
    updateCountrySelection(this.picker);
  }

  private choose(code: string): void {
    this.value.value = code;
    this.input.focus({ preventScroll: true });
    this.close();
    this.value.dispatchEvent(new Event("input", { bubbles: true }));
  }

  private keydown(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === "Escape" && !this.popup.hidden) {
      event.preventDefault();
      this.close();
      return;
    }

    const active = this.list.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    if (event.key === "Enter" && !this.popup.hidden && active) {
      event.preventDefault();
      this.choose(active.dataset.countryCode ?? "");
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (this.popup.hidden) this.open("");

    const next =
      event.key === "ArrowDown"
        ? (active?.nextElementSibling ?? this.list.firstElementChild)
        : (active?.previousElementSibling ?? this.list.lastElementChild);
    if (!next) return;

    active?.setAttribute("aria-selected", "false");
    next.setAttribute("aria-selected", "true");
    this.input.setAttribute("aria-activedescendant", next.id);
    next.scrollIntoView({ block: "nearest" });
  }
}
