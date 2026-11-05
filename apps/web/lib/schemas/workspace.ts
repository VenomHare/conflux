import { z } from "zod";

export const createWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()
  .refine((workspace) => workspace.name !== undefined || workspace.description !== undefined, {
    message: "Provide at least one workspace field to update",
  });

export const uuidSchema = z.uuid();
