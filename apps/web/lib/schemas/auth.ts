import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: "Enter a valid email address" }));

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72, {
    message: "Password must be at most 72 UTF-8 bytes",
  });

export const registerSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).refine((password) => Buffer.byteLength(password, "utf8") <= 72),
  })
  .strict();

const avatarUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Avatar URL must use HTTP or HTTPS")
  .nullable();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    avatar_url: avatarUrlSchema.optional(),
  })
  .strict()
  .refine((profile) => profile.name !== undefined || profile.avatar_url !== undefined, {
    message: "Provide at least one profile field to update",
  });
