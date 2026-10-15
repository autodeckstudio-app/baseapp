"use client";

import { useEffect, useState } from "react";
import { enablePush, pushState, syncPushRegistration } from "../lib/push";

/** One small button to turn on chat alerts on this device. Hidden when unavailable or already on. */
export function PushAlertsButton() {
  const [state, setState] = useState<"on" | "prompt" | "denied" | "unavailable">("unavailable");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setState(pushState()); void syncPushRegistration(); }, []);
  if (state === "unavailable" || state === "on") return null;
  return (
    <button
      type="button"
      className="ax-corner-out"
      title={state === "denied" ? "Alerts are blocked in this browser's settings" : "Turn on alerts for customer messages"}
      aria-label="Turn on message alerts"
      disabled={busy || state === "denied"}
      onClick={() => { setBusy(true); void enablePush().then(setState).catch(() => undefined).finally(() => setBusy(false)); }}
    >
      <span className="ax-corner-out-t">Alerts</span>
    </button>
  );
}
