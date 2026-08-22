// Phase 5B P1-15: application-side prerequisite for Firebase Auth's
// built-in (phone/SMS-based) multi-factor authentication. This is NOT a
// custom MFA system — it's the minimum glue code required for
// signInWithEmailAndPassword's documented MFA challenge to be handled at
// all. Without it, enrolling any admin account in MFA (via the Admin SDK —
// see the deployment notes in the Phase 5B P1-15 report) would permanently
// lock that account out at sign-in, since the SDK throws
// "auth/multi-factor-auth-required" and expects the caller to resolve it.
//
// Enrollment itself has no UI in this app: Firebase's Admin SDK supports
// enrolling a phone factor directly via `adminAuth.updateUser(uid, {
// multiFactor: { enrolledFactors: [...] } })`, so a one-time, owner-run
// script is sufficient — see the P1-15 report for the exact call. This
// keeps scope to what's actually required for MFA to function, per the
// explicit instruction not to block the migration on account-console/
// enrollment-UI work.
import { FirebaseError } from "firebase/app";
import {
  PhoneMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
  type PhoneMultiFactorInfo,
} from "firebase/auth";

export function isMultiFactorRequiredError(error: unknown): error is MultiFactorError {
  return error instanceof FirebaseError && error.code === "auth/multi-factor-auth-required";
}

// Only the phone second factor is supported (Firebase Auth's other
// first-party factor, TOTP, requires an Identity Platform upgrade this
// project is not on — see the P1-15 report). Returns null if the account's
// enrolled factor isn't phone-based, so the caller can surface a clear
// "unsupported factor" error instead of silently mishandling it.
export function pickPhoneHint(resolver: MultiFactorResolver): PhoneMultiFactorInfo | null {
  const hint = resolver.hints.find((h) => h.factorId === PhoneMultiFactorGenerator.FACTOR_ID);
  return (hint as PhoneMultiFactorInfo | undefined) ?? null;
}
