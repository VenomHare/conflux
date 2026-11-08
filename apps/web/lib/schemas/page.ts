import { z } from "zod";

export const createPageSchema = z
  .object({ title: z.string().trim().max(200) })
  .strict();
export const updatePageSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    content: z.string().max(900_000).optional(),
  })
  .refine((page) => page.title !== undefined || page.content !== undefined)
  .strict();
