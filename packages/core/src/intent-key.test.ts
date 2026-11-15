import { describe, expect, it } from "vitest";
import { intentKey } from "./intent-key.js";

let seq = 0;
const makeKey = () => `k${++seq}`;

describe("intentKey", () => {
  it("reuses the stored key across retries of the same intent", () => {
    const first = intentKey(null, "slot-a", makeKey);
    const again = intentKey(first, "slot-a", makeKey);
    expect(again.key).toBe(first.key);
  });
  it("mints a new key when the intent changes (conflicting-payload edit)", () => {
    const first = intentKey(null, "slot-a", makeKey);
    const changed = intentKey(first, "slot-b", makeKey);
    expect(changed.key).not.toBe(first.key);
    expect(changed.intent).toBe("slot-b");
  });
});
