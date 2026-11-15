// Dev-only: the REAL Help screen (?q=cancel to prefill the search).
import HelpScreen from "./(tabs)/help";

export default function PreviewHelp() {
  if (!__DEV__) return null;
  return <HelpScreen />;
}
