import { z } from "zod";

export const createPageSchema = z.object({ title: z.string().trim().min(1).max(200) }).strict();
export const updatePageSchema = z
  .object({ title: z.string().trim().min(1).max(200) })
  .strict();
