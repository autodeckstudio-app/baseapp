// Brand product page: same layout family as the service page. Sourced facts only; price is "ask the studio".
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { BRANDS } from "../../../lib/brands";
import { serviceImagery } from "../../../lib/imagery";
import { Chip, HeroImage, Kicker, Pane, Row, Screen, T } from "../../../ui/kit";

export default function BrandProduct() {
  const { b, n } = useLocalSearchParams<{ b?: string; n?: string }>();
  const brand = BRANDS.find((x) => x.name === b);
  const item = brand?.items.find((x) => x.name === n);
  if (!brand || !item) return <Screen><T role="title">Product not found</T></Screen>;
  const img = item.kind === "PPF" ? serviceImagery.ppf : serviceImagery.ceramic;
  return (
    <Screen
      header={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">{item.kind === "PPF" ? "Paint protection film" : item.kind === "Coating" ? "Coating" : "Range"}</Kicker>
          <T role="title">{item.name}</T>
          <T role="caption" tone="secondary">{brand.name}</T>
        </View>
      }
    >
      <HeroImage source={img} aspect={16 / 9} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
        {item.warranty ? <Chip label={item.warranty.split(" (")[0] ?? item.warranty} tone="premium" /> : null}
        <Chip label={brand.name} tone="neutral" />
      </View>
      <Pane pad="gap">
        {item.note ? <Row title="About" detail={<T role="caption" tone="secondary">{item.note}</T>} /> : null}
        {item.warranty ? <Row title="Warranty" detail={<T role="caption" tone="secondary">{item.warranty}. As stated by the brand.</T>} /> : <Row title="Warranty" detail={<T role="caption" tone="secondary">Not listed. Ask the studio.</T>} />}
        <Row title="Price" detail={<T role="caption" tone="secondary">Ask the studio</T>} last />
      </Pane>
    </Screen>
  );
}
