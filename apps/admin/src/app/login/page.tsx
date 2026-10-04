"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth, MFA_RECAPTCHA_CONTAINER_ID } from "../../lib/auth-context";
import { homeFor } from "../../lib/staff-access";
import { Ambient } from "../../experience/Ambient";
import "../../experience/shell.css";
import { AUTH, AUTH_FOOTNOTE, LOGO_STACKED_SVG, logoDataUri } from "@autodeck/ui/theme";

// Google-only sign-in. The studio owner's account opens the full app; Gmail
// addresses on the staff roster open the Studio floor; anyone else is told
// to ask the owner to add them. One glass pane on the studio ground.
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
    <div className="ax-shell">
      <Ambient>
        <main className="ax-login" style={{ background: AUTH.ground }}>
          <div style={{ width: "100%", maxWidth: AUTH.maxWidth, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: AUTH.cardPad, borderRadius: AUTH.cardRadius, background: AUTH.cardBg, border: `1px solid ${AUTH.cardBorder}`, boxShadow: AUTH.cardShadow, textAlign: "center" }}>
            <img src={logoDataUri(LOGO_STACKED_SVG)} alt="AutoDeck" style={{ display: "block", height: AUTH.logoHeight, width: "auto" }} />
            <span style={{ color: AUTH.accent, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Office and studio</span>
            <h1 style={{ margin: 0, color: AUTH.text, fontSize: 24, fontWeight: 500 }}>Sign in to AutoDeck Admin</h1>
            <p style={{ margin: 0, color: AUTH.muted, fontSize: 15, lineHeight: "22px" }}>
              {mfaRequired ? "Enter the verification code sent to your phone." : "Bookings, payments and the team, for the people who run the studio."}
            </p>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
            {mfaRequired ? (
              <form onSubmit={handleConfirmCode}>
                <label htmlFor="code" className="ax-label" style={{ display: "block", marginBottom: "var(--ad-space-breath)" }}>
                  Verification code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                {message && (
                  <p className="ax-alert" role="alert">
                    {message}
                  </p>
                )}
                <button
                  type="submit"
                  className="ax-button ax-button--primary"
                  disabled={submitting}
                  style={{ marginTop: "var(--ad-space-gap)" }}
                >
                  {submitting ? "Verifying…" : "Verify"}
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleGoogle()}
                  disabled={submitting || loading}
                  style={{ height: AUTH.buttonHeight, borderRadius: AUTH.buttonRadius, background: AUTH.accent, color: "#fff", border: 0, fontFamily: "inherit", fontSize: 16, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: submitting || loading ? 0.6 : 1 }}
                >
                  <GoogleMark />
                  {submitting ? "Opening Google…" : "Continue with Google"}
                </button>
                {message && (
                  <p className="ax-alert" role="alert">
                    {message}
                  </p>
                )}
              </>
            )}
            {/* Invisible reCAPTCHA host for an MFA phone challenge on accounts
                that enrolled one. Never visibly rendered. */}
            <div id={MFA_RECAPTCHA_CONTAINER_ID} />
            </div>
            <span style={{ color: AUTH.muted, fontSize: 12, opacity: 0.8 }}>{AUTH_FOOTNOTE}</span>
          </div>
        </main>
      </Ambient>
    </div>
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
