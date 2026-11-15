export type ApprovalSendState = "idle" | "sending" | "sent";

/** Label and enabled state for the "Send for approval" button. Blocks a second tap while sending, shows Sent after. */
export function approvalSendButton(state: ApprovalSendState, ready: boolean): { label: string; disabled: boolean } {
  if (state === "sending") return { label: "Sending...", disabled: true };
  if (state === "sent") return { label: "Sent", disabled: true };
  return { label: "Send for approval", disabled: !ready };
}

/** Row shown at once under Approvals while the request is in flight or the live list has not caught up. */
export function pendingApprovalNote(state: ApprovalSendState, listedCount: number, countBefore: number): string | null {
  if (state === "sending") return "Sending the request to the customer...";
  if (state === "sent" && listedCount <= countBefore) return "Sent to the customer. Waiting for it to appear here.";
  return null;
}
