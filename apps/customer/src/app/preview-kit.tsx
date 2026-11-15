// Dev-only: shared building blocks used by booking, tracker, invoices, approvals, membership, cars and notifications.
import { View, Pressable } from "react-native";
import { Button, Chip, Kicker, Notice, Pane, Row, Screen, T } from "../ui/kit";

const noop = () => undefined;
export default function PreviewKit() {
  if (!__DEV__) return null;
  return (
    <Screen>
      <T role="heading">Book a service</T>
      <Kicker>Pick a time</Kicker>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {["10:00", "11:30", "14:00"].map((t, i) => (
          <Pressable key={t} style={{ borderRadius: 9999, borderWidth: 1, borderColor: i === 1 ? "#EC8638" : "rgba(128,128,128,0.28)", backgroundColor: i === 1 ? "rgba(236,134,56,0.14)" : "rgba(128,128,128,0.08)", paddingHorizontal: 16, paddingVertical: 10 }}>
            <T role="data" tone={i === 1 ? "accent" : "primary"}>{t}</T>
          </Pressable>
        ))}
      </View>
      <Pane>
        <T role="bodyStrong">Full body PPF</T>
        <T tone="secondary">BMW M340i, 14 Oct, 10:00</T>
        <View style={{ flexDirection: "row", gap: 8 }}><Chip label="Confirmed" tone="accent" /><Chip label="Paid" /><Chip label="Needs approval" tone="danger" /></View>
      </Pane>
      <Pane>
        <Row title="Invoice AD-0042" detail="Rs 1,20,000" onPress={noop} />
        <Row title="Approval request" detail="Extra film on bonnet" onPress={noop} />
        <Row title="Membership" detail="6 washes left" onPress={noop} />
      </Pane>
      <Notice title="Visit update" body="Your car is in the paint bay." />
      <Button label="Confirm booking" onPress={noop} />
      <Button kind="quiet" label="Reschedule" onPress={noop} />
    </Screen>
  );
}
