"use server";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { headers } from "next/headers";
import { getAuthenticatedUser } from "@/lib/auth";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function detectImage(bytes: Uint8Array) {
  const header = String.fromCharCode(...bytes.subarray(0, 12));

  if (header.startsWith("\x89PNG\r\n\x1a\n")) {
    return "image/png";
  }
  if (header.startsWith("\xff\xd8\xff")) {
    return "image/jpeg";
  }
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (
    header.slice(4, 8) === "ftyp" &&
    ["avif", "avis"].includes(header.slice(8, 12))
  ) {
    return "image/avif";
  }
  return null;
}

export async function uploadProfileImage(formData: FormData): Promise<{
  url?: string;
  error?: string;
}> {
  const requestHeaders = new Headers(await headers());
  const user = await getAuthenticatedUser(
    new Request("https://conflux.internal/profile-upload", {
      headers: requestHeaders,
    }),
  ).catch(() => null);
  if (!user) return { error: "Sign in again before uploading a profile photo." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Profile photos must be 5 MB or smaller." };
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_URL;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return { error: "Profile photo uploads are not configured yet." };
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const contentType = detectImage(data);
  if (!contentType) {
    return { error: "Use a PNG, JPEG, WebP, or AVIF image." };
  }

  const key = `avatars/${user.id}/profile`;
  try {
    const publicUrl = new URL(`${key.split("/").map(encodeURIComponent).join("/")}`, `${publicBaseUrl.replace(/\/+$/, "")}/`);
    if (publicUrl.protocol !== "https:") {
      return { error: "The profile photo public URL must use HTTPS." };
    }

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentLength: data.byteLength,
        ContentType: contentType,
        ContentDisposition: "inline",
        CacheControl: "public, max-age=300",
      }),
    );

    publicUrl.searchParams.set("v", Date.now().toString());
    return { url: publicUrl.toString() };
  } catch (error) {
    console.error("Profile photo upload failed", error);
    return { error: "The profile photo could not be uploaded. Please try again." };
  }
}
