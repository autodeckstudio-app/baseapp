import { View } from "react-native";
import { T } from "./kit";
/** Presentation only: keep the complete original provenance/warranty wording.
 * Separate its authored facts rather than compressing them into a paragraph. */
export function RecordDetails({ text }: { text: string }) {
  const facts = text.split(" · ").filter(Boolean);
  return facts.length ? (
    <View style={{ gap: 6, paddingTop: 5 }}>
      {facts.map((fact, i) => (
        <T
          key={`${i}-${fact}`}
          role="caption"
          tone={i === 0 ? "secondary" : "tertiary"}
          style={{ lineHeight: 18 }}
        >
          {fact}
        </T>
      ))}
    </View>
  ) : null;
}
