export type Layout = "grid" | "list";
type View = "library" | "artist" | "genre";

const storageKey = (view: View) => `sleeve:layout:${view}`;

export function readLayout(view: View): Layout {
  try {
    return localStorage.getItem(storageKey(view)) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

export function saveLayout(view: View, layout: Layout): void {
  try {
    localStorage.setItem(storageKey(view), layout);
  } catch {
    // Layout changes still work for this session when storage is unavailable.
  }
}
