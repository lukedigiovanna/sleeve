import { test } from "node:test";
import assert from "node:assert/strict";
import { libraryDelta } from "../src/services/libraryDelta.ts";
const base = () => ({
  albums: [
    {
      id: "a",
      title: "Title",
      releaseYear: 2000,
      artists: [
        { id: "x", role: "primary", position: 0 },
        { id: "y", role: "primary", position: 1 },
      ],
      genres: [],
      instruments: [],
      links: [],
      listeningEntries: [],
    },
  ],
  artists: [
    { id: "x", name: "X" },
    { id: "y", name: "Y" },
  ],
  genres: [],
  instruments: [],
});
test("unchanged libraries send empty deltas", () => {
  for (const change of Object.values(libraryDelta(base(), base())))
    assert.deepEqual(change, { saved: [], deleted: [] });
});
test("new, changed and deleted rows are sent without replacing the library", () => {
  const before = base(),
    next = base();
  next.albums[0].title = "Changed";
  next.artists = [
    { id: "x", name: "Updated X" },
    { id: "z", name: "Z" },
  ];
  const delta = libraryDelta(before, next);
  assert.deepEqual(
    delta.artists.saved.map((row) => row.id),
    ["x", "z"],
  );
  assert.deepEqual(
    delta.artists.deleted.map((row) => row.id),
    ["y"],
  );
  assert.equal(delta.albums.saved[0].title, "Changed");
  assert.deepEqual(delta.albums.deleted, []);
});
test("reordered associations delete old rows before saving replacements", () => {
  const before = base(),
    next = base();
  next.albums[0].artists
    .reverse()
    .forEach((artist, position) => (artist.position = position));
  const delta = libraryDelta(before, next);
  assert.equal(delta.album_artists.saved.length, 2);
  assert.deepEqual(
    delta.album_artists.deleted,
    libraryDelta({ ...before, albums: [] }, before).album_artists.saved,
  );
  next.albums[0].artists.pop();
  assert.equal(libraryDelta(before, next).album_artists.deleted.length, 2);
});

test("primary genres and instrument categories replace changed associations without sending server timestamps", () => {
  const before = base();
  before.instruments = [{ id: "i", name: "Instrument", categories: ["brass"] }];
  before.albums[0].genres = [{ id: "g", isPrimary: false }];
  before.albums[0].listeningEntries = [
    {
      id: "listen",
      rating: 8,
      listenedAt: "2026-01-01",
      notes: "",
      createdAt: "server-created",
      updatedAt: "server-updated",
    },
  ];
  const next = structuredClone(before);
  next.instruments[0].categories = ["woodwind"];
  next.albums[0].genres[0].isPrimary = true;
  next.albums[0].listeningEntries[0].rating = 10;
  const delta = libraryDelta(before, next);
  assert.deepEqual(delta.instrument_categories, {
    deleted: [{ instrument_id: "i", category: "brass" }],
    saved: [{ instrument_id: "i", category: "woodwind" }],
  });
  assert.deepEqual(delta.album_genres.deleted, [
    { album_id: "a", genre_id: "g", is_primary: false },
  ]);
  assert.deepEqual(delta.album_genres.saved, [
    { album_id: "a", genre_id: "g", is_primary: true },
  ]);
  assert.deepEqual(delta.listening_entries.saved, [
    {
      id: "listen",
      album_id: "a",
      rating: 10,
      listened_at: "2026-01-01T00:00:00.000Z",
      notes: null,
    },
  ]);
});

test("vinyl status changes send album updates, including explicit null to clear", () => {
  const before = base();
  for (const status of ["wishlisted", "owned", null]) {
    const next = structuredClone(before);
    next.albums[0].vinylStatus = status;
    if (status === null) before.albums[0].vinylStatus = "owned";
    const delta = libraryDelta(before, next);
    assert.equal(delta.albums.saved.length, 1);
    assert.equal(delta.albums.saved[0].vinyl_status, status);
    assert.deepEqual(delta.albums.deleted, []);
  }
});

test("parent changes send edge deltas without rewriting genres or album tags", () => {
  const before = base();
  before.genres = [
    { id: "jazz", name: "Jazz", parentGenreIds: [] },
    { id: "house", name: "House", parentGenreIds: [] },
    { id: "fusion", name: "Jazz House", parentGenreIds: ["jazz"] },
  ];
  before.albums[0].genres = [
    { id: "jazz", isPrimary: true },
    { id: "fusion", isPrimary: false },
  ];
  const next = structuredClone(before);
  next.genres[2].parentGenreIds.push("house");
  const delta = libraryDelta(before, next);
  assert.deepEqual(delta.genre_parents, {
    saved: [{ parent_genre_id: "house", child_genre_id: "fusion" }],
    deleted: [],
  });
  assert.deepEqual(delta.genres, { saved: [], deleted: [] });
  assert.deepEqual(delta.album_genres, { saved: [], deleted: [] });
  next.genres[2].parentGenreIds = ["house"];
  assert.deepEqual(libraryDelta(before, next).genre_parents.deleted, [
    { parent_genre_id: "jazz", child_genre_id: "fusion" },
  ]);
});

test("artist link changes only affect the artist link delta", () => {
  const before = base();
  before.artists[0].links = [
    { id: "first", url: "https://example.com/first", label: null },
    { id: "removed", url: "https://example.com/removed", label: "Remove" },
  ];
  const next = structuredClone(before);
  next.artists[0].links[0].label = "Updated";
  next.artists[0].links.pop();
  next.artists[1].links = [
    { id: "added", url: "https://example.com/added", label: null },
  ];

  const delta = libraryDelta(before, next);
  assert.deepEqual(delta.artists, { saved: [], deleted: [] });
  assert.deepEqual(delta.album_links, { saved: [], deleted: [] });
  assert.deepEqual(delta.artist_links, {
    saved: [
      {
        id: "first",
        artist_id: "x",
        url: "https://example.com/first",
        label: "Updated",
      },
      {
        id: "added",
        artist_id: "y",
        url: "https://example.com/added",
        label: null,
      },
    ],
    deleted: [
      {
        id: "removed",
        artist_id: "x",
        url: "https://example.com/removed",
        label: "Remove",
      },
    ],
  });
});
