const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  return n < 20 ? ONES[n] ?? "" : `${TENS[Math.floor(n / 10)] ?? ""}${n % 10 ? ` ${ONES[n % 10] ?? ""}` : ""}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${h ? `${ONES[h] ?? ""} Hundred${rest ? " " : ""}` : ""}${rest ? twoDigits(rest) : ""}`;
}

/** Indian numbering (lakh/crore) amount-in-words for a paise total. */
export function amountInWords(paise: number): string {
  let rupeesWhole = Math.floor(paise / 100);
  const paisePart = Math.round(paise % 100);
  if (rupeesWhole === 0 && paisePart === 0) return "Zero Rupees";
  const parts: string[] = [];
  const crore = Math.floor(rupeesWhole / 10000000);
  rupeesWhole %= 10000000;
  const lakh = Math.floor(rupeesWhole / 100000);
  rupeesWhole %= 100000;
  const thousand = Math.floor(rupeesWhole / 1000);
  rupeesWhole %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rupeesWhole) parts.push(threeDigits(rupeesWhole));
  let words = parts.length ? `${parts.join(" ")} Rupees` : "";
  if (paisePart) words += `${words ? " and " : ""}${twoDigits(paisePart)} Paise`;
  return words;
}
