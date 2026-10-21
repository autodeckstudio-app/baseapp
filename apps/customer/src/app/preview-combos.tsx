// Dev-only: the REAL Combos block fed with the live-read package services.
import { Screen } from "../ui/kit";
import { CombosSection } from "../ui/CombosSection";
import { LIVE_PACKAGE_SAMPLE } from "../lib/live-packages-sample";

export default function PreviewCombos() {
  if (!__DEV__) return null;
  return <Screen><CombosSection catalogue={LIVE_PACKAGE_SAMPLE} onBook={() => undefined} /></Screen>;
}
