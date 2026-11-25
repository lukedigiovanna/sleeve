import { routeHistorySchema, routeMarkerSchema } from "./storageValidation";
import { makeId } from "./id";

export interface RouteHistory {
  arrive: (initialScroll?: number) => number;
  replace: () => void;
  previous: () => string | undefined;
  saveScroll: () => void;
}

// Browser entries are the source of truth, so Back and Forward also move the
// in-app return stack rather than recording another visit.
export function createRouteHistory(accountId: string): RouteHistory {
  const key = "sleeveRoute";
  const storageKey = `sleeve:route-history:${accountId}`;
  let session = makeId();
  const entries: { hash: string; scroll: number }[] = [];
  let cursor = -1;

  try {
    const saved = routeHistorySchema.safeParse(
      JSON.parse(sessionStorage.getItem(storageKey) ?? "null"),
    );
    const marker = routeMarkerSchema.safeParse(history.state?.[key]);
    if (
      saved.success &&
      marker.success &&
      saved.data.session === marker.data.session &&
      saved.data.entries[marker.data.index]?.hash === location.hash
    ) {
      session = saved.data.session;
      entries.push(...saved.data.entries);
    }
  } catch {
    // Navigation still works in memory when storage is unavailable or invalid.
  }

  function persist() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ session, entries }));
    } catch {
      // Storage failures must not interrupt navigation.
    }
  }

  function arrive(initialScroll = 0) {
    const marker = history.state?.[key];
    if (
      marker?.session === session &&
      entries[marker.index]?.hash === location.hash
    ) {
      cursor = marker.index;
      return entries[cursor].scroll;
    }
    entries.splice(cursor + 1);
    cursor = entries.push({ hash: location.hash, scroll: initialScroll }) - 1;
    history.replaceState(
      { ...history.state, [key]: { session, index: cursor } },
      "",
    );
    persist();
    return initialScroll;
  }

  arrive();
  return {
    arrive,
    replace: () => {
      entries[cursor] = { hash: location.hash, scroll: 0 };
      persist();
    },
    previous: () => entries[cursor - 1]?.hash,
    saveScroll: () => {
      if (entries[cursor].scroll === window.scrollY) return;
      entries[cursor].scroll = window.scrollY;
      persist();
    },
  };
}
