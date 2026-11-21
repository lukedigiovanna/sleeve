import { z } from "zod";
import { today } from "./date.ts";
import { webUrl } from "../components/presentation.ts";

// Form readers trim before parsing. Keep empty-string/null conversion at each
// submission boundary and leave library-dependent validation with the feature.
export const requiredNameSchema = z.string().min(1);
export const httpUrlSchema = z
  .string()
  .refine((value) => webUrl(value) !== null);
export const optionalHttpUrlSchema = z.union([z.literal(""), httpUrlSchema]);
export const albumSubmissionSchema = z.object({
  title: requiredNameSchema,
  artwork: optionalHttpUrlSchema,
  // Native number constraints handle range/step feedback before submission.
  year: z.string().transform((value) => Number(value) || null),
  label: z.string(),
});
export const musicLinkSubmissionSchema = z.object({
  url: httpUrlSchema,
  label: z.string(),
});
export const listeningSubmissionSchema = z.object({
  // Native controls provide feedback before submit; these checks also protect
  // the mutation boundary if the handler is invoked programmatically.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (value) =>
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value &&
        value >= "1900-01-01" &&
        value <= today(),
    ),
  rating: z.number().int().min(1).max(10).nullable(),
  notes: z
    .string()
    .max(3000)
    .transform((value) => value.trim()),
});

// Import mappings historically discard individual invalid values, not the
// whole object. Parse the container first and keep that filtering behavior.
export const importMappingsSchema = z
  .record(z.string(), z.unknown())
  .transform((values) =>
    Object.fromEntries(
      Object.entries(values).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  );
