import { upgradeGenre } from "./genres.ts";
import { z } from "zod";
import { vinylStatuses } from "./vinylStatus.ts";
import type { Draft, DraftTarget } from "./editorDrafts";
import { albumEditorModeSchema } from "./editorContracts.ts";
import { instrumentCategories } from "./instruments.ts";

// Persisted drafts allow incomplete edits. Keep submission requirements (such as
// nonempty titles) separate, and retain unknown fields from version-one drafts.
const linkSchema = z.looseObject({
  id: z.string(),
  url: z.string(),
  label: z.string().nullable(),
});
const artistSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  sortName: z.string().nullable(),
  country: z.string().nullable(),
  musicbrainzId: z.string().nullable(),
  photoUrl: z.string().nullish(),
  links: z.array(linkSchema).optional(),
  updatedAt: z.string().optional(),
});
const storedGenreSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  parentGenreIds: z.array(z.string()).optional(),
  parentGenreId: z.string().nullish(),
});
const genreSchema = storedGenreSchema.transform(upgradeGenre);
const instrumentSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  imageUrl: z.string().nullish(),
  categories: z.array(z.enum(instrumentCategories)),
});
const artistCreditSchema = artistSchema.extend({
  role: z.enum(["primary", "featured", "other"]),
  position: z.number().int(),
});
const albumGenreSchema = storedGenreSchema
  .extend({ isPrimary: z.boolean() })
  .transform((genre) => ({
    ...upgradeGenre(genre),
    isPrimary: genre.isPrimary,
  }));
const albumInstrumentSchema = instrumentSchema.extend({
  notes: z.string().nullable(),
});
const listeningEntrySchema = z.looseObject({
  id: z.string(),
  rating: z.number().int().min(1).max(10).nullable(),
  listenedAt: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const suggestionSchema = z.looseObject({ id: z.string(), name: z.string() });
const albumSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  sortTitle: z.string().nullable(),
  releaseYear: z.number().int().nullable(),
  artworkUrl: z.string().nullable(),
  musicbrainzReleaseGroupId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sourceId: z.string().optional(),
  recordLabel: z.string().optional(),
  vinylStatus: z.enum(vinylStatuses).nullish(),
  genreSuggestions: z.array(suggestionSchema).optional(),
  instrumentSuggestions: z.array(suggestionSchema).optional(),
  artists: z.array(artistCreditSchema),
  genres: z.array(albumGenreSchema),
  instruments: z.array(albumInstrumentSchema),
  links: z.array(linkSchema),
  listeningEntries: z.array(listeningEntrySchema),
});
const draftTargetSchema = z.discriminatedUnion("kind", [
  z.looseObject({
    kind: z.literal("album"),
    item: albumSchema.partial().optional(),
    mode: albumEditorModeSchema.optional(),
  }),
  z.looseObject({ kind: z.literal("artist"), item: artistSchema.optional() }),
  z.looseObject({ kind: z.literal("genre"), item: genreSchema.optional() }),
  z.looseObject({
    kind: z.literal("instrument"),
    item: instrumentSchema.optional(),
  }),
  z.looseObject({ kind: z.literal("instruments"), item: albumSchema }),
  z.looseObject({
    kind: z.literal("listen"),
    item: albumSchema,
    entry: listeningEntrySchema.optional(),
  }),
]) satisfies z.ZodType<DraftTarget>;

export const draftSchema = z.looseObject({
  version: z.literal(1),
  target: draftTargetSchema,
  hash: z.string().refine((value) => value === "" || value.startsWith("#")),
  open: z.boolean(),
  baseline: z.string(),
  source: z.string(),
  fields: z.array(
    z.looseObject({
      name: z.string(),
      id: z.string(),
      value: z.string(),
      checked: z.boolean(),
    }),
  ),
  links: z.number().int().min(0).max(1000),
  artists: z.array(artistCreditSchema),
  genres: z.array(albumGenreSchema),
  instruments: z.array(albumInstrumentSchema),
  artistChoices: z.array(artistSchema),
  genreChoices: z.array(genreSchema),
  instrumentChoices: z.array(albumInstrumentSchema),
}) satisfies z.ZodType<Draft>;
