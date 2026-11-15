import { describe, expect, it } from "vitest";
import { amountInWords } from "./amount-words";

describe("amountInWords", () => {
  it("renders zero", () => {
    expect(amountInWords(0)).toBe("Zero Rupees");
  });

  it("renders rupees only", () => {
    expect(amountInWords(50000)).toBe("Five Hundred Rupees");
  });

  it("uses Indian numbering for lakh and crore", () => {
    expect(amountInWords(12345600)).toBe("One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees");
    expect(amountInWords(2500000000)).toBe("Two Crore Fifty Lakh Rupees");
  });

  it("renders paise", () => {
    expect(amountInWords(105050)).toBe("One Thousand Fifty Rupees and Fifty Paise");
  });

  it("renders paise-only amounts", () => {
    expect(amountInWords(75)).toBe("Seventy Five Paise");
  });
});
