"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth, MFA_RECAPTCHA_CONTAINER_ID } from "../../lib/auth-context";
import { homeFor } from "../../lib/staff-access";
import { colors, spacing, radius } from "@autodeck/ui/tokens";

// Google-only sign-in. The studio owner's account opens the full app; Gmail
// addresses on the staff roster open the Studio floor; anyone else is told
// to ask the owner to add them. Visual theme lands with the experience
// migration (docs/22-experience-migration-spec.md); this page carries the
// flow.
export default function LoginPage() {
  const { user, claims, loading, signIn, confirmMfaCode, mfaRequired, error } = useAdminAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && claims) router.replace(homeFor(claims.role));
  }, [loading, user, claims, router]);

  async function handleGoogle() {
    setSubmitting(true);
    setLocalError(null);
    try {
      await signIn();
      // "signed-in" is handled by the effect above; "mfa" shows the code
      // form; "redirect" leaves the page.
    } catch {
      // auth-context sets the precise message (or none for a closed popup)
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmCode(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    try {
      await confirmMfaCode(code);
    } catch {
      setLocalError("Verification failed. Check the code and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const message = localError ?? error;

  return (
    <main
      style={{
        maxWidth: 380,
        margin: "96px auto",
        padding: spacing.xl,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
      }}
    >
      <h1 style={{ marginBottom: spacing.xs }}>AutoDeck</h1>
      {mfaRequired ? (
        <>
          <p style={{ marginTop: 0, marginBottom: spacing.xl }}>Enter the verification code sent to your phone.</p>
          <form onSubmit={handleConfirmCode}>
            <fieldset>
              <label htmlFor="code">Verification code</label>
              <br />
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{ width: "100%" }}
              />
            </fieldset>
            {message && <p className="error">{message}</p>}
            <button type="submit" disabled={submitting} style={{ width: "100%" }}>
              {submitting ? "Verifying…" : "Verify"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p style={{ marginTop: 0, marginBottom: spacing.xl }}>
            Studio and office sign-in. Use the Google account your studio added you with.
          </p>
          <button
            type="button"
            onClick={() => void handleGoogle()}
            disabled={submitting || loading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
            }}
          >
            <GoogleMark />
            {submitting ? "Opening Google…" : "Continue with Google"}
          </button>
          {message && (
            <p className="error" role="alert" style={{ marginTop: spacing.md }}>
              {message}
            </p>
          )}
        </>
      )}
      {/* Invisible reCAPTCHA host for an MFA phone challenge on accounts
          that enrolled one. Never visibly rendered. */}
      <div id={MFA_RECAPTCHA_CONTAINER_ID} />
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
