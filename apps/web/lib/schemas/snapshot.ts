import { z } from "zod";

export const createSnapshotSchema = z
  .object({
    label: z.string().trim().min(1).max(200).nullable().optional(),
    document_state: z
      .string()
      .max(4_000_000)
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
      .optional(),
  })
  .strict();
