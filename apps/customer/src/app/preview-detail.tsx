// Dev-only: the shared kit (Pane, Row, Chip, Button) on the new ground.
import { Screen, Pane, Row, Kicker, Chip, Button, T } from "../ui/kit";
import { View } from "react-native";

const noop = () => undefined;
export default function PreviewDetail() {
  if (!__DEV__) return null;
  return (
    <Screen>
      <T role="title">Booking detail</T>
      <Pane pad="inset"><View style={{ gap: 8 }}><Kicker tone="accent">Next visit</Kicker><Row title="Full body PPF" detail="14 Oct, 10:00" trailing={<Chip label="Confirmed" tone="premium" />} last /></View></Pane>
      <Pane pad="gap">
        <Row title="Membership" detail="Plans, washes left, history" onPress={noop} />
        <Row title="Notifications" detail="Updates from the studio" onPress={noop} last />
      </Pane>
      <Button label="Reschedule" onPress={noop} />
      <Button kind="quiet" label="Cancel booking" onPress={noop} />
    </Screen>
  );
}
