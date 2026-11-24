import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cycleLibrarySort,
  compareLibraryAlbums,
} from "../src/app/librarySort.ts";

test("a category cycles ascending, descending, off and replaces another category", () => {
  const ascending = cycleLibrarySort(null, "title");
  assert.deepEqual(ascending, { category: "title", direction: "ascending" });
  const descending = cycleLibrarySort(ascending, "title");
  assert.deepEqual(descending, { category: "title", direction: "descending" });
  assert.equal(cycleLibrarySort(descending, "title"), null);
  assert.deepEqual(cycleLibrarySort(descending, "year"), {
    category: "year",
    direction: "ascending",
  });
});

const albums = [
  {
    title: "Zulu",
    sortTitle: "Alpha",
    releaseYear: 1950,
    createdAt: "2026-01-01",
    updatedAt: "2026-04-01",
    listeningEntries: [{ listenedAt: "2026-02-01", rating: 3 }],
  },
  {
    title: "Bravo",
    sortTitle: null,
    releaseYear: 1960,
    createdAt: "2026-02-01",
    updatedAt: "2026-02-01",
    listeningEntries: [
      { listenedAt: "2026-03-01", rating: 8 },
      { listenedAt: "2026-01-01", rating: 1 },
    ],
  },
];

for (const category of ["recent", "created", "title", "rating", "year"]) {
  test(`${category} sorts both ways using current values`, () => {
    assert.ok(
      compareLibraryAlbums(albums[0], albums[1], {
        category,
        direction: "ascending",
      }) < 0,
    );
    assert.ok(
      compareLibraryAlbums(albums[0], albums[1], {
        category,
        direction: "descending",
      }) > 0,
    );
  });
}

test("missing values stay last in either direction and ties use album title", () => {
  const missing = {
    ...albums[0],
    title: "Unknown",
    sortTitle: null,
    releaseYear: null,
    listeningEntries: [],
  };
  for (const category of ["recent", "rating", "year"]) {
    for (const direction of ["ascending", "descending"]) {
      assert.ok(
        compareLibraryAlbums(missing, albums[1], { category, direction }) > 0,
      );
      assert.ok(
        compareLibraryAlbums(albums[1], missing, { category, direction }) < 0,
      );
    }
  }
  assert.ok(
    compareLibraryAlbums(
      albums[0],
      { ...albums[0], title: "Zulu", sortTitle: null },
      { category: "rating", direction: "descending" },
    ) < 0,
  );
});
