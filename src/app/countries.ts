import { countryRows } from "../data/countries.ts";
import { matches } from "./search.ts";

export interface Country {
  id: string;
  name: string;
  aliases: readonly string[];
}

export const countries: readonly Country[] = countryRows
  .map(([id, name, ...aliases]) => ({ id, name, aliases }))
  .sort((a, b) => a.name.localeCompare(b.name));

const countriesByCode = new Map(
  countries.map((country) => [country.id, country]),
);

export function findCountry(
  value: string | null | undefined,
): Country | undefined {
  const code = value?.trim().toUpperCase();
  return countriesByCode.get(code === "UK" ? "GB" : (code ?? ""));
}

export function matchesCountry(query: string, country: Country): boolean {
  return (
    query.trim().toUpperCase() === country.id ||
    matches(query, country.name) ||
    country.aliases.some((alias) => matches(query, alias))
  );
}
