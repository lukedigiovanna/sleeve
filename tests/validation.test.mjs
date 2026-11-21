import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  albumSubmissionSchema,
  httpUrlSchema,
  optionalHttpUrlSchema,
  importMappingsSchema,
  listeningSubmissionSchema,
} from "../src/app/formValidation.ts";
import {
  isDemoAlbums,
  isDemoArtistCatalog,
  isDemoGenreCatalog,
  isDemoInstrumentCatalog,
  isLibrarySnapshot,
  routeHistorySchema,
  routeMarkerSchema,
} from "../src/app/storageValidation.ts";
import {
  readAlbums,
  readArtistCatalog,
  readGenreCatalog,
  readInstrumentCatalog,
  saveAlbums,
} from "../src/app/storage.ts";
import {
  readLibraryCache,
  writeLibraryCache,
} from "../src/app/libraryCache.ts";
import { mockAlbums } from "../src/data/mockData.ts";

const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);
afterEach(() => {
  if (originalStorage)
    Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
});

function storage(value) {
  const entries = new Map(Object.entries(value));
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, text) => entries.set(key, text),
    },
  });
  return entries;
}

function library() {
  return {
    albums: structuredClone(mockAlbums),
    artists: [],
    genres: [],
    instruments: [],
  };
}

test("form schemas retain HTTP(S), credential rejection, blank and numeric conversions", () => {
  for (const value of ["https://example.com/a", "http://example.com/?a=1&b=2"])
    assert.equal(httpUrlSchema.safeParse(value).success, true);
  for (const value of [
    "",
    "example.com",
    "javascript:alert(1)",
    "ftp://example.com",
    "https://user:secret@example.com",
  ])
    assert.equal(httpUrlSchema.safeParse(value).success, false);
  assert.equal(optionalHttpUrlSchema.safeParse("").success, true);
  for (const [year, expected] of [
    ["", null],
    ["0", null],
    ["1976", 1976],
  ]) {
    const result = albumSubmissionSchema.parse({
      title: "Album",
      artwork: "",
      year,
      label: "",
    });
    assert.equal(result.year, expected);
    assert.equal(result.label, "");
  }
  const result = albumSubmissionSchema.safeParse({
    title: "",
    artwork: "invalid",
    year: "",
    label: "",
  });
  assert.equal(result.success, false);
  assert.deepEqual(
    result.error.issues.map((issue) => issue.path),
    [["title"], ["artwork"]],
  );
});

test("mapping parsing filters individual values and rejects invalid containers", () => {
  assert.deepEqual(
    importMappingsSchema.parse({
      good: "id",
      blank: "",
      bad: 4,
      missing: null,
    }),
    { good: "id", blank: "" },
  );
  for (const value of [null, [], "mapping", 4])
    assert.equal(importMappingsSchema.safeParse(value).success, false);
});

test("listening submissions preserve trimmed blank notes and native date/rating limits", () => {
  assert.deepEqual(
    listeningSubmissionSchema.parse({
      date: "2024-02-29",
      rating: 8,
      notes: "  \n ",
    }),
    { date: "2024-02-29", rating: 8, notes: "" },
  );
  for (const updates of [
    { rating: 0 },
    { rating: 11 },
    { rating: 2.5 },
    { rating: NaN },
    { date: "2025-02-29" },
    { date: "1899-12-31" },
    { date: "9999-01-01" },
    { notes: "x".repeat(3001) },
  ])
    assert.equal(
      listeningSubmissionSchema.safeParse({
        date: "2024-01-01",
        rating: 8,
        notes: "",
        ...updates,
      }).success,
      false,
    );
});

test("demo schemas preserve legacy acceptance without draft requirements or stripping extras", () => {
  const albums = structuredClone(mockAlbums);
  const album = albums[0];
  album.future = { retained: true };
  delete album.sortTitle;
  album.artists = [{ name: "Legacy artist" }];
  album.genres = [{ name: "Legacy genre" }];
  album.instruments = [
    { id: "legacy", name: "Legacy", categories: ["legacy-category"] },
  ];
  album.links = [{ url: "legacy URL" }];
  album.listeningEntries = [
    { listenedAt: "2024-01-01", rating: 8, instruments: ["Piano"] },
  ];
  assert.equal(isDemoAlbums(albums), true);
  assert.deepEqual(album.future, { retained: true });
  assert.equal(
    isDemoArtistCatalog({ artists: [{ id: "a", name: "A" }] }),
    true,
  );
  assert.equal(isDemoGenreCatalog({ genres: [{ id: "g", name: "G" }] }), true);
  assert.equal(
    isDemoInstrumentCatalog({ instruments: album.instruments }),
    false,
  );
  assert.equal(
    isDemoInstrumentCatalog({
      instruments: [{ id: "i", name: "I", categories: [] }],
    }),
    true,
  );
});

