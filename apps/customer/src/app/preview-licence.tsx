// Dev-only: the REAL licence section with a mocked saved-photo state
// (?state=ready|missing). No session, no uploads, no real licence imagery.
import { useLocalSearchParams } from "expo-router";
import { Screen, T } from "../ui/kit";
import { LicenceSection } from "../ui/LicenceSection";
import { __setSavedLicensePreview } from "../ui/SavedLicensePhoto";

// Generic placeholder graphic, not a customer photo.
const SAMPLE_IMG = "data:image/svg+xml;base64," + (typeof btoa === "function" ? btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" rx="24" fill="#26262c"/><rect x="40" y="60" width="180" height="180" rx="16" fill="#3a3a42"/><rect x="260" y="80" width="320" height="22" rx="11" fill="#3a3a42"/><rect x="260" y="130" width="260" height="22" rx="11" fill="#3a3a42"/><rect x="260" y="180" width="300" height="22" rx="11" fill="#3a3a42"/><text x="40" y="330" fill="#8a8a93" font-family="sans-serif" font-size="26">SAMPLE LICENCE PHOTO</text></svg>`) : "");

export default function PreviewLicence() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  if (!__DEV__) return null;
  __setSavedLicensePreview(state === "missing" ? { url: null, state: "missing", retry: () => undefined } : { url: SAMPLE_IMG, state: "ready", retry: () => undefined });
  return (
    <Screen>
      <T role="caption" tone="secondary">SAMPLE ONLY · preview candidate · not live</T>
      <LicenceSection customerId="preview" scope="preview" upload={async () => undefined} />
    </Screen>
  );
}
