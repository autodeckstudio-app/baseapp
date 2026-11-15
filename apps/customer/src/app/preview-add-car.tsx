// Dev-only: the real Add car screen (self-declared protection section) without auth. No params needed.
import AddCarScreen from "./(tabs)/garage/add";

export default function PreviewAddCar() {
  if (!__DEV__) return null;
  return <AddCarScreen />;
}
