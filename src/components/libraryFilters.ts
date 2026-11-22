import type { LibraryData } from "../types/library";
import { escapeHtml } from "./html";
import { stars } from "./rating";
import {
  categoryFields,
  categoryName,
  type CategoryField,
} from "../app/libraryCategoryFilters";
import {
  renderFilterControls,
  updateFilterCount,
  type BrowseScope,
} from "./catalogFilters";
import { renderCategoryFilter } from "./libraryCategoryFilters";
import { icon, starPath } from "./icons";
import {
  isVinylStatus,
  vinylStatusIcon,
  vinylStatusLabel,
} from "../app/vinylStatus";
import {
  filterFields,
  type FilterField,
  type LibraryFilters,
  type NumericFilter,
} from "../app/libraryFilters";

const labels: Record<FilterField, string> = {
  rating: "Rating",
  releaseYear: "Release year",
  genres: "Genre",
  artists: "Artist",
  country: "Country",
  instruments: "Instrument",
  vinylStatus: "Vinyl status",
};

function numericBounds(filter?: NumericFilter): [number | "", number | ""] {
  if (!filter || filter.operator === "unset") return ["", ""];

  switch (filter.operator) {
    case "eq":
      return [filter.value, filter.value];
    case "gte":
      return [filter.value, ""];
    case "lte":
      return ["", filter.value];
    case "between":
      return [filter.min, filter.max];
  }
}

function renderBound(
  field: "rating" | "releaseYear",
  side: "min" | "max",
  value: number | "",
  disabled: boolean,
): string {
  const id = `${field}-${side}`;
  const attributes = /* HTML */ `id="${id}" aria-describedby="${field}-error"
  ${disabled ? "disabled" : ""}`;
  if (field === "releaseYear") {
    const currentYear = new Date().getFullYear();
    return /* HTML */ `<select ${attributes} class="filter-year-select">
      <option value="">Any</option>
      ${
        typeof value === "number" && value > currentYear
          ? /* HTML */ `<option value="${value}" selected>${value}</option>`
          : ""
      }
      ${Array.from(
        { length: currentYear - 999 },
        (_, index) => currentYear - index,
      )
        .map(
          (year) =>
            /* HTML */ `<option
              value="${year}"
              ${value === year ? "selected" : ""}
            >
              ${year}
            </option>`,
        )
        .join("")}
    </select>`;
  }

  return /* HTML */ `<div
    class="filter-star-bound"
    role="radiogroup"
    aria-label="${side === "min" ? "From rating" : "To rating"}"
    aria-describedby="rating-error"
  >
    <input ${attributes} type="hidden" value="${value}" />
    <div class="filter-star-picker">
      <span data-bound-stars>${stars(value === "" ? 0 : value * 2)}</span>
      <div class="filter-star-options">
        ${Array.from({ length: 10 }, (_, index) => (index + 1) / 2)
          .map(
            (rating) =>
              /* HTML */ `<input
                type="radio"
                name="library-${id}"
                value="${rating}"
                aria-label="${rating} stars"
                ${value === rating ? "checked" : ""}
                ${disabled ? "disabled" : ""}
              />`,
          )
          .join("")}
      </div>
    </div>
  </div>`;
}

function renderLabeledBound(
  field: "rating" | "releaseYear",
  side: "min" | "max",
  value: number | "",
  disabled: boolean,
): string {
  const label = side === "min" ? "From" : "To";
  if (field === "rating") return renderBound(field, side, value, disabled);
  return /* HTML */ `<label class="field"
    ><span class="sr-only">${label} year</span
    >${renderBound(field, side, value, disabled)}</label
  >`;
}

