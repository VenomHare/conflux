import { z } from "zod";

export const createPageSchema = z
  .object({ title: z.string().trim().min(1).max(200) })
  .strict();
export const updatePageSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().max(900_000).optional(),
    auto_snapshots_enabled: z.boolean().optional(),
  })
  .refine((page) => page.title !== undefined || page.content !== undefined || page.auto_snapshots_enabled !== undefined)
  .strict();
