// Done-screen notice for membership purchase: pure composition of kit Notice + the
// money-outcome copy from native-pay-core. Money outcomes state the payment fact
// only; entitlement comes solely from the live membership listener.
import { View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { membershipOnlinePayCopy, type OnlinePayOutcome } from "../lib/native-pay-core";
import { Button, Notice, T } from "./kit";

export function MembershipDoneNotice({
  studio,
  payOutcome,
  activeTier,
  error,
  purchasing,
  onPayOnline,
  onViewStatus,
}: {
  studio: boolean;
  payOutcome: OnlinePayOutcome | null;
  activeTier: string | null;
  error: string | null;
  purchasing: boolean;
  onPayOnline: () => void;
  onViewStatus: () => void;
}) {
  const onlineCopy = membershipOnlinePayCopy(payOutcome, activeTier);
  const title = studio ? "Pay at the studio to activate" : onlineCopy.title;
  const body = studio
    ? "Request saved. Pay at the studio front desk - benefits unlock once payment is confirmed. Unpaid requests are cancelled automatically."
    : onlineCopy.body;
  return (
    <Notice
      title={title}
      body={body}
      action={
        <View style={{ gap: space.hair }}>
          {!studio && payOutcome !== "refunded" && payOutcome !== "partially_refunded" ? <Button label="Pay online" busy={purchasing} onPress={onPayOnline} /> : null}
          <Button label="View status" kind="quiet" onPress={onViewStatus} />
          {error ? <T role="caption" tone="tertiary">{error}</T> : null}
        </View>
      }
    />
  );
}
