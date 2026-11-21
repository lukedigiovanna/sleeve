import { z } from "zod";
import { vinylStatuses } from "./vinylStatus.ts";
import { instrumentCategories } from "./instruments.ts";
import type { Album, Artist, Genre, Instrument } from "../types/albums";
import type { LibrarySnapshot } from "./libraryCache";

// These schemas mirror each storage version's existing acceptance rules, not
// the stricter draft contract. Preserve unknown fields for legacy upgrades.
const optionalStringSchema = z.string().nullish();
const namedSchema = z.looseObject({ id: z.string(), name: z.string() });
const namedRowsSchema = z.array(namedSchema);
const artistCatalogSchema = namedSchema.extend({
  links: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        label: z.string().nullable(),
      }),
    )
    .optional(),
  updatedAt: z.string().optional(),
});
const demoAlbumSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sortTitle: optionalStringSchema,
  artworkUrl: optionalStringSchema,
  sourceId: optionalStringSchema,
  recordLabel: optionalStringSchema,
  vinylStatus: z.enum(vinylStatuses).nullish(),
  musicbrainzReleaseGroupId: optionalStringSchema,
  releaseYear: z.number().refine(Number.isInteger).nullable(),
  artists: z.array(z.looseObject({ name: z.string() })),
  genres: z.array(z.looseObject({ name: z.string() })),
  instruments: z.array(
    namedSchema.extend({
      notes: optionalStringSchema,
      categories: z.array(z.string()),
    }),
  ),
  links: z.array(
    z.looseObject({ url: z.string(), label: optionalStringSchema }),
  ),
  listeningEntries: z.array(
    z.looseObject({
      listenedAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}/)
        .refine((value) => Number.isFinite(Date.parse(value))),
      rating: z.number().refine(Number.isInteger).min(1).max(10).nullable(),
      notes: optionalStringSchema,
    }),
  ),
});
const demoAlbumsSchema = z.array(demoAlbumSchema);
const demoInstrumentCatalogSchema = z.looseObject({
  instruments: z.array(
    namedSchema.extend({ categories: z.array(z.enum(instrumentCategories)) }),
  ),
});
const demoArtistCatalogSchema = z.looseObject({
  artists: z.array(
    artistCatalogSchema.extend({
      sortName: optionalStringSchema,
      country: optionalStringSchema,
      musicbrainzId: optionalStringSchema,
    }),
  ),
});
const demoGenreCatalogSchema = z.looseObject({
  genres: z.array(
    namedSchema.extend({
      parentGenreId: optionalStringSchema,
      parentGenreIds: z.array(z.string()).optional(),
    }),
  ),
});
const librarySnapshotSchema = z.looseObject({
  version: z.literal(1),
  accountId: z.string(),
  syncedAt: z.number(),
  data: z.looseObject({
    artists: z.array(artistCatalogSchema),
    genres: namedRowsSchema,
    instruments: z.array(
      namedSchema.extend({ categories: z.array(z.unknown()) }),
    ),
    albums: z.array(
      z.looseObject({
        id: z.string(),
        title: z.string(),
        vinylStatus: z.enum(vinylStatuses).nullish(),
        createdAt: z.string(),
        updatedAt: z.string(),
        artists: namedRowsSchema,
        genres: namedRowsSchema,
        instruments: namedRowsSchema,
        links: z.array(z.unknown()),
        listeningEntries: z.array(z.unknown()),
      }),
    ),
  }),
});

// Compatibility guards intentionally retain the original object and the legacy
// domain narrowing. Tightening missing nested fields is a storage-version change,
// not part of replacing handwritten checks with schemas.
export function isDemoAlbums(value: unknown): value is Album[] {
  return demoAlbumsSchema.safeParse(value).success;
}

export function isDemoInstrumentCatalog(
  value: unknown,
): value is { instruments: Instrument[] } {
  return demoInstrumentCatalogSchema.safeParse(value).success;
}

export function isDemoArtistCatalog(
  value: unknown,
): value is { artists: Artist[] } {
  return demoArtistCatalogSchema.safeParse(value).success;
}

export function isDemoGenreCatalog(
  value: unknown,
): value is { genres: Genre[] } {
  return demoGenreCatalogSchema.safeParse(value).success;
}

export function isLibrarySnapshot(value: unknown): value is LibrarySnapshot {
  return librarySnapshotSchema.safeParse(value).success;
}

export const routeHistorySchema = z.looseObject({
  session: z.string(),
  entries: z.array(
    z.looseObject({ hash: z.string(), scroll: z.number().min(0) }),
  ),
});

export const routeMarkerSchema = z.looseObject({
  session: z.string(),
  index: z.number().refine(Number.isInteger),
});
