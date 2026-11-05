import { z } from "zod";

export const createInvitationSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    role: z.enum(["ADMIN", "EDITOR", "COMMENTER", "VIEWER"]),
  })
  .strict();

export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);
export const uuidSchema = z.uuid();
