import { z } from "zod";

export const createSnapshotSchema = z.object({ label: z.string().trim().min(1).max(200).nullable().optional() }).strict();
