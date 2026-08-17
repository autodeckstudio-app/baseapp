"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "../../lib/auth-context";
import { colors, spacing, radius } from "@autodeck/ui/tokens";

export default function LoginPage() {
  const { signIn, error } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch {
      setLocalError("Sign-in failed. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 360,
        margin: "96px auto",
        padding: spacing.xl,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
      }}
    >
      <h1 style={{ marginBottom: spacing.xs }}>AutoDeck Admin</h1>
      <p style={{ marginTop: 0, marginBottom: spacing.xl }}>Sign in to manage studio operations.</p>
      <form onSubmit={handleSubmit}>
        <fieldset>
          <label htmlFor="email">Email</label>
          <br />
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%" }}
          />
        </fieldset>
        <fieldset>
          <label htmlFor="password">Password</label>
          <br />
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%" }}
          />
        </fieldset>
        {(localError ?? error) && <p className="error">{localError ?? error}</p>}
        <button type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
