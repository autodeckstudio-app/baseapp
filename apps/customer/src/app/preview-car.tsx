// Dev-only mock of the car detail head.
import { Image } from "react-native";
import { Screen, T } from "../ui/kit";
import { CarHero } from "../ui/CarHero";
import { vehicleImagery } from "../lib/imagery";

export default function PreviewCar() {
  if (!__DEV__) return null;
  return (
    <Screen>
      <T role="caption" tone="secondary">SAMPLE ONLY · preview candidate · not live. Photos are studio stock, not a customer car.</T>
      <CarHero photo={<Image source={vehicleImagery.sedan!} resizeMode="cover" style={{ width: "100%", height: 300 }} />} title="BMW M340i" subtitle={"2022 \u00b7 Grey"} plate="MH 02 AB 1234" facts={[{ label: "Type", value: "SEDAN" }, { label: "Protection", value: "2 on file" }]} onBook={() => undefined} />
    </Screen>
  );
}
