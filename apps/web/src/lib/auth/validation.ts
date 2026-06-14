import { z } from "zod";

export const INSTITUTIONAL_EMAIL_DOMAIN = "stu.untar.ac.id";
export const DEFAULT_AUTH_REDIRECT = "/me/profile";

const PROGRAMS = {
  "535": {
    programStudyCode: "TI",
    programStudyName: "Teknik Informatika",
  },
  "825": {
    programStudyCode: "SI",
    programStudyName: "Sistem Informasi",
  },
} as const;

const allowedCohorts = ["24", "25"] as const;

type ProgramPrefix = keyof typeof PROGRAMS;
type CohortCode = (typeof allowedCohorts)[number];

export type InstitutionalIdentity = {
  fullName: string;
  firstName: string;
  nim: string;
  prefix: ProgramPrefix;
  programStudyCode: "TI" | "SI";
  programStudyName: string;
  cohortCode: CohortCode;
  cohortYear: 2024 | 2025;
  sequence: string;
  email: string;
};

export type ParsedNim = Omit<
  InstitutionalIdentity,
  "fullName" | "firstName" | "email"
>;

function fail(message: string): never {
  throw new Error(message);
}

export function normalizeFullName(value: string): string {
  const fullName = z.string().trim().min(1, "Nama lengkap wajib diisi.").parse(value);

  return fullName.replace(/\s+/g, " ");
}

export function normalizeFirstName(fullName: string): string {
  const firstToken = normalizeFullName(fullName).split(/\s+/)[0]?.toLowerCase() ?? "";
  const normalized = firstToken.replace(/[^a-z]/g, "");

  if (!normalized) {
    fail("Nama depan harus mengandung huruf a-z.");
  }

  return normalized;
}

export function parseNim(value: string): ParsedNim {
  const nim = z.string().trim().regex(/^\d+$/, "NIM hanya boleh berisi angka.").parse(value);

  if (nim.length !== 9) {
    fail("NIM harus terdiri dari 9 digit.");
  }

  const prefix = nim.slice(0, 3);
  if (!(prefix in PROGRAMS)) {
    fail("Prefix NIM tidak didukung.");
  }

  const cohortCode = nim.slice(3, 5);
  if (!allowedCohorts.includes(cohortCode as CohortCode)) {
    fail("Angkatan NIM harus 24 atau 25.");
  }

  const sequence = nim.slice(5);
  if (!/^\d{4}$/.test(sequence)) {
    fail("NIM harus memiliki empat digit urutan.");
  }

  const program = PROGRAMS[prefix as ProgramPrefix];

  return {
    nim,
    prefix: prefix as ProgramPrefix,
    programStudyCode: program.programStudyCode,
    programStudyName: program.programStudyName,
    cohortCode: cohortCode as CohortCode,
    cohortYear: cohortCode === "24" ? 2024 : 2025,
    sequence,
  };
}

export function buildInstitutionalEmail(fullName: string, nimValue: string): string {
  const firstName = normalizeFirstName(fullName);
  const parsedNim = parseNim(nimValue);

  return `${firstName}.${parsedNim.nim}@${INSTITUTIONAL_EMAIL_DOMAIN}`;
}

function normalizeInstitutionalEmail(value: string): string {
  const email = z.string().trim().min(1, "Email wajib diisi.").parse(value);

  if (email !== value) {
    fail("Email tidak boleh memiliki spasi di awal atau akhir.");
  }

  return email.toLowerCase();
}

export function validateInstitutionalIdentity(input: {
  fullName: string;
  nim: string;
  email: string;
  password?: string;
  passwordConfirmation?: string;
}): InstitutionalIdentity {
  const fullName = normalizeFullName(input.fullName);
  const firstName = normalizeFirstName(fullName);
  const parsedNim = parseNim(input.nim);
  const email = normalizeInstitutionalEmail(input.email);
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain || email.split("@").length !== 2) {
    fail("Format email institusional tidak valid.");
  }

  if (domain !== INSTITUTIONAL_EMAIL_DOMAIN) {
    fail("Email harus menggunakan domain stu.untar.ac.id.");
  }

  const localTokens = localPart.split(".");
  if (localTokens.length !== 2 || !localTokens[0] || !localTokens[1]) {
    fail("Format email harus nama.NIM@stu.untar.ac.id.");
  }

  if (localTokens[0] !== firstName) {
    fail("Nama depan pada email tidak sesuai nama lengkap.");
  }

  if (localTokens[1] !== parsedNim.nim) {
    fail("NIM pada email tidak sesuai field NIM.");
  }

  if (input.password !== undefined || input.passwordConfirmation !== undefined) {
    const password = z.string().min(8, "Password minimal 8 karakter.").parse(input.password);
    const passwordConfirmation = z.string().parse(input.passwordConfirmation);

    if (password !== passwordConfirmation) {
      fail("Konfirmasi password tidak sama.");
    }
  }

  return {
    fullName,
    firstName,
    email,
    ...parsedNim,
  };
}

export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value) {
    return DEFAULT_AUTH_REDIRECT;
  }

  const nextPath = value.trim();
  if (
    !nextPath ||
    nextPath !== value ||
    /[\u0000-\u001f\u007f]/.test(nextPath) ||
    nextPath.includes("\\") ||
    nextPath.startsWith("//") ||
    !nextPath.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(nextPath)
  ) {
    return DEFAULT_AUTH_REDIRECT;
  }

  try {
    const url = new URL(nextPath, "https://lnfti.local");

    if (url.origin !== "https://lnfti.local") {
      return DEFAULT_AUTH_REDIRECT;
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
}
