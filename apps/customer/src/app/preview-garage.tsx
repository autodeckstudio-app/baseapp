// Dev-only mock of the garage list.
import { Text, View } from "react-native";
import { Screen } from "../ui/kit";
import { GarageCard } from "../ui/GarageCard";
import { CarThumb } from "../ui/CarThumb";

const noop = () => undefined;
export default function PreviewGarage() {
  if (!__DEV__) return null;
  return (
    <Screen header={<Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "700" }}>Your cars</Text>}>
      <View style={{ gap: 14 }}>
        <GarageCard photo={<CarThumb car={undefined} height={230} radius={0} />} height={230} kicker="Most recent" title="BMW M340i" lead plate="MH 02 AB 1234" chips={["2022", "Grey", "Sedan"]} onPress={noop} onRemove={noop} />
        <GarageCard photo={<CarThumb car={undefined} height={170} radius={0} />} height={170} title="Mahindra Thar" lead={false} plate="MH 02 CD 4321" chips={["2021", "Black", "SUV"]} onPress={noop} onRemove={noop} />
      </View>
    </Screen>
  );
}
