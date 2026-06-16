import "server-only";

import type { NextRequest } from "next/server";

import {
  REPORT_IMAGE_ALLOWED_MIME_TYPES,
  REPORT_IMAGE_MAX_BYTES,
} from "@/lib/reports/constants";
import { createClient } from "@/lib/supabase/server";

export class AiProxyRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function isAllowedMimeType(value: string): value is (typeof REPORT_IMAGE_ALLOWED_MIME_TYPES)[number] {
  return REPORT_IMAGE_ALLOWED_MIME_TYPES.includes(value as (typeof REPORT_IMAGE_ALLOWED_MIME_TYPES)[number]);
}

export async function requireVerifiedStudent(): Promise<void> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;

  if (userError || !user || !user.email_confirmed_at) {
    throw new AiProxyRequestError(401, "UNAUTHORIZED", "Permintaan tidak diizinkan.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, verification_status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError
    || !profile
    || profile.role !== "student"
    || profile.verification_status !== "VERIFIED"
  ) {
    throw new AiProxyRequestError(403, "FORBIDDEN", "Permintaan tidak diizinkan.");
  }
}

export async function readValidatedImage(request: NextRequest): Promise<{
  bytes: ArrayBuffer;
  mimeType: string;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new AiProxyRequestError(400, "INVALID_MULTIPART", "Permintaan gambar tidak valid.");
  }

  const rawContentLength = request.headers.get("content-length");
  if (rawContentLength && !/^\d+$/.test(rawContentLength)) {
    throw new AiProxyRequestError(400, "INVALID_MULTIPART", "Permintaan gambar tidak valid.");
  }

  const contentLength = rawContentLength ? Number(rawContentLength) : null;
  if (contentLength !== null && contentLength > REPORT_IMAGE_MAX_BYTES + 1_048_576) {
    throw new AiProxyRequestError(413, "IMAGE_TOO_LARGE", "Ukuran gambar maksimal 5 MiB.");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new AiProxyRequestError(400, "INVALID_MULTIPART", "Permintaan gambar tidak valid.");
  }

  const entries = Array.from(formData.entries());
  if (entries.some(([key]) => key !== "file") || formData.getAll("file").length !== 1) {
    throw new AiProxyRequestError(400, "INVALID_MULTIPART", "Permintaan hanya boleh berisi satu file.");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new AiProxyRequestError(400, "INVALID_FILE", "File gambar wajib dikirim.");
  }
  if (file.size <= 0) {
    throw new AiProxyRequestError(400, "EMPTY_FILE", "File gambar kosong.");
  }
  if (file.size > REPORT_IMAGE_MAX_BYTES) {
    throw new AiProxyRequestError(413, "IMAGE_TOO_LARGE", "Ukuran gambar maksimal 5 MiB.");
  }
  if (!isAllowedMimeType(file.type)) {
    throw new AiProxyRequestError(415, "UNSUPPORTED_MEDIA_TYPE", "Format gambar harus JPEG, PNG, atau WebP.");
  }

  return {
    bytes: await file.arrayBuffer(),
    mimeType: file.type,
  };
}
