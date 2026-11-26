import { renderCatalogFilters } from "./catalogFilters";
import { escapeHtml } from "./html";
import { icon } from "./icons";

interface CatalogSearchRowOptions {
  inputId: string;
  label: string;
  placeholder?: string;
  query: string;
  filters: { content: string; activeCount: number };
  sort?: string;
  toolbarClass?: string;
}

export function renderCatalogSearchRow({
  inputId,
  label,
  placeholder = label,
  query,
  filters,
  sort = "",
  toolbarClass = "toolbar library-toolbar",
}: CatalogSearchRowOptions): string {
  return /* HTML */ `<div class="${escapeHtml(toolbarClass)}">
    <label class="search-field">
      ${icon("search")}<span class="sr-only">${escapeHtml(label)}</span>
      <input
        id="${escapeHtml(inputId)}"
        type="search"
        placeholder="${escapeHtml(placeholder)}"
        value="${escapeHtml(query)}"
      />
    </label>
    ${renderCatalogFilters(filters.content, filters.activeCount)} ${sort}
  </div>`;
}
