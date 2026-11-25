import { escapeHtml } from "./html";

type ResultsScope = "library" | "artists" | "genres" | "instruments";

interface ResultsMetaOptions {
  count?: string;
  controls?: string;
}

export function renderResultsMeta(
  scope: ResultsScope,
  { count = "", controls = "" }: ResultsMetaOptions = {},
): string {
  return /* HTML */ `<div class="results-meta">
    <p id="${scope}-count" class="result-count" role="status">
      ${escapeHtml(count)}
    </p>
    ${controls}
  </div>`;
}