test("demo loading keeps legacy instrumentation upgrades, fallback and catalog identity rules", () => {
  const albums = structuredClone(mockAlbums);
  albums[0].future = "retained";
  albums[0].listeningEntries = [
    {
      listenedAt: "2024-01-01",
      rating: 8,
      instruments: ["  New instrument  ", ""],
    },
  ];
  const entries = storage({ "sleeve-demo-v1": JSON.stringify(albums) });
  const loaded = readAlbums();
  assert.equal(loaded[0].future, "retained");
  assert.ok(
    loaded[0].instruments.some((item) => item.name === "New instrument"),
  );
  assert.equal("instruments" in loaded[0].listeningEntries[0], false);
  const artists = readArtistCatalog(loaded);
  const genres = readGenreCatalog(loaded);
  const instruments = readInstrumentCatalog(loaded);
  assert.equal(saveAlbums(loaded, instruments, artists, genres), true);
  assert.deepEqual(readAlbums(), JSON.parse(JSON.stringify(loaded)));
  assert.deepEqual(
    readArtistCatalog(loaded),
    JSON.parse(JSON.stringify(artists)),
  );
  assert.deepEqual(readGenreCatalog(loaded), genres);
  entries.set("sleeve-demo-v1", "{broken");
  assert.deepEqual(readAlbums(), mockAlbums);
  const fallback = readAlbums();
  fallback[0].title = "not shared";
  assert.notEqual(readAlbums()[0].title, "not shared");
});

test("storage schemas reject malformed values while cache preserves its existing version contract", () => {
  for (const update of [
    { title: 4 },
    { releaseYear: "1976" },
    { instruments: [null] },
    { listeningEntries: [{ listenedAt: "bad", rating: 8 }] },
    { listeningEntries: [{ listenedAt: "2024-01-01", rating: 11 }] },
  ]) {
    const album = { ...structuredClone(mockAlbums[0]), ...update };
    assert.equal(isDemoAlbums([album]), false);
  }
  const snapshot = {
    version: 1,
    accountId: "account-a",
    syncedAt: 1,
    data: library(),
    extra: "retained",
  };
  snapshot.data.albums[0].links = [null]; // Cache v1 historically only checks the array.
  assert.equal(isLibrarySnapshot(snapshot), true);
  for (const update of [
    { version: 2 },
    { syncedAt: "1" },
    { syncedAt: Infinity },
    { data: { albums: [] } },
  ])
    assert.equal(isLibrarySnapshot({ ...snapshot, ...update }), false);
  storage({ "sleeve-library-v1:account-a": JSON.stringify(snapshot) });
  assert.equal(readLibraryCache("account-a").extra, "retained");
  assert.equal(readLibraryCache("account-b"), undefined);
  assert.equal(writeLibraryCache("account-b", library(), 2), true);
  assert.equal(readLibraryCache("account-b").accountId, "account-b");
  assert.equal(readLibraryCache("account-b").syncedAt, 2);
});

test("blocked storage retains demo fallback and cache failure behavior", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("blocked");
    },
  });
  assert.deepEqual(readAlbums(), mockAlbums);
  assert.equal(saveAlbums([], [], [], []), false);
  assert.equal(readLibraryCache("account"), undefined);
  assert.equal(writeLibraryCache("account", library()), false);
});

test("route snapshot and marker schemas preserve finite scroll and integer marker checks", () => {
  assert.equal(
    routeHistorySchema.safeParse({
      session: "s",
      entries: [{ hash: "#album/a", scroll: 4.5 }],
    }).success,
    true,
  );
  assert.equal(
    routeMarkerSchema.safeParse({ session: "s", index: 0 }).success,
    true,
  );
  for (const scroll of [-1, Infinity, "4", null])
    assert.equal(
      routeHistorySchema.safeParse({
        session: "s",
        entries: [{ hash: "#", scroll }],
      }).success,
      false,
    );
  for (const index of [0.5, "0", null])
    assert.equal(
      routeMarkerSchema.safeParse({ session: "s", index }).success,
      false,
    );
});

test("vinyl status validates stored values while accepting legacy albums", () => {
  for (const status of [undefined, null, "owned", "wishlisted", "invalid"]) {
    const data = library();
    data.albums[0].vinylStatus = status;
    assert.equal(isDemoAlbums(data.albums), status !== "invalid");
    assert.equal(
      isLibrarySnapshot({ version: 1, accountId: "a", syncedAt: 0, data }),
      status !== "invalid",
    );
  }
});

test("demo catalog and offline cache upgrade legacy parent links", () => {
  const data = library();
  const parent = { id: "jazz", name: "Jazz", parentGenreId: null };
  const child = { id: "fusion", name: "Jazz House", parentGenreId: "jazz" };
  data.genres = [parent, child];
  data.albums[0].genres = [{ ...child, isPrimary: true }];
  storage({ "sleeve-demo-v1": JSON.stringify(data) });
  assert.deepEqual(
    readGenreCatalog(data.albums).find((genre) => genre.id === "fusion")
      .parentGenreIds,
    ["jazz"],
  );
  assert.equal(writeLibraryCache("legacy", data), true);
  const cached = readLibraryCache("legacy");
  assert.deepEqual(
    cached.data.genres.find((genre) => genre.id === "fusion").parentGenreIds,
    ["jazz"],
  );
  assert.deepEqual(cached.data.albums[0].genres[0].parentGenreIds, ["jazz"]);
});
