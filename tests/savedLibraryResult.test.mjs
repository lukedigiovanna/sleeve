import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileLibraryTimestamps } from "../src/services/savedLibraryResult.ts";

const library = () => ({
  artists: [{ id: "artist", updatedAt: "old" }],
  albums: [
    {
      id: "a",
      createdAt: "old",
      updatedAt: "old",
      listeningEntries: [
        { id: "listen", createdAt: "old", updatedAt: "old", listenedAt: "old" },
        {
          id: "unchanged",
          createdAt: "old",
          updatedAt: "old",
          listenedAt: "old",
        },
      ],
    },
  ],
});

test("timestamp reconciliation uses the final returned album row and leaves unsaved entries alone", () => {
  const next = library();
  reconcileLibraryTimestamps(next, {
    albums: [
      { id: "a", created_at: "created", updated_at: "initial" },
      {
        id: "a",
        created_at: "created",
        updated_at: "touched",
        title: "extra field",
      },
      { id: "other", created_at: "other", updated_at: "other" },
    ],
    listening_entries: [
      {
        id: "listen",
        created_at: "created",
        updated_at: "updated",
        listened_at: "normalized",
      },
    ],
    artists: [
      {
        id: "artist",
        created_at: "2026-11-20T12:00:00+00:00",
        updated_at: "2026-11-22T12:00:00+00:00",
      },
    ],
  });
  assert.equal(next.albums[0].updatedAt, "touched");
  assert.equal(next.artists[0].createdAt, "2026-11-20T12:00:00.000Z");
  assert.equal(next.artists[0].updatedAt, "2026-11-22T12:00:00.000Z");
  assert.deepEqual(next.albums[0].listeningEntries[0], {
    id: "listen",
    createdAt: "created",
    updatedAt: "updated",
    listenedAt: "normalized",
  });
  assert.equal(next.albums[0].listeningEntries[1].listenedAt, "old");
  const before = structuredClone(next);
  reconcileLibraryTimestamps(next, {});
  assert.deepEqual(next, before);
});

test("malformed RPC projections fail before any local timestamps change", () => {
  for (const invalid of [
    null,
    [],
    { albums: null },
    {
      albums: [{ id: "a", created_at: "created", updated_at: "updated" }],
      listening_entries: [
        {
          id: "listen",
          created_at: "created",
          updated_at: 42,
          listened_at: "date",
        },
      ],
    },
  ]) {
    const next = library();
    const before = structuredClone(next);
    assert.throws(
      () => reconcileLibraryTimestamps(next, invalid),
      /saved library response is invalid/,
    );
    assert.deepEqual(next, before);
  }
});
