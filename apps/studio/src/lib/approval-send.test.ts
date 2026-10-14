import { describe, it, expect } from "vitest";
import { approvalSendButton, pendingApprovalNote } from "./approval-send";

describe("approval send feedback", () => {
  it("blocks a second tap while sending and shows Sent after", () => {
    expect(approvalSendButton("sending", true)).toEqual({ label: "Sending...", disabled: true });
    expect(approvalSendButton("sent", true).disabled).toBe(true);
    expect(approvalSendButton("idle", false).disabled).toBe(true);
    expect(approvalSendButton("idle", true)).toEqual({ label: "Send for approval", disabled: false });
  });
  it("shows an immediate note until the live list catches up", () => {
    expect(pendingApprovalNote("sending", 0, 0)).toMatch(/Sending/);
    expect(pendingApprovalNote("sent", 0, 0)).toMatch(/Sent/);
    expect(pendingApprovalNote("sent", 1, 0)).toBeNull();
    expect(pendingApprovalNote("idle", 0, 0)).toBeNull();
  });
});
