export const VERIFIED_PROFILE_STATUS = "verified";

export type StudentProfileVerificationInput = {
  role: string | null;
  verification_status: string | null;
};

export function normalizeProfileVerificationStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() ?? "";
}

export function isVerifiedProfileStatus(status: string | null | undefined) {
  return normalizeProfileVerificationStatus(status) === VERIFIED_PROFILE_STATUS;
}

export function isVerifiedStudentProfile(profile: StudentProfileVerificationInput | null | undefined) {
  return Boolean(profile?.role === "student" && isVerifiedProfileStatus(profile.verification_status));
}
