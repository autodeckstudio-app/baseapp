import {it,expect} from "vitest";
import {bookingPayOutcomeMessage,terminalPayOutcome} from "./native-pay-core";
it("only a server-completed capture is success; pending and refunds never confirm",()=>{
  expect(terminalPayOutcome("completed")).toBe("paid");
  expect(bookingPayOutcomeMessage("paid")).toBeNull();
  expect(bookingPayOutcomeMessage("pending")).toContain("still being confirmed");
  for(const out of ["refunded","partially_refunded"] as const)expect(bookingPayOutcomeMessage(out)).toContain("does not confirm");
  for(const out of ["failed","dismissed"] as const)expect(bookingPayOutcomeMessage(out)).toContain("retry");
  expect(terminalPayOutcome("pending")).toBeNull();
});