export function toggleSelectedRating(input: HTMLInputElement): void {
  if (
    !input.matches('.filter-star-options input[type="radio"]') ||
    input.disabled
  )
    return;
  const bound = input.closest<HTMLElement>(".filter-star-bound")!;
  const previous = bound.querySelector<HTMLInputElement>(
    'input[type="hidden"]',
  )!.value;
  if (previous !== input.value) return;

  input.checked = false;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function updateStarBound(
  root: HTMLElement,
  side: "min" | "max",
  disabled: boolean,
): void {
  const group = root
    .querySelector<HTMLElement>(`#rating-${side}`)!
    .closest<HTMLElement>(".filter-star-bound")!;
  const selected = group.querySelector<HTMLInputElement>(
    'input[type="radio"]:checked',
  );
  const value = selected?.value ?? "";
  group.querySelector<HTMLInputElement>('input[type="hidden"]')!.value = value;
  group
    .querySelectorAll<HTMLInputElement>('input[type="radio"]')
    .forEach((input) => {
      input.disabled = disabled;
    });
  group.querySelector<HTMLElement>("[data-bound-stars]")!.innerHTML = stars(
    Number(value) * 2,
  );
  group.setAttribute("aria-disabled", String(disabled));
}

function numericControl(
  field: "rating" | "releaseYear",
  filter?: NumericFilter,
): string {
  const [min, max] = numericBounds(filter);
  const unset = filter?.operator === "unset";

  return /* HTML */ `<div
    data-numeric="${field}"
    role="group"
    aria-labelledby="${field}-label"
  >
    <div class="numeric-filter-row">
      <span id="${field}-label" class="numeric-filter-label"
        >${labels[field]}</span
      >
      ${renderLabeledBound(field, "min", min, unset)}
      <span class="numeric-range-separator" aria-hidden="true">–</span>
      ${renderLabeledBound(field, "max", max, unset)}
      ${
        field === "rating"
          ? /* HTML */ `<label class="numeric-unset-toggle" title="Unrated only"
              ><input
                type="checkbox"
                id="rating-unset"
                aria-label="Unrated only"
                ${unset ? "checked" : ""} /><svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="${starPath}" />
                <path d="M3 3 21 21" /></svg
            ></label>`
          : /* HTML */ `<button
              type="button"
              class="numeric-unset-toggle numeric-clear-year"
              data-action="clear-library-year"
              aria-label="Clear year filter"
              title="Clear year filter"
            >
              ${icon("close", 16)}
            </button>`
      }
    </div>
    <p id="${field}-error" class="filter-error" role="status"></p>
  </div>`;
}

function renderVinylFilter(filters: LibraryFilters): string {
  return /* HTML */ `<div class="vinyl-filter-row">
    <span class="numeric-filter-label" id="library-vinyl-label">Vinyl</span>
    <div
      class="vinyl-filter-options"
      role="group"
      aria-labelledby="library-vinyl-label"
    >
      ${(["owned", "wishlisted"] as const)
        .map((value) => {
          const label = vinylStatusLabel(value);
          return /* HTML */ `<label class="vinyl-filter-option" title="${label}"
            ><input
              type="checkbox"
              name="library-vinyl-status"
              value="${value}"
              aria-label="${label}"
              ${filters.vinylStatus?.includes(value) ? "checked" : ""}
            />${icon(vinylStatusIcon(value), 17)}</label
          >`;
        })
        .join("")}
    </div>
  </div>`;
}

export function renderLibraryFilters(
  filters: LibraryFilters,
  data: LibraryData,
): string {
  return renderFilterControls(
    /* HTML */ `${numericControl("rating", filters.rating)}${numericControl("releaseYear", filters.releaseYear)}
    ${renderVinylFilter(filters)}
    ${categoryFields.map((field) => renderCategoryFilter(field, filters, data)).join("")}`,
    "library",
  );
}

interface NumericChip {
  content: string;
  description: string;
}

function renderNumericChip(
  field: "rating" | "releaseYear",
  filter: NumericFilter,
): NumericChip {
  function valueContent(value: number): string {
    if (field === "releaseYear") return String(value);
    return /* HTML */ `<span class="filter-chip-rating"
      >${stars(value * 2)}</span
    >`;
  }

  function valueLabel(value: number): string {
    return field === "rating" ? `${value} stars` : String(value);
  }

  switch (filter.operator) {
    case "unset":
      return field === "rating"
        ? {
            content: /* HTML */ `<svg
              class="filter-chip-unrated"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="${starPath}" />
              <path d="M3 3 21 21" />
            </svg>`,
            description: "Unrated",
          }
        : { content: "Unknown year", description: "Unknown year" };
    case "eq":
      return {
        content: valueContent(filter.value),
        description: valueLabel(filter.value),
      };
    case "gte":
      return {
        content: /* HTML */ `<span>≥</span>${valueContent(filter.value)}`,
        description: `≥ ${valueLabel(filter.value)}`,
      };
    case "lte":
      return {
        content: /* HTML */ `<span>≤</span>${valueContent(filter.value)}`,
        description: `≤ ${valueLabel(filter.value)}`,
      };
    case "between":
      return {
        content: /* HTML */ `${valueContent(filter.min)}<span>–</span>${valueContent(filter.max)}`,
        description: `${valueLabel(filter.min)} – ${valueLabel(filter.max)}`,
      };
  }
}

export function renderFilterChips(
  filters: LibraryFilters,
  data: LibraryData,
  scope: BrowseScope = "library",
): string {
  return filterFields
    .filter((field) => filters[field] !== undefined)
    .map((field) => {
      const filter = filters[field]!;
      let content: string;
      let description: string;
      if ("length" in filter) {
        description = filter.map(vinylStatusLabel).join(" or ");
        content = filter
          .map((status) => icon(vinylStatusIcon(status), 15))
          .join(/* HTML */ `<span>/</span>`);
      } else if ("ids" in filter) {
        description = filter.ids
          .map(
            (id) =>
              categoryName(data, field as CategoryField, id) ?? "Unavailable",
          )
          .join(field === "instruments" ? " + " : " / ");
        content = escapeHtml(description);
      } else {
        const chip = renderNumericChip(
          field === "rating" ? "rating" : "releaseYear",
          filter,
        );
        description = chip.description;
        content = chip.content;
      }
      return /* HTML */ `<button
        type="button"
        class="button secondary filter-chip"
        data-action="remove-${scope}-filter"
        data-filter="${field}"
        aria-label="Remove ${labels[field]} filter"
        aria-description="${escapeHtml(description)}"
        title="${escapeHtml(description)} — click to clear"
      >
        ${content}
      </button>`;
    })
    .join("");
}

export function updateBrowseFilters(
  root: ParentNode,
  filters: LibraryFilters,
  data: LibraryData,
  scope: BrowseScope,
): void {
  root.querySelector(`#${scope}-filter-chips`)!.innerHTML = renderFilterChips(
    filters,
    data,
    scope,
  );
  updateFilterCount(root, Object.keys(filters).length);
}

function validBound(field: "rating" | "releaseYear", value: number): boolean {
  if (field === "rating")
    return (
      Number.isFinite(value) &&
      value >= 0.5 &&
      value <= 5 &&
      Number.isInteger(value * 2)
    );
  return Number.isInteger(value) && value >= 1000 && value <= 9999;
}

// Incomplete numeric edits keep the last valid predicate active.
export function readLibraryFilters(
  root: ParentNode,
  previous: LibraryFilters,
): LibraryFilters {
  const next = { ...previous };
  for (const field of ["rating", "releaseYear"] as const) {
    const group = root.querySelector<HTMLElement>(`[data-numeric="${field}"]`)!;
    const minInput = group.querySelector<HTMLInputElement | HTMLSelectElement>(
      `#${field}-min`,
    )!;
    const maxInput = group.querySelector<HTMLInputElement | HTMLSelectElement>(
      `#${field}-max`,
    )!;
    const unset =
      field === "rating" &&
      group.querySelector<HTMLInputElement>("#rating-unset")!.checked;
    const error = group.querySelector<HTMLElement>(".filter-error")!;
    if (field === "rating") {
      updateStarBound(group, "min", unset);
      updateStarBound(group, "max", unset);
    }
    minInput.disabled = unset;
    maxInput.disabled = unset;
    minInput.removeAttribute("aria-invalid");
    maxInput.removeAttribute("aria-invalid");
    error.textContent = "";

    if (unset) {
      next[field] = { operator: "unset" };
      continue;
    }

    const min = minInput.value === "" ? undefined : Number(minInput.value);
    const max = maxInput.value === "" ? undefined : Number(maxInput.value);
    const invalidMin =
      !minInput.validity.valid ||
      (min !== undefined && !validBound(field, min));
    const invalidMax =
      !maxInput.validity.valid ||
      (max !== undefined && !validBound(field, max));
    const reversed = min !== undefined && max !== undefined && max < min;
    if (invalidMin || invalidMax || reversed) {
      minInput.setAttribute("aria-invalid", String(invalidMin || reversed));
      maxInput.setAttribute("aria-invalid", String(invalidMax || reversed));
      error.textContent = reversed
        ? "The end must be at least the start. Your previous filter is still applied."
        : `Choose a valid rating or a year from 1000 to 9999. Your previous filter is still applied.`;
      continue;
    }

    if (min !== undefined && max !== undefined) {
      next[field] =
        min === max
          ? { operator: "eq", value: min }
          : { operator: "between", min, max };
    } else if (min !== undefined) next[field] = { operator: "gte", value: min };
    else if (max !== undefined) next[field] = { operator: "lte", value: max };
    else delete next[field];
  }
  const vinyl = [
    ...root.querySelectorAll<HTMLInputElement>(
      'input[name="library-vinyl-status"]:checked',
    ),
  ]
    .map((input) => input.value)
    .filter(isVinylStatus);
  if (vinyl.length) next.vinylStatus = vinyl;
  else delete next.vinylStatus;
  return next;
}
