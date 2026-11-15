import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { Button, Pane, T } from "./kit";
import { getReview, submitReview } from "../lib/review-service";
import { GOOGLE_REVIEW_URL } from "../lib/studio-info";

/** One-tap rating on Home for a week after a visit. After rating, everyone is offered the Google review (no gating by score). */
export function RateCard({ bookingId, serviceName, onDone }: { bookingId: string; serviceName: string; onDone?: () => void }) {
  const { colors } = useExperienceTheme();
  const [state, setState] = useState<"loading" | "ask" | "done" | "hidden">("loading");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    void getReview(bookingId).then((r) => { if (alive) setState(r ? "hidden" : "ask"); }).catch(() => { if (alive) setState("hidden"); });
    return () => { alive = false; };
  }, [bookingId]);
  if (state === "loading" || state === "hidden") return null;
  const rate = (n: number) => {
    if (busy) return;
    setBusy(true);
    setErr(false);
    void submitReview(bookingId, n, "").then(() => { setState("done"); onDone?.(); }).catch(() => setErr(true)).finally(() => setBusy(false));
  };
  return (
    <Pane pad="inset">
      <View style={{ gap: 10 }}>
        {state === "ask" ? (
          <>
            <T role="heading">How was your {serviceName}?</T>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`} disabled={busy} onPress={() => rate(n)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="star" color={colors.textTertiary} size={32} />
                </Pressable>
              ))}
            </View>
            {err ? <T role="caption" tone="accent">Could not send that. Try again.</T> : null}
          </>
        ) : (
          <>
            <T role="heading">Thanks for rating</T>
            {GOOGLE_REVIEW_URL ? <Button kind="quiet" label="Review us on Google" onPress={() => void Linking.openURL(GOOGLE_REVIEW_URL)} /> : null}
          </>
        )}
      </View>
    </Pane>
  );
}
