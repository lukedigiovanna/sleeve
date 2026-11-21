import { findCountry } from "./countries.ts";
import type { LibraryFilters, NumericFilter } from "./libraryFilters.ts";
import { categoryFields } from "./libraryCategoryFilters.ts";

export interface LibraryUrlState {
  query: string;
  filters: LibraryFilters;
}

export function isLibraryRoute(hash: string): boolean {
  return (
    hash === "" ||
    hash === "#" ||
    hash === "#library" ||
    hash.startsWith("#library?")
  );
}

function readNumeric(
  params: URLSearchParams,
  key: string,
): NumericFilter | undefined {
  if (params.get(key) === "unset") return { operator: "unset" };

  function bound(name: string): number | undefined {
    const raw = params.get(name);
    if (raw === null || !raw.trim()) return undefined;
    const value = Number(raw);
    const valid =
      key === "rating"
        ? Number.isInteger(value * 2) && value >= 0.5 && value <= 5
        : Number.isInteger(value) && value >= 1000 && value <= 9999;
    return valid ? value : undefined;
  }

  const exact = bound(key);
  if (exact !== undefined) return { operator: "eq", value: exact };
  const min = bound(`${key}Min`);
  const max = bound(`${key}Max`);
  if (min !== undefined && max !== undefined) {
    return min <= max ? { operator: "between", min, max } : undefined;
  }
  if (min !== undefined) return { operator: "gte", value: min };
  if (max !== undefined) return { operator: "lte", value: max };
  return undefined;
}

export function parseLibraryUrl(hash: string): LibraryUrlState {
  const params = new URLSearchParams(hash.split("?")[1] ?? "");
  const filters: LibraryFilters = {};
  const rating = readNumeric(params, "rating");
  const releaseYear = readNumeric(params, "year");
  if (rating) filters.rating = rating;
  if (releaseYear) filters.releaseYear = releaseYear;
  for (const field of categoryFields) {
    const values = params
      .getAll(field)
      .map((id) => (field === "country" ? findCountry(id)?.id : id));
    const ids = [
      ...new Set(values.filter((id): id is string => Boolean(id?.trim()))),
    ];
    if (ids.length) filters[field] = { ids };
  }
  const vinyl = [...new Set(params.getAll("vinyl"))].filter(
    (value): value is "owned" | "wishlisted" =>
      value === "owned" || value === "wishlisted",
  );
  if (vinyl.length) filters.vinylStatus = vinyl;
  return { query: params.get("q") ?? "", filters };
}

function writeNumeric(
  params: URLSearchParams,
  key: string,
  filter: NumericFilter | undefined,
): void {
  if (!filter) return;
  switch (filter.operator) {
    case "unset":
      params.set(key, "unset");
      break;
    case "eq":
      params.set(key, String(filter.value));
      break;
    case "gte":
      params.set(`${key}Min`, String(filter.value));
      break;
    case "lte":
      params.set(`${key}Max`, String(filter.value));
      break;
    case "between":
      params.set(`${key}Min`, String(filter.min));
      params.set(`${key}Max`, String(filter.max));
      break;
  }
}

export function libraryUrl({
  query = "",
  filters = {},
}: Partial<LibraryUrlState> = {}): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  writeNumeric(params, "rating", filters.rating);
  writeNumeric(params, "year", filters.releaseYear);
  for (const field of categoryFields) {
    for (const id of filters[field]?.ids ?? []) params.append(field, id);
  }
  for (const status of filters.vinylStatus ?? [])
    params.append("vinyl", status);
  const encoded = params.toString();
  return encoded ? `#library?${encoded}` : "#library";
}
