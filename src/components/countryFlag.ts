import type { Country } from "../app/countries";

export function countryFlag(country: Country): string {
  return /* HTML */ `<img
    class="country-flag"
    src="/flags/${country.id.toLowerCase()}.svg"
    alt=""
    width="24"
    height="18"
    loading="lazy"
  />`;
}
