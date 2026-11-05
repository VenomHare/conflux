import { z } from "zod";

const anchorSchema = z.record(z.string(), z.json());

export const createCommentSchema = z
  .object({
    content: z.string().trim().min(1).max(10_000),
    anchor: anchorSchema,
    parent_id: z.uuid().nullable().optional(),
  })
  .strict();

export const updateCommentSchema = z
  .object({
    content: z.string().trim().min(1).max(10_000).optional(),
    anchor: anchorSchema.optional(),
  })
  .strict()
  .refine((comment) => comment.content !== undefined || comment.anchor !== undefined, {
    message: "Provide comment content or an anchor to update",
  });
