// Rupees from paise: whole amounts show no decimals, anything else always shows two.
export const rupees = (paise: number): string => {
  const whole = paise % 100 === 0;
  return `\u20b9${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
};
